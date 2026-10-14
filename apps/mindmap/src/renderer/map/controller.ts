/**
 * One sheet on screen: one instance of the drawing library, and the link
 * between it and the sheet's source tree.
 *
 * The rule: the source tree is the authority. After everything the user does
 * the controller takes the state the screen now shows and hands it to
 * reconciling (`#sync`). When reconciling refuses the state, or the tree then
 * shows something else than the screen, the screen is drawn again from the
 * tree. Undo and redo move the library's history and put the matching copy of
 * the source tree back (`DocumentSession`), then check the two against each
 * other the same way.
 *
 * The public methods are the edit functions of the editor: the toolbar, the
 * shortcuts, the menu and the AI all change the map through them (or through
 * the library's own editing, which ends in the same `#sync`). Nothing writes
 * to the source tree past this class except the sheet tabs.
 *
 * What the library must never be given is described in `text-guard.ts` and
 * `convert.ts`.
 */
import MindElixir, {
  type MindElixirInstance,
  type NodeObj,
  type Operation,
  type Options,
  type Topic,
} from 'mind-elixir'
import { isWebLink, newXmindId, type ViewLayout, type ViewSheet } from '@genoffice/xmind-engine'
import {
  type Arrow,
  cleanPastedNode,
  directionOfLayout,
  emptyMeta,
  layoutOfDirection,
  type MapNode,
  type MapNodeMeta,
  mindToState,
  nodePatch,
  normaliseTree,
  type Summary,
  topicIdsOf,
  viewToMind,
  XMIND_ID,
} from '../document/convert'
import type { DocumentSession } from '../document/session'
import { libraryTheme, lookOfSheet } from './look'
import { escapeMapText } from './text-guard'

type MenuOption = Exclude<NonNullable<Options['contextMenu']>, boolean>
/** The library's context menu texts. All twelve are passed in the user's language. */
export type MenuTexts = NonNullable<MenuOption['locale']>

/** Texts the map itself shows. They come from the app's dictionaries, already translated. */
export interface MapStrings {
  /** the title a new topic starts with */
  newTopic: string
  /** the title a new summary starts with */
  summary: string
  menu: MenuTexts
  /** the editor's own entries at the end of the context menu */
  menuRelationship: string
  menuLabel: string
  menuNote: string
  menuLink: string
}

export type TopicRequest = 'label' | 'note' | 'link'

/** What the controller needs from the screen around it. */
export interface MapHost {
  /** "N elements you cannot see will be deleted too": true to go on */
  confirmDelete(count: number): Promise<boolean>
  /** open a topic's web link; the main process checks the address and opens it */
  openLink(url: string): void
  /** the user asked to edit the labels, the note or the link of a topic */
  onRequest(kind: TopicRequest, topicId: string): void
  /** the selection, the history, the zoom or the layout changed */
  onStateChange(): void
}

export interface MapControllerOptions {
  el: HTMLDivElement
  session: DocumentSession
  sheetKey: string
  strings: MapStrings
  host: MapHost
}

/** `ask`: the user is asked before hidden elements go. `refuse`: the deletion is turned down instead (callers that cannot ask). */
export type DeleteMode = 'ask' | 'refuse'

export type RemoveOutcome =
  | { ok: true }
  | { ok: false; reason: 'preserved' | 'cancelled'; preserved: number }
  | { ok: false; reason: 'nothing' }

export interface TopicInfo {
  id: string
  title: string
  labels: string[]
  note: string | null
  link: string | null
  isRoot: boolean
}

const ZOOM_MIN = 0.2
const ZOOM_MAX = 3
const ZOOM_STEP = 0.1
/** How long the map is left alone before a change nobody reported is looked for. */
const QUIET_SYNC_DELAY_MS = 300

export class MapController {
  readonly mind: MindElixirInstance
  readonly #session: DocumentSession
  readonly #key: string
  readonly #host: MapHost
  #strings: MapStrings
  /** the view the screen was last brought in line with */
  #lastView: ViewSheet
  /** the library's data as it was then, to tell at a glance whether anything moved */
  #syncedData = ''
  #layoutPicked = false
  readonly #removedSummaries = new Set<string>()
  readonly #removedRelationships = new Set<string>()
  readonly #libraryUndo: () => void
  readonly #libraryRedo: () => void
  readonly #libraryRemoveSummary: (id: string) => void
  #quietTimer: ReturnType<typeof setTimeout> | null = null
  /** the topic a relationship is being drawn from, while the user picks its other end */
  #pickingFrom: string | null = null
  #destroyed = false
  readonly #dispose: Array<() => void> = []

  constructor(options: MapControllerOptions) {
    this.#session = options.session
    this.#key = options.sheetKey
    this.#host = options.host
    this.#strings = options.strings
    this.#lastView = this.#session.view(this.#key)

    const mind = new MindElixir({
      el: options.el,
      direction: directionOfLayout(this.#lastView.layout),
      editable: true,
      toolBar: false,
      allowUndo: true,
      newTopicName: this.#strings.newTopic,
      theme: libraryTheme(lookOfSheet(this.#session.sheet(this.#key))),
      scaleMin: ZOOM_MIN,
      scaleMax: ZOOM_MAX,
      // The one switch on the paths that put text into markup: see text-guard.ts.
      markdown: (text) => escapeMapText(text),
      contextMenu: {
        focus: false,
        // the library's own link entries make lines in two directions and with an English title
        link: false,
        locale: this.#strings.menu,
        extend: this.#menuEntries(),
      },
      before: {
        removeNodes: (topics) => this.#beforeRemove(topics),
        // Pasted nodes come from the clipboard: cleaned before the library draws them.
        copyNodes: (topics) => {
          topics.forEach(cleanIfPasted)
          return true
        },
        copyNode: (topic) => {
          cleanIfPasted(topic)
          return true
        },
      },
      // Text from the clipboard that is not a copied topic is not pasted into the map.
      pasteHandler: () => {},
    })
    this.mind = mind
    mind.keypress = {
      // Space edits, like F2: a summary or a relationship when one is selected, else the topic
      ' ': () => {
        if (mind.currentSummary) mind.editSummary(mind.currentSummary)
        else if (mind.currentArrow) mind.editArrowLabel(mind.currentArrow)
        else void mind.beginEdit()
      },
    }
    // New topics get an id the file keeps, so reconciling has nothing to rename.
    mind.generateNewObj = () => ({
      id: newXmindId(),
      topic: mind.newTopicName,
      metadata: emptyMeta(),
    })

    const started = performance.now()
    const problem = mind.init(viewToMind(this.#lastView))
    if (problem) throw problem
    this.#syncedData = mind.getDataString()
    measure(DRAW_MEASURE, started)

    // The library's history listens since init(). `#prepare` goes in front of it, so
    // the history records the ids the file will hold; `#onOperation` comes after.
    mind.bus.handlers.operation ??= []
    mind.bus.handlers.operation.unshift(this.#prepare)
    mind.bus.addListener('operation', this.#onOperation)
    mind.bus.addListener('expandNode', this.#onQuietChange)
    mind.bus.addListener('changeDirection', this.#onLayoutPicked)
    mind.bus.addListener('linkDiv', this.#scheduleQuietSync)
    for (const event of [
      'selectNodes',
      'unselectNodes',
      'selectNewNode',
      'selectArrow',
      'unselectArrow',
      'selectSummary',
      'unselectSummary',
      'scale',
    ] as const) {
      mind.bus.addListener(event, this.#onState)
    }

    this.#libraryUndo = mind.undo.bind(mind)
    this.#libraryRedo = mind.redo.bind(mind)
    this.#libraryRemoveSummary = mind.removeSummary.bind(mind)
    // The library calls these by name (Ctrl+Z, Delete, its menu): they now go through the controller.
    mind.undo = () => void this.undo()
    mind.redo = () => void this.redo()
    mind.removeSummary = (id) => void this.removeSummary(id)
    mind.createSummary = () => void this.addSummary()

    const container = mind.container
    const onKeyDownFirst = (event: KeyboardEvent): void => this.#guardKeys(event)
    const onClick = (event: MouseEvent): void => this.#onClick(event)
    container.addEventListener('keydown', onKeyDownFirst, true)
    container.addEventListener('click', onClick, true)
    this.#dispose.push(() => {
      container.removeEventListener('keydown', onKeyDownFirst, true)
      container.removeEventListener('click', onClick, true)
    })
  }

  // ---- reading ----

  get layout(): ViewLayout {
    return layoutOfDirection(this.mind.direction)
  }

  /** false while the layout shown only stands in for one the editor cannot draw */
  get layoutExact(): boolean {
    return this.#lastView.layoutExact
  }

  get zoom(): number {
    return this.mind.scaleVal
  }

  get canUndo(): boolean {
    return this.#session.canUndo(this.#key)
  }

  get canRedo(): boolean {
    return this.#session.canRedo(this.#key)
  }

  /** true while the user is picking the other end of a new relationship */
  get pickingRelationship(): boolean {
    return this.#pickingFrom !== null
  }

  selectedTopicIds(): string[] {
    return (this.mind.currentNodes ?? []).map((topic) => topic.nodeObj.id)
  }

  /** true while a topic, summary or relationship title is being typed */
  get editingText(): boolean {
    return this.mind.nodes.querySelector('#input-box') !== null
  }

  topic(id: string): TopicInfo | null {
    const node = this.#node(id)
    if (!node) return null
    const meta = this.#meta(node)
    return {
      id: node.id,
      title: node.topic,
      labels: [...meta.labels],
      note: meta.note,
      link: meta.link,
      isRoot: !node.parent,
    }
  }

  // ---- editing: the same functions for the toolbar, the shortcuts, the menu and the AI ----

  /** A new topic under the given one (the selected one when left out). Starts editing its title. */
  addChild(parentId?: string): void {
    const parent = parentId ? this.#element(parentId) : this.mind.currentNode
    if (parent) void this.mind.addChild(parent)
  }

  /** A new topic after the given one (the selected one when left out). */
  addSibling(topicId?: string): void {
    const topic = topicId ? this.#element(topicId) : this.mind.currentNode
    if (topic) void this.mind.insertSibling('after', topic)
  }

  /** Starts typing in the selected topic. */
  beginEdit(): void {
    if (this.mind.currentNode) void this.mind.beginEdit(this.mind.currentNode)
  }

  setTitle(topicId: string, title: string): boolean {
    return this.#patch(topicId, { topic: title })
  }

  setLabels(topicId: string, labels: readonly string[]): boolean {
    const clean = labels.map((label) => label.trim()).filter((label) => label !== '')
    return this.#patchMeta(topicId, { labels: clean })
  }

  setNote(topicId: string, note: string | null): boolean {
    return this.#patchMeta(topicId, { note: note && note.trim() !== '' ? note : null })
  }

  /** Sets or removes a topic's web link. False when the address is not one a map holds as a web link. */
  setLink(topicId: string, link: string | null): boolean {
    const address = link === null ? null : link.trim()
    if (address !== null && !isWebLink(address)) return false
    return this.#patchMeta(topicId, { link: address || null })
  }

  /**
   * Deletes topics with everything below them. When that would take elements
   * the editor does not show, the user is asked first (`ask`) or the deletion
   * is turned down with their number (`refuse`).
   */
  async removeTopics(ids: readonly string[], mode: DeleteMode = 'ask'): Promise<RemoveOutcome> {
    const wanted = new Set(ids)
    wanted.delete(this.mind.nodeData.id)
    const found = [...wanted].filter((id) => this.#node(id))
    if (found.length === 0) return { ok: false, reason: 'nothing' }
    const preserved = this.#session.preservedWith(this.#key, found)
    if (preserved > 0) {
      if (mode === 'refuse') return { ok: false, reason: 'preserved', preserved }
      if (!(await this.#host.confirmDelete(preserved))) {
        return { ok: false, reason: 'cancelled', preserved }
      }
    }
    this.edit((root) => {
      const strip = (node: NodeObj): void => {
        if (!node.children) return
        node.children = node.children.filter((child) => !wanted.has(child.id))
        node.children.forEach(strip)
      }
      strip(root)
    })
    return { ok: true }
  }

  /** Removes a summary (by the id of its summary topic), asking first when branches hang under it. */
  async removeSummary(id: string, mode: DeleteMode = 'ask'): Promise<RemoveOutcome> {
    if (!this.mind.summaries.some((summary) => summary.id === id)) {
      return { ok: false, reason: 'nothing' }
    }
    const preserved = this.#session.preservedWith(this.#key, [id])
    if (preserved > 0) {
      if (mode === 'refuse') return { ok: false, reason: 'preserved', preserved }
      if (!(await this.#host.confirmDelete(preserved))) {
        return { ok: false, reason: 'cancelled', preserved }
      }
    }
    this.#libraryRemoveSummary(id)
    return { ok: true }
  }

  /**
   * A summary over the selected topics: the branches of their common parent
   * from the first to the last selected. False when the selection has none
   * (nothing selected, or only the central topic).
   */
  addSummary(): boolean {
    const range = this.#summaryRange()
    if (!range) return false
    const before = new Set(this.mind.summaries.map((summary) => summary.id))
    this.mind.createSummaryFrom({ ...range, label: this.#strings.summary })
    const added = this.mind.summaries.find((summary) => !before.has(summary.id))
    const group = added ? this.mind.container.querySelector(`#s-${added.id}`) : null
    // straight into typing its title, as with a new topic
    if (group) this.mind.editSummary(group as Parameters<MindElixirInstance['editSummary']>[0])
    return true
  }

  /** A relationship between two topics. False when one of them is not drawn (folded away). */
  addRelationship(fromId: string, toId: string, title = ''): boolean {
    const from = this.#element(fromId)
    const to = this.#element(toId)
    if (!from || !to || from === to) return false
    // The library's own default title is English text; a new line starts without one.
    this.mind.createArrow(from, to, { label: title } as Parameters<
      MindElixirInstance['createArrow']
    >[2])
    return true
  }

  /** Starts a relationship from the selected topic; the next topic the user clicks is its other end. */
  pickRelationshipTarget(): boolean {
    const from = this.mind.currentNode
    if (!from) return false
    this.#pickingFrom = from.nodeObj.id
    this.#host.onStateChange()
    return true
  }

  cancelRelationshipPick(): void {
    if (this.#pickingFrom === null) return
    this.#pickingFrom = null
    this.#host.onStateChange()
  }

  /** The user picks a layout. This is what writes a layout to the file. */
  setLayout(layout: ViewLayout): void {
    const mind = this.mind
    if (layout === 'left') mind.initLeft()
    else if (layout === 'right') mind.initRight()
    else if (layout === 'down') mind.initDown()
    else mind.initSide()
  }

  /** Folds or unfolds every branch. Not a step of the history, like folding one branch. */
  setAllFolded(folded: boolean): void {
    const visit = (node: NodeObj, isRoot: boolean): void => {
      if (!isRoot) {
        if (folded && node.children?.length) node.expanded = false
        else delete node.expanded
      }
      node.children?.forEach((child) => visit(child, false))
    }
    visit(this.mind.nodeData, true)
    this.mind.refresh()
    this.#sync({ step: false })
  }

  /**
   * Edits the map as data, as one step: `change` gets the library's live node
   * tree and may add, remove, move and edit nodes (titles, and the labels,
   * note and link in `metadata`). The result is drawn, recorded as a single
   * step of the history and reconciled, exactly like something the user did.
   * This is the way in for edits that are not one library call: several at
   * once, or topics that are folded away and have no element.
   */
  edit(change: (root: MapNode) => void): void {
    const mind = this.mind
    change(mind.nodeData as MapNode)
    normaliseTree(mind.nodeData, topicIdsOf(this.#lastView))
    mind.refresh()
    mind.bus.fire('operation', {
      name: 'reshapeNode',
      obj: mind.nodeData,
      origin: mind.nodeData,
    })
  }

  // ---- history ----

  /** One step back. False when there is none. */
  undo(): boolean {
    if (!this.canUndo) return false
    this.#libraryUndo()
    const view = this.#session.undo(this.#key)
    if (view) this.#afterHistoryMove(view)
    return true
  }

  /** One step forward again. False when there is none. */
  redo(): boolean {
    if (!this.canRedo) return false
    this.#libraryRedo()
    const view = this.#session.redo(this.#key)
    if (view) this.#afterHistoryMove(view)
    return true
  }

  // ---- view ----

  zoomIn(): void {
    this.mind.scale(Math.min(ZOOM_MAX, round(this.mind.scaleVal + ZOOM_STEP)))
  }

  zoomOut(): void {
    this.mind.scale(Math.max(ZOOM_MIN, round(this.mind.scaleVal - ZOOM_STEP)))
  }

  zoomReset(): void {
    this.mind.scale(1)
    this.mind.toCenter()
  }

  zoomFit(): void {
    this.mind.scaleFit()
  }

  /** The texts changed (another language): new topics, new summaries and the context menu follow. */
  setStrings(strings: MapStrings): void {
    this.#strings = strings
    this.mind.newTopicName = strings.newTopic
    const items = this.mind.container.querySelectorAll<HTMLElement>('.context-menu .menu-list > li')
    const own = this.#menuEntries().map((entry) => entry.name)
    const builtIn: Readonly<Record<string, string>> = {
      'cm-add_child': strings.menu.addChild,
      'cm-add_parent': strings.menu.addParent,
      'cm-add_sibling': strings.menu.addSibling,
      'cm-remove_child': strings.menu.removeNode,
      'cm-up': strings.menu.moveUp,
      'cm-down': strings.menu.moveDown,
      'cm-summary': strings.menu.summary,
    }
    items.forEach((item, at) => {
      const text = builtIn[item.id] ?? own[at - (items.length - own.length)]
      if (text !== undefined && item.firstElementChild) item.firstElementChild.textContent = text
    })
  }

  // ---- keeping the tree and the screen in line ----

  /**
   * Brings the source tree in line with whatever the screen shows right now.
   * Called before the map is saved or read, so a change nobody reported is
   * not lost.
   */
  flush(): void {
    this.#sync({ step: false })
  }

  /** Draws the sheet again from the source tree. */
  redraw(): void {
    this.#draw(this.#session.view(this.#key))
  }

  destroy(): void {
    if (this.#destroyed) return
    this.#destroyed = true
    if (this.#quietTimer) clearTimeout(this.#quietTimer)
    this.#dispose.forEach((dispose) => dispose())
    this.mind.destroy()
  }

  // ---- internals ----

  #menuEntries(): NonNullable<MenuOption['extend']> {
    const ask = (kind: TopicRequest) => () => {
      this.#hideMenu()
      const id = this.mind.currentNode?.nodeObj.id
      if (id) this.#host.onRequest(kind, id)
    }
    return [
      {
        name: this.#strings.menuRelationship,
        onclick: () => {
          this.#hideMenu()
          this.pickRelationshipTarget()
        },
      },
      { name: this.#strings.menuLabel, onclick: ask('label') },
      { name: this.#strings.menuNote, onclick: ask('note') },
      { name: this.#strings.menuLink, onclick: ask('link') },
    ]
  }

  #hideMenu(): void {
    const menu = this.mind.container.querySelector<HTMLElement>('.context-menu')
    if (menu) menu.hidden = true
  }

  #node(id: string): NodeObj | null {
    return this.mind.getObjById(id, this.mind.nodeData)
  }

  #meta(node: NodeObj): MapNodeMeta {
    return { ...emptyMeta(), ...((node.metadata as Partial<MapNodeMeta> | undefined) ?? {}) }
  }

  /** The element of a topic, or null when it is folded away. */
  #element(id: string): Topic | null {
    try {
      return this.mind.findEle(id)
    } catch {
      return null
    }
  }

  #patchMeta(topicId: string, change: Partial<MapNodeMeta>): boolean {
    const node = this.#node(topicId)
    if (!node) return false
    return this.#patch(topicId, nodePatch({ ...this.#meta(node), ...change }))
  }

  /** Changes fields of one topic as one step: through the library when the topic is drawn, as data when it is folded away. */
  #patch(topicId: string, patch: Partial<MapNode>): boolean {
    const node = this.#node(topicId)
    if (!node) return false
    const element = this.#element(topicId)
    if (element) {
      void this.mind.reshapeNode(element, patch as Partial<NodeObj>)
    } else {
      this.edit((root) => {
        const target = this.mind.getObjById(topicId, root)
        if (target) Object.assign(target, patch)
      })
    }
    return true
  }

  /** The library asks before it removes topics (Delete, cut, its menu). */
  async #beforeRemove(topics: Topic[]): Promise<boolean> {
    const removable = topics.filter((topic) => topic.nodeObj.parent)
    if (removable.length === 0) return false
    if (removable.length !== topics.length) {
      // The central topic stays; the rest of the selection is deleted on its own.
      void this.mind.removeNodes(removable)
      return false
    }
    const preserved = this.#session.preservedWith(
      this.#key,
      removable.map((topic) => topic.nodeObj.id),
    )
    if (preserved === 0) return true
    return this.#host.confirmDelete(preserved)
  }

  /** Runs in front of the library's history: what an operation just made gets ids the file can keep. */
  #prepare = (operation: Operation): void => {
    switch (operation.name) {
      case 'addChild':
      case 'insertSibling':
      case 'insertParent':
      case 'copyNode':
        this.#keepableIds(operation.obj)
        break
      case 'copyNodes':
        operation.objs.forEach((node) => this.#keepableIds(node))
        break
      case 'createSummary':
        this.#renameSummary(operation.obj)
        break
      case 'createArrow':
        this.#renameArrow(operation.obj)
        break
    }
  }

  #keepableIds(node: NodeObj): void {
    if (!XMIND_ID.test(node.id)) {
      const element = this.#element(node.id)
      node.id = newXmindId()
      if (element) element.dataset.nodeid = `me${node.id}`
    }
    node.children?.forEach((child) => this.#keepableIds(child))
  }

  #renameSummary(summary: Summary): void {
    if (XMIND_ID.test(summary.id)) return
    const container = this.mind.container
    const group = container.querySelector(`#s-${summary.id}`)
    const label = container.querySelector<HTMLElement>(`#label-s-${summary.id}`)
    summary.id = newXmindId()
    if (group) group.id = `s-${summary.id}`
    if (label) {
      label.id = `label-s-${summary.id}`
      label.dataset.svgId = `s-${summary.id}`
    }
  }

  #renameArrow(arrow: Arrow): void {
    // a line in two directions is not something the file's relationships say
    delete arrow.bidirectional
    if (XMIND_ID.test(arrow.id)) return
    const container = this.mind.container
    const group = container.querySelector<SVGGElement>(`g[data-linkid="${arrow.id}"]`)
    const label = container.querySelector<HTMLElement>(`#label-a-${arrow.id}`)
    arrow.id = newXmindId()
    if (group) {
      group.id = `a-${arrow.id}`
      group.dataset.linkid = arrow.id
    }
    if (label) {
      label.id = `label-a-${arrow.id}`
      label.dataset.svgId = `a-${arrow.id}`
    }
  }

  #onOperation = (operation: Operation): void => {
    // Opening the edit box changes nothing yet, and the library records no step for it.
    if (operation.name === 'beginEdit') return
    if (operation.name === 'removeSummary') this.#removedSummaries.add(operation.obj.id)
    if (operation.name === 'removeArrow') this.#removedRelationships.add(operation.obj.id)
    this.#sync({
      step: true,
      reshaped: operation.name === 'reshapeArrow' ? [operation.obj.id] : [],
    })
  }

  #onQuietChange = (): void => {
    this.#sync({ step: false })
  }

  #onLayoutPicked = (): void => {
    this.#layoutPicked = true
    this.#sync({ step: false })
  }

  #onState = (): void => {
    this.#host.onStateChange()
  }

  /** The library drew something. Most of the time that was reported; when it was not (fold levels), this finds it. */
  #scheduleQuietSync = (): void => {
    if (this.#destroyed) return
    if (this.#quietTimer) clearTimeout(this.#quietTimer)
    this.#quietTimer = setTimeout(() => {
      this.#quietTimer = null
      if (!this.#destroyed && !this.editingText) this.#sync({ step: false })
    }, QUIET_SYNC_DELAY_MS)
  }

  #sync(options: { step: boolean; reshaped?: string[] }): void {
    if (this.#destroyed) return
    if (this.#quietTimer) {
      clearTimeout(this.#quietTimer)
      this.#quietTimer = null
    }
    const data = this.mind.getDataString()
    if (!options.step && !this.#layoutPicked && data === this.#syncedData) return
    const started = performance.now()
    const state = mindToState(JSON.parse(data), {
      view: this.#lastView,
      layoutPicked: this.#layoutPicked,
      removedSummaries: this.#removedSummaries,
      removedRelationships: this.#removedRelationships,
    })
    const result = this.#session.apply(this.#key, state, {
      step: options.step,
      reshapedRelationships: options.reshaped,
    })
    this.#layoutPicked = false
    this.#removedSummaries.clear()
    this.#removedRelationships.clear()
    this.#lastView = result.view
    if (!result.ok) {
      console.warn('[mindmap] the screen could not be applied to the map:', result.problem)
      this.#draw(result.view)
    } else if (!result.inSync || result.ids.topics.size > 0 || result.ids.relationships.size > 0) {
      this.#draw(result.view)
    } else {
      this.#syncedData = data
    }
    measure(RECONCILE_MEASURE, started)
    this.#host.onStateChange()
  }

  /** After an undo or redo: the source tree is back; the screen must show exactly it. */
  #afterHistoryMove(view: ViewSheet): void {
    this.#layoutPicked = false
    this.#removedSummaries.clear()
    this.#removedRelationships.clear()
    this.#lastView = view
    const data = this.mind.getDataString()
    const state = mindToState(JSON.parse(data), {
      view,
      layoutPicked: false,
      removedSummaries: this.#removedSummaries,
      removedRelationships: this.#removedRelationships,
    })
    const check = this.#session.apply(this.#key, state, { step: false })
    if (!check.ok || check.changed || !check.inSync) {
      // The library went back to something else than the tree holds: the copy wins.
      this.#draw(this.#session.restoreStep(this.#key))
    } else {
      this.#syncedData = data
    }
    this.#host.onStateChange()
  }

  #draw(view: ViewSheet): void {
    const mind = this.mind
    const selected = this.selectedTopicIds()
    mind.direction = directionOfLayout(view.layout)
    mind.refresh(viewToMind(view))
    this.#lastView = view
    this.#syncedData = mind.getDataString()
    const again = selected.map((id) => this.#element(id)).filter((topic) => topic !== null)
    if (again.length > 0) mind.selectNodes(again)
  }

  /** Runs before the library's own key handling. */
  #guardKeys(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.#pickingFrom !== null) {
      this.cancelRelationshipPick()
      return
    }
    // The library switches the layout on Ctrl+arrow. A layout is written to the
    // file when it is picked, so it is picked on purpose (the toolbar), not by a key.
    const layoutKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key)
    if (layoutKey && (event.ctrlKey || event.metaKey)) {
      event.stopImmediatePropagation()
      event.preventDefault()
    }
  }

  #onClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null
    if (!target) return
    const topic = target.closest('me-tpc') as Topic | null
    if (this.#pickingFrom !== null) {
      const from = this.#pickingFrom
      this.#pickingFrom = null
      if (topic) {
        event.stopPropagation()
        this.addRelationship(from, topic.nodeObj.id)
      }
      this.#host.onStateChange()
      return
    }
    if (!topic) return
    if (target.closest('.mm-chip-link')) {
      // The map never opens anything itself: the address goes to the main process.
      event.preventDefault()
      event.stopPropagation()
      const link = this.#meta(topic.nodeObj).link
      if (link) this.#host.openLink(link)
    } else if (target.closest('.mm-chip-note')) {
      event.stopPropagation()
      this.mind.selectNode(topic)
      this.#host.onRequest('note', topic.nodeObj.id)
    }
  }

  /** The range a summary over the selection covers: positions among the branches of the selection's common parent. */
  #summaryRange(): { parent: string; start: number; end: number } | null {
    const paths = (this.mind.currentNodes ?? []).map((topic) => {
      const path: NodeObj[] = []
      for (let node: NodeObj | undefined = topic.nodeObj; node; node = node.parent) {
        path.unshift(node)
      }
      return path
    })
    if (paths.length === 0) return null
    let shared = Math.min(...paths.map((path) => path.length))
    for (let depth = 0; depth < shared; depth++) {
      if (paths.some((path) => path[depth] !== paths[0]![depth])) {
        shared = depth
        break
      }
    }
    // a selected topic that is an ancestor of the rest (or the only one) is covered itself
    if (paths.some((path) => path.length === shared)) shared--
    const parent = paths[0]![shared - 1]
    if (!parent?.children) return null
    const positions = paths.map((path) => parent.children!.indexOf(path[shared]!))
    if (positions.some((position) => position < 0)) return null
    return { parent: parent.id, start: Math.min(...positions), end: Math.max(...positions) }
  }
}

/**
 * A node of the live tree knows its parent and was made by this editor. One
 * that does not came out of the clipboard as text any program can write.
 */
function cleanIfPasted(topic: Topic): void {
  const node = topic.nodeObj as NodeObj | undefined
  if (node && typeof node.parent !== 'object') cleanPastedNode(node)
}

/**
 * Names of the timings left in the page's performance timeline: drawing a
 * sheet for the first time, and bringing the source tree in line after a
 * change. They are how the speed of large maps is measured.
 */
export const DRAW_MEASURE = 'mindmap:draw'
export const RECONCILE_MEASURE = 'mindmap:reconcile'

function measure(name: string, started: number): void {
  try {
    performance.measure(name, { start: started, end: performance.now() })
  } catch {
    // a timeline that cannot take the entry is no reason to fail an edit
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
