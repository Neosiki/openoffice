// @vitest-environment jsdom
/**
 * The memo guard around AI edits, against the real rhwp engine: an edit that would take a
 * memo away is rolled back and asks for approval, the same edit goes through with the
 * allowance; a user's own deletion is announced once; and the copy/paste results the engine
 * makes of memos are what the panel sees.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import init, { HwpDocument } from '@rhwp/core'
import { agentPlugin, type AgentPluginHost } from '../studio-plugin/agent-plugin.mjs'

const require = createRequire(import.meta.url)
const FIXTURES = join(__dirname, 'fixtures')

beforeAll(async () => {
  const wasm = join(dirname(require.resolve('@rhwp/core')), 'rhwp_bg.wasm')
  await init({ module_or_path: readFileSync(wasm) })
})

interface Position {
  sectionIndex: number
  paragraphIndex: number
  charOffset: number
  parentParaIndex?: number
  controlIndex?: number
  cellIndex?: number
  cellParaIndex?: number
  isTextBox?: boolean
}

function blank(lines: string[]): HwpDocument {
  const doc = HwpDocument.createEmpty()
  doc.createBlankDocument()
  lines.forEach((line, k) => {
    if (k > 0) doc.splitParagraph(0, k - 1, doc.getParagraphLength(0, k - 1))
    if (line) doc.insertText(0, k, 0, line)
  })
  return doc
}

const insertBodyMemo = (
  doc: HwpDocument,
  para: number,
  start: number,
  end: number,
  author = 'tester',
  text = 'memo body',
) =>
  JSON.parse(doc.insertMemo(0, para, start, end, JSON.stringify({ author, text }))) as {
    ok: true
    id: number
    index: number
  }

/** A two-row, two-column table in paragraph 1, with a memo in the text of its last cell. */
function tableWithMemo() {
  const doc = blank(['title', ''])
  doc.pasteHtml(
    0,
    1,
    0,
    '<table><tr><td>r1</td><td>x</td></tr><tr><td>r2</td><td>memo here</td></tr></table>',
  )
  const path = JSON.stringify([{ controlIndex: 0, cellIndex: 3, cellParaIndex: 0 }])
  const made = JSON.parse(
    doc.insertMemoByPath(0, 1, path, 0, 4, JSON.stringify({ author: 'cell', text: 'cell memo' })),
  ) as { ok: true; id: number; index: number }
  return { doc, made, path }
}

function openEditor(doc: HwpDocument) {
  document.body.innerHTML = '<div id="scroll-container"><div id="scroll-content"></div></div>'
  let current = doc
  const history: Uint8Array[] = []
  const labels: string[] = []
  const listeners: (() => void)[] = []
  const commands = new Map<string, (services: unknown, params?: unknown) => unknown>()
  const cursor = {
    position: null as Position | null,
    selection: null as { start: Position; end: Position } | null,
    isInCellSelectionMode: () => false,
    isInHeaderFooter: () => false,
    isInFootnote: () => false,
    isInPictureObjectSelection: () => false,
    isInTableObjectSelection: () => false,
    hasSelection: () => cursor.selection !== null,
    getSelectionOrdered: () => cursor.selection,
    getPosition: () => cursor.position,
  }
  const services = {
    getInputHandler: () => ({ cursor }),
    getViewportManager: () => ({ getZoom: () => 2 }),
  }
  const emit = () => listeners.forEach((listener) => listener())
  const host = {
    read: (fn: (d: never) => unknown) => fn(current as never),
    transaction: (label: string, fn: (tx: never) => unknown) => {
      labels.push(label)
      const before = current.exportHwp()
      try {
        const result = fn({ doc: () => current, deferPagination: () => {} } as never)
        history.push(before)
        emit()
        return result
      } catch (thrown) {
        current = new HwpDocument(before)
        throw thrown
      }
    },
    events: { on: (_name: string, handler: () => void) => listeners.push(handler) },
    automation: {
      registerCommand: (def: { id: string; execute: (s: unknown, p?: unknown) => unknown }) =>
        commands.set(def.id, def.execute),
      execute: (command: string, params?: unknown) => {
        if (command === 'edit:undo') {
          const before = history.pop()
          if (!before) return { ok: false }
          current = new HwpDocument(before)
          emit()
          return { ok: true }
        }
        const run = commands.get(command)
        return run ? run(services, params) : null
      },
    },
  } as unknown as AgentPluginHost
  const plugin = agentPlugin.activate(host)
  /** a change the user makes in the editor, recorded so the editor's undo can take it back */
  const userEdit = (change: (doc: HwpDocument) => void) => {
    history.push(current.exportHwp())
    change(current)
    emit()
  }
  return {
    plugin,
    doc: () => current,
    cursor,
    labels,
    steps: () => history.length,
    userEdit,
  }
}

/** The events the plugin sends on the editor's window. */
function watch(name: string) {
  const seen: { detail: Record<string, unknown> }[] = []
  const handler = (event: Event) => seen.push((event as CustomEvent).detail)
  globalThis.addEventListener(name, handler)
  return { seen, stop: () => globalThis.removeEventListener(name, handler) }
}

afterEach(() => {
  agentPlugin.deactivate?.()
  document.body.innerHTML = ''
})

describe('an AI edit that would take a memo with it', () => {
  it('rolls back and answers with the memos that would be lost', () => {
    const { doc, made } = tableWithMemo()
    const editor = openEditor(doc)

    const result = editor.plugin.removeTableLines(1, 'rows', 2, 1)
    expect(result).toMatchObject({
      ok: false,
      reason: 'memo_removal_requires_approval',
      count: 1,
    })
    expect(result.ok === false && result.memos).toEqual([
      { id: made.id, index: 1, author: 'cell', text: 'cell memo', place: 'tableCell', page: 1 },
    ])
    // nothing was left behind: the table and its memo are as they were, with no undo step
    expect(editor.steps()).toBe(0)
    expect(JSON.parse(editor.doc().getTableDimensions(0, 1, 0))).toMatchObject({
      rowCount: 2,
      colCount: 2,
    })
    expect(editor.plugin.listMemos()).toMatchObject({ count: 1 })
  })

  it('goes through when the same call is given the allowance', () => {
    const { doc } = tableWithMemo()
    const editor = openEditor(doc)

    const result = editor.plugin.removeTableLines(1, 'rows', 2, 1, { allowMemoRemoval: true })
    expect(result).toMatchObject({ ok: true, rows: 1, cols: 2 })
    expect(JSON.parse(editor.doc().getTableDimensions(0, 1, 0))).toMatchObject({ rowCount: 1 })
    expect(editor.plugin.listMemos().count).toBe(0)
  })

  it('keeps a memo whose text an edit took as a caret anchor, without asking', () => {
    // The engine keeps the memo field when its text goes: the anchor becomes empty, so
    // nothing is lost and the panel still lists it.
    const doc = blank(['first', 'memo paragraph', 'third'])
    insertBodyMemo(doc, 1, 0, 4, 'body', 'body memo')
    const editor = openEditor(doc)

    const result = editor.plugin.deleteParagraph('memo paragraph', null)
    expect(result).toMatchObject({ ok: true })
    const memo = editor.plugin.listMemos().memos[0]!
    expect(memo.startCharIdx).toBe(memo.endCharIdx)
    expect(editor.plugin.listMemos().count).toBe(1)
  })

  it('does not ask when the edit only changes the text inside the anchor', () => {
    const doc = blank(['hello world'])
    insertBodyMemo(doc, 0, 0, 5)
    const editor = openEditor(doc)

    expect(editor.plugin.replaceText('ell', 'ipp')).toMatchObject({ ok: true })
    expect(editor.plugin.listMemos().memos[0]).toMatchObject({
      startCharIdx: 0,
      endCharIdx: 5,
    })
    expect(editor.doc().getTextRange(0, 0, 0, 11)).toBe('hippo world')
  })

  it('never flags the plugin’s own memo calls', () => {
    const doc = blank(['hello world'])
    const editor = openEditor(doc)
    const anchor = {
      place: 'body' as const,
      sectionIndex: 0,
      paraIndex: 0,
      startCharIdx: 0,
      endCharIdx: 5,
      path: null,
    }
    const made = editor.plugin.insertMemo(anchor, 'me', 'note')
    expect(made.ok).toBe(true)
    if (!made.ok) return
    expect(editor.plugin.setMemo(made.id, 'changed')).toEqual({ ok: true })
    expect(editor.plugin.removeMemo(made.id)).toEqual({ ok: true })
  })
})

describe('a memo the user’s own edit takes away', () => {
  it('is announced once, and the editor’s undo brings it back', () => {
    const doc = blank(['title', ''])
    const path = JSON.stringify([{ controlIndex: 0, cellIndex: 0, cellParaIndex: 0 }])
    doc.pasteHtml(0, 1, 0, '<table><tr><td>cell text</td></tr></table>')
    insertBodyMemo(doc, 0, 0, 2, 'body', 'body memo')
    JSON.parse(
      doc.insertMemoByPath(0, 1, path, 0, 4, JSON.stringify({ author: 'cell', text: 'cell memo' })),
    )
    const editor = openEditor(doc)
    const watched = watch('ieum:memo-removed')

    editor.userEdit((current) => current.deleteTableControl(0, 1, 0))
    expect(watched.seen).toHaveLength(1)
    expect(watched.seen[0]).toMatchObject({ kind: 'memo-removed', count: 1 })
    expect((watched.seen[0]!.memos as { author: string }[])[0]).toMatchObject({ author: 'cell' })

    // the editor's undo brings the table and its memo back, without a second notice
    expect(editor.plugin.undo(1, editor.plugin.foreignChanges())).toMatchObject({ ok: true })
    expect(editor.plugin.listMemos().count).toBe(2)
    expect(watched.seen).toHaveLength(1)

    // another change that takes nothing away is not announced
    editor.userEdit((current) => current.insertText(0, 0, 0, 'x'))
    expect(watched.seen).toHaveLength(1)
    watched.stop()
  })
})

describe('copy and paste', () => {
  it('duplicates a whole paragraph memo with a new id and number', () => {
    const doc = blank(['source text', 'target '])
    const made = insertBodyMemo(doc, 0, 0, 6, 'copier', 'copy body')
    const editor = openEditor(doc)

    doc.copySelection(0, 0, 0, 0, doc.getParagraphLength(0, 0))
    const pasted = JSON.parse(doc.pasteInternal(0, 1, 7)) as { containsField: boolean }
    expect(pasted.containsField).toBe(true)

    const listed = editor.plugin.listMemos()
    expect(listed.count).toBe(2)
    expect(listed.memos[1]).toMatchObject({
      author: 'copier',
      text: 'copy body',
      paraIndex: 1,
      startCharIdx: 7,
      endCharIdx: 13,
      index: 2,
    })
    expect(listed.memos[1]!.id).not.toBe(made.id)
  })

  it('keeps the text but drops a memo anchor whose end marker was not copied', () => {
    const source = new Uint8Array(readFileSync(join(FIXTURES, 'memo-source.hwp')))
    const doc = new HwpDocument(source)
    const editor = openEditor(doc)
    const memo = editor.plugin.listMemos().memos[0]!
    expect(editor.plugin.listMemos().count).toBe(1)

    const last = doc.getParagraphCount(0) - 1
    doc.splitParagraph(0, last, doc.getParagraphLength(0, last))
    const target = doc.getParagraphCount(0) - 1
    doc.insertText(0, target, 0, 'target ')
    doc.copySelection(0, memo.paraIndex!, 0, memo.paraIndex!, 1_000_000)
    const pasted = JSON.parse(doc.pasteInternal(0, target, 7)) as { containsField: boolean }
    expect(pasted.containsField).toBe(false)

    expect(editor.plugin.listMemos().count).toBe(1)
    const again = new HwpDocument(doc.exportHwp())
    expect(again.getMemoList()).toContain('"index":1')
    expect(again.getTextFileUnicode()).toContain('target')
  })

  it('tells the app when a paste brought the text without the memo', async () => {
    const doc = blank(['hello world'])
    insertBodyMemo(doc, 0, 0, 5, 'copier', 'copy body')
    const editor = openEditor(doc)
    editor.cursor.selection = {
      start: { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 },
      end: { sectionIndex: 0, paragraphIndex: 0, charOffset: 5 },
    }
    const watched = watch('ieum:memo-not-copied')

    document.body.dispatchEvent(new Event('copy', { bubbles: true, cancelable: true }))
    document.body.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }))
    // the editor's system-clipboard paste: text only, no memo field
    doc.insertText(0, 0, 11, ' hello')
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(watched.seen).toHaveLength(1)
    expect(watched.seen[0]).toMatchObject({ kind: 'memo-not-copied', count: 1 })
    watched.stop()
  })
})
