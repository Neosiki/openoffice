/**
 * The whole editor screen against a fake preload API: what it shows for each
 * way a file can open, what it asks before deleting, and what it hands the
 * main process to save.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Lang } from '@genoffice/i18n'
import { openXmind, type XmindSheet } from '@genoffice/xmind-engine'
import App from '../src/renderer/App'
import { LocaleProvider } from '../src/renderer/i18n/locale'
import type {
  MindmapApi,
  MindmapMenuCommand,
  OpenFileResult,
  SaveMindmapRequest,
  SaveMode,
} from '../src/shared/ipc'
import { documentOf, IDS, plainSheet, RICH_PRESERVED, richSheet } from './helpers/fixtures'

interface Fake {
  api: MindmapApi
  saves: SaveMindmapRequest[]
  dirty: boolean[]
  acks: boolean[]
  outlines: unknown[]
  emit: {
    saveRequest(mode: SaveMode): void
    menu(command: MindmapMenuCommand): void
    outlineRequest(): void
  }
}

function fakeApi(pending: string | null, file: OpenFileResult | null): Fake {
  const handlers: Record<string, ((...args: never[]) => void) | undefined> = {}
  const on =
    (name: string) =>
    (handler: (...args: never[]) => void): (() => void) => {
      handlers[name] = handler
      return () => {
        handlers[name] = undefined
      }
    }
  const fake: Fake = {
    saves: [],
    dirty: [],
    acks: [],
    outlines: [],
    emit: {
      saveRequest: (mode) => (handlers.save as ((mode: SaveMode) => void) | undefined)?.(mode),
      menu: (command) =>
        (handlers.menu as ((command: MindmapMenuCommand) => void) | undefined)?.(command),
      outlineRequest: () => (handlers.outline as (() => void) | undefined)?.(),
    },
    api: {
      consumePending: async () => pending,
      openFile: async () => file ?? { status: 'unreadable' },
      save: async (request: SaveMindmapRequest) => {
        fake.saves.push(request)
        return { ok: true, path: pending ?? 'C:/maps/new.xmind' }
      },
      setDirty: (dirty: boolean) => void fake.dirty.push(dirty),
      onSaveRequest: on('save'),
      sendSaveRequestAck: (ok: boolean) => void fake.acks.push(ok),
      onCloseSaveRequest: on('close'),
      sendCloseSaveResult: () => {},
      onFileRenamed: on('renamed'),
      openLink: async () => true,
      onMenuCommand: on('menu'),
      getLanguage: async () => 'en' as Lang,
      onLanguageChanged: on('language'),
      getTheme: async () => 'system' as const,
      onThemeChanged: on('theme'),
      getAutoSaveDefault: async () => ({ on: false, updatedAt: 0 }),
      onAutoSaveDefaultChanged: on('autosave'),
      onChromePressed: on('chrome'),
      onOutlineRequest: on('outline'),
      sendOutlineResult: (reply: unknown) => void fake.outlines.push(reply),
      onBytesRequest: on('bytes'),
      sendBytesResult: () => {},
    } as unknown as MindmapApi,
  }
  return fake
}

let container: HTMLElement
let unmount: () => void = () => {}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
})
afterEach(() => {
  unmount()
  unmount = () => {}
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function settle(): Promise<void> {
  for (let turn = 0; turn < 6; turn++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

async function mountApp(fake: Fake): Promise<void> {
  ;(window as unknown as { mindmapApi: MindmapApi }).mindmapApi = fake.api
  container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(createElement(LocaleProvider, { initial: 'en', children: createElement(App) }))
  })
  unmount = () => act(() => root.unmount())
  await settle()
}

async function openWith(...sheets: XmindSheet[]) {
  const bytes = await (await documentOf(...sheets)).save()
  const fake = fakeApi('C:/maps/test.xmind', { status: 'ok', bytes })
  await mountApp(fake)
  return { fake, bytes }
}

const click = async (selector: string): Promise<void> => {
  const element = container.ownerDocument.querySelector<HTMLElement>(selector)
  if (!element) throw new Error(`nothing matches ${selector}`)
  await act(async () => {
    element.click()
  })
  await settle()
}

const topicEl = (id: string): HTMLElement =>
  container.querySelector<HTMLElement>(`[data-nodeid="me${id}"]`)!

async function pressOnMap(key: string): Promise<void> {
  const map = container.querySelector<HTMLElement>('.map-container')!
  await act(async () => {
    map.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
  await settle()
}

async function selectOnMap(id: string): Promise<void> {
  await act(async () => {
    topicEl(id).dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }),
    )
  })
  await settle()
}

describe('a file that does not open', () => {
  it.each([
    ['legacy-format', 'This file is in an older format and cannot be opened'],
    ['encrypted', 'This file is password-protected and cannot be opened'],
    ['unreadable', 'This file cannot be read'],
    ['rejected', 'This file cannot be opened because of its size or structure'],
  ] as const)('%s shows its message and offers nothing to save with', async (status, message) => {
    const fake = fakeApi('C:/maps/x.xmind', { status })
    await mountApp(fake)
    expect(container.textContent).toBe(message)
    expect(container.querySelector('[data-action="save"]')).toBeNull()
    expect(container.querySelector('.map-container')).toBeNull()

    // the menu's Save is turned down without a save ever being asked of the main process
    fake.emit.saveRequest('save')
    await settle()
    expect(fake.acks).toEqual([false])
    expect(fake.saves).toEqual([])
    // and Ctrl+S does nothing
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))
    await settle()
    expect(fake.saves).toEqual([])
    // a question for the outline is answered with a reason, not with a map
    fake.emit.outlineRequest()
    expect(fake.outlines).toEqual([{ error: expect.any(String) }])
  })

  it('bytes the main process let through but the engine here refuses are shown the same way', async () => {
    const fake = fakeApi('C:/maps/x.xmind', { status: 'ok', bytes: new Uint8Array([1, 2, 3]) })
    await mountApp(fake)
    expect(container.textContent).toBe('This file cannot be read')
    expect(fake.saves).toEqual([])
  })
})

describe('a file that opens', () => {
  it('tells once what the editor does not show, and that the map has the default look', async () => {
    await openWith(richSheet())
    const notices = [...container.querySelectorAll('.mm-notice-text')].map(
      (node) => node.textContent,
    )
    expect(notices).toEqual([
      `This file has ${RICH_PRESERVED} elements that are not shown here. Saving does not delete them. Only those attached to a topic you delete yourself are deleted with it.`,
      "This map is shown here with the default look. The file's theme is not changed.",
    ])
    await click('[data-notice="preserved"] [data-action="notice-close"]')
    expect(container.querySelectorAll('.mm-notice')).toHaveLength(1)
  })

  it('a file with nothing hidden and no foreign theme has no notice', async () => {
    await openWith(plainSheet())
    expect(container.querySelector('.mm-notice')).toBeNull()
  })

  it('a sheet name from the file is text', async () => {
    const hostile = '<img src=x onerror="window.pwned=1"><u>name</u>'
    await openWith(plainSheet(hostile))
    expect(container.querySelector('.mm-sheet-name')!.textContent).toBe(hostile)
    expect(container.querySelectorAll('.mm-foot img, .mm-foot u')).toHaveLength(0)
  })

  it('a note from the file is shown as text in its editor', async () => {
    const hostile = '<img src=x onerror="window.pwned=1"> note'
    const sheet = plainSheet()
    const first = sheet.rootTopic.children!.attached![0]!
    first.notes = { plain: { content: hostile } }
    await openWith(sheet)
    await act(async () => {
      topicEl(first.id).querySelector<HTMLElement>('.mm-chip-note')!.click()
    })
    await settle()
    const field = document.querySelector<HTMLTextAreaElement>(
      '[data-dialog="topic-note"] textarea',
    )!
    expect(field.value).toBe(hostile)
    expect(document.querySelectorAll('.mm-modal img')).toHaveLength(0)
  })

  it('opening changes nothing: the unsaved mark stays off and a save hands over the original bytes', async () => {
    const { fake, bytes } = await openWith(richSheet(), plainSheet())
    expect(fake.dirty.at(-1)).toBe(false)
    await click('[data-action="save"]')
    expect(fake.saves).toHaveLength(1)
    expect(fake.saves[0]!.mode).toBe('save')
    expect(fake.saves[0]!.bytes).toEqual(bytes)
  })
})

describe('a new map', () => {
  it("has one sheet and one central topic named in the user's language, and is not dirty", async () => {
    const fake = fakeApi(null, null)
    await mountApp(fake)
    expect([...container.querySelectorAll('.mm-sheet-name')].map((tab) => tab.textContent)).toEqual(
      ['Sheet 1'],
    )
    expect(container.querySelector('me-root me-tpc .text')!.textContent).toBe('Central Topic')
    expect(fake.dirty.at(-1)).toBe(false)

    await click('[data-action="save"]')
    const reopened = await openXmind(fake.saves[0]!.bytes)
    expect(reopened.status).toBe('ok')
    // still named by default: the dialog is left to offer "Untitled"
    expect(fake.saves[0]!.defaultName).toBeUndefined()
  })
})

describe('sheets', () => {
  it('the only sheet cannot be deleted', async () => {
    await openWith(plainSheet())
    const button = container.querySelector<HTMLButtonElement>('[data-action="sheet-delete"]')!
    expect(button.disabled).toBe(true)
    expect(button.dataset.tip).toBe('The last sheet cannot be deleted.')
  })

  it('deleting asks first, says it cannot be undone, and only then deletes', async () => {
    const { fake } = await openWith(plainSheet('Keep'), plainSheet('Drop'))
    await click('.mm-sheet:nth-child(2) .mm-sheet-name')
    await click('[data-action="sheet-delete"]')
    const dialog = document.querySelector('[data-dialog="delete-sheet"]')!
    expect(dialog.textContent).toContain(
      'The sheet "Drop" and everything on it will be deleted. This cannot be undone.',
    )
    await click('[data-action="confirm-cancel"]')
    expect(container.querySelectorAll('.mm-sheet')).toHaveLength(2)
    expect(fake.dirty.at(-1)).toBe(false)

    await click('[data-action="sheet-delete"]')
    await click('[data-action="confirm-ok"]')
    expect([...container.querySelectorAll('.mm-sheet-name')].map((tab) => tab.textContent)).toEqual(
      ['Keep'],
    )
    expect(fake.dirty.at(-1)).toBe(true)
  })

  it('adding a sheet needs no question and shows the new sheet', async () => {
    await openWith(plainSheet('Only'))
    await click('[data-action="sheet-add"]')
    expect(document.querySelector('.mm-modal')).toBeNull()
    expect([...container.querySelectorAll('.mm-sheet-name')].map((tab) => tab.textContent)).toEqual(
      ['Only', 'Sheet 2'],
    )
    expect(container.querySelector('.mm-sheet.on .mm-sheet-name')!.textContent).toBe('Sheet 2')
    expect(
      container.querySelector('.mm-sheet-host:not([hidden]) me-root me-tpc .text')!.textContent,
    ).toBe('Central Topic')
  })
})

describe('deleting a topic from the screen', () => {
  it('shows the number of hidden elements and deletes only after "Delete"', async () => {
    await openWith(richSheet())
    await selectOnMap(IDS.a)
    await pressOnMap('Delete')
    const dialog = document.querySelector('[data-dialog="delete-hidden"]')!
    expect(dialog.textContent).toContain(
      '3 elements that are not shown here will be deleted with it.',
    )
    await click('[data-action="confirm-cancel"]')
    expect(container.querySelector(`[data-nodeid="me${IDS.a}"]`)).not.toBeNull()

    await pressOnMap('Delete')
    await click('[data-action="confirm-ok"]')
    expect(container.querySelector(`[data-nodeid="me${IDS.a}"]`)).toBeNull()
  })

  it('asks nothing when nothing hidden goes with the topic', async () => {
    await openWith(richSheet())
    await selectOnMap(IDS.b)
    await pressOnMap('Delete')
    expect(document.querySelector('.mm-modal')).toBeNull()
    expect(container.querySelector(`[data-nodeid="me${IDS.b}"]`)).toBeNull()
  })
})

describe('the menu', () => {
  it("Undo from the menu reaches the map's own history, and the save is the original bytes again", async () => {
    const { fake, bytes } = await openWith(richSheet())
    await selectOnMap(IDS.b)
    await pressOnMap('Delete')
    expect(fake.dirty.at(-1)).toBe(true)

    await act(async () => fake.emit.menu('undo'))
    await settle()
    expect(container.querySelector(`[data-nodeid="me${IDS.b}"]`)).not.toBeNull()
    expect(fake.dirty.at(-1)).toBe(false)

    fake.emit.saveRequest('save')
    await settle()
    expect(fake.saves[0]!.bytes).toEqual(bytes)

    await act(async () => fake.emit.menu('redo'))
    await settle()
    expect(container.querySelector(`[data-nodeid="me${IDS.b}"]`)).toBeNull()
  })

  it('answers a question for the outline with the map as it stands', async () => {
    const { fake } = await openWith(plainSheet())
    fake.emit.outlineRequest()
    expect(fake.outlines).toHaveLength(1)
    expect((fake.outlines[0] as { text: string }).text).toContain('Center')
  })
})
