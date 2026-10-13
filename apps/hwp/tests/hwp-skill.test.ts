import { describe, expect, it, vi } from 'vitest'
import type { AgentToolCall } from '@genoffice/agent-core'
import type { AgentBridge } from '../src/renderer/ai/agent-bridge'
import {
  CONTEXT_MAX_CHARS,
  READ_PAGE_CHARS,
  createHwpSkill,
  type HwpChange,
} from '../src/renderer/ai/hwp-skill'

function setup(overrides: Partial<AgentBridge> = {}) {
  const bridge: AgentBridge = {
    foreignChanges: vi.fn(async () => 0),
    readText: vi.fn(async () => '제목\n본문입니다'),
    findText: vi.fn(async () => ({ count: 0, matches: [] })),
    replaceText: vi.fn(async () => ({ ok: true as const, count: 1, inTable: false })),
    replaceAllText: vi.fn(async () => ({ ok: true as const, count: 3 })),
    insertParagraphs: vi.fn(async () => ({ ok: true as const, count: 2, inTable: false })),
    deleteParagraph: vi.fn(async () => ({
      ok: true as const,
      text: '지울 문단입니다.',
      emptied: false,
      inTable: false,
    })),
    insertTable: vi.fn(async () => ({ ok: true as const, rows: 2, cols: 3, inTable: false })),
    listFields: vi.fn(async () => []),
    fillField: vi.fn(async () => ({ ok: true as const, name: '성명' })),
    undo: vi.fn(async () => ({ ok: true, undone: 1 })),
    ...overrides,
  }
  const changes: HwpChange[] = []
  const { skill, refreshContext } = createHwpSkill({
    bridge,
    // the key and its parameters, so a test can tell which label was asked for
    label: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
    onChange: (change) => changes.push(change),
  })
  const call = (name: string, input: Record<string, unknown> = {}) =>
    skill.executeTool({ id: '1', name, input } satisfies AgentToolCall)
  return { bridge, skill, refreshContext, changes, call }
}

describe('the document context sent with a message', () => {
  it('is empty until it has been read', () => {
    expect(setup().skill.buildContext!()).toBe('')
  })

  it('carries a short document whole, with its field names', async () => {
    const { skill, refreshContext } = setup({
      listFields: async () => [
        { field: 1, name: '성명', guide: '', value: '', inCell: false },
        { field: 2, name: '', guide: '날짜를 쓰세요', value: '', inCell: false },
      ],
    })
    await refreshContext()
    const context = skill.buildContext!()
    expect(context).toContain('Text (complete):\n제목\n본문입니다')
    // numbered, because the number is what fill_field takes
    expect(context).toContain('Form fields (2): 1. 성명, 2. 날짜를 쓰세요')
  })

  it('carries only the opening of a long document and points at read_document', async () => {
    const long = '가'.repeat(CONTEXT_MAX_CHARS + 500)
    const { skill, refreshContext } = setup({ readText: async () => long })
    await refreshContext()
    const context = skill.buildContext!()
    expect(context).toContain(`Length: ${long.length} characters.`)
    expect(context).toContain('read_document returns the rest')
    expect(context.length).toBeLessThan(CONTEXT_MAX_CHARS + 400)
  })

  it('says so when the document cannot be read, instead of failing the send', async () => {
    const { skill, refreshContext } = setup({
      readText: async () => {
        throw new Error('gone')
      },
    })
    await expect(refreshContext()).resolves.toBeUndefined()
    expect(skill.buildContext!()).toContain('could not be read')
  })
})

describe('read_document', () => {
  it('pages through a long document', async () => {
    const long = 'a'.repeat(READ_PAGE_CHARS) + 'TAIL'
    const { call } = setup({ readText: async () => long })
    const first = await call('read_document')
    expect(first.output).toContain(`[more: call read_document with offset ${READ_PAGE_CHARS}]`)
    expect(first.mutated).toBeUndefined()
    const second = await call('read_document', { offset: READ_PAGE_CHARS })
    expect(second.output.endsWith('TAIL')).toBe(true)
  })
})

describe('find_text', () => {
  it('lists the occurrences with their surroundings', async () => {
    const { call } = setup({
      findText: async () => ({
        count: 25,
        matches: [
          { occurrence: 1, inTable: false, context: '제1조 구매대행 계약' },
          { occurrence: 2, inTable: true, context: '구매대행 수수료' },
          { occurrence: 3, inTable: false, replaceable: false },
        ],
      }),
    })
    const result = await call('find_text', { text: '구매대행' })
    expect(result.output).toContain('25 occurrence(s).')
    expect(result.output).toContain('#1: …제1조 구매대행 계약…')
    expect(result.output).toContain('#2 (in a table): …구매대행 수수료…')
    expect(result.output).toContain('#3: inside an equation')
    expect(result.output).toContain('only the first 3 are listed')
    expect(result.summary).toBe('aiToolFind:{"text":"구매대행","count":25}')
  })
})

describe('replace_text', () => {
  it('reports the change to the panel and marks the run as having edited', async () => {
    const { call, changes, bridge } = setup()
    const result = await call('replace_text', { find: '본문', replace: '내용' })
    expect(bridge.replaceText).toHaveBeenCalledWith('본문', '내용', null)
    expect(result).toMatchObject({ mutated: true, summary: '“본문” → “내용”' })
    expect(changes).toEqual([{ kind: 'replace', from: '본문', to: '내용', count: 1 }])
  })

  it('passes the occurrence on', async () => {
    const { call, bridge } = setup()
    await call('replace_text', { find: '본문', replace: '내용', occurrence: 2 })
    expect(bridge.replaceText).toHaveBeenCalledWith('본문', '내용', 2)
  })

  it('tells the model how to disambiguate, and records no change', async () => {
    const { call, changes } = setup({
      replaceText: async () => ({
        ok: false,
        reason: 'ambiguous',
        count: 2,
        matches: [
          { occurrence: 1, inTable: false, context: '앞 가격 뒤' },
          { occurrence: 2, inTable: false, context: '또 가격 끝' },
        ],
      }),
    })
    const result = await call('replace_text', { find: '가격', replace: '금액' })
    expect(result.isError).toBe(true)
    expect(result.mutated).toBeUndefined()
    expect(result.output).toContain('occurs 2 times')
    expect(result.output).toContain('#2: …또 가격 끝…')
    expect(result.summary).toBe('aiToolNotDone:{"what":"가격"}')
    expect(changes).toEqual([])
  })

  it('never sends text with a line break to the editor', async () => {
    const { call, bridge } = setup()
    const result = await call('replace_text', { find: '본문', replace: '첫 줄\n둘째 줄' })
    expect(result.isError).toBe(true)
    expect(result.output).toContain('line break')
    expect(bridge.replaceText).not.toHaveBeenCalled()
  })

  it('accepts an empty replacement as a deletion', async () => {
    const { call, bridge } = setup()
    expect((await call('replace_text', { find: '본문', replace: '' })).mutated).toBe(true)
    expect(bridge.replaceText).toHaveBeenCalledWith('본문', '', null)
  })

  it('turns a refusal of the editor into an error result the model can read', async () => {
    const { call, changes } = setup({
      replaceText: async () => {
        throw new Error('the editor refused to replace')
      },
    })
    const result = await call('replace_text', { find: '본문', replace: '내용' })
    expect(result).toMatchObject({ isError: true, output: 'the editor refused to replace' })
    expect(changes).toEqual([])
  })
})

describe('replace_all', () => {
  it('reports one change covering every place', async () => {
    const { call, changes } = setup()
    const result = await call('replace_all', { find: '갑', replace: '발주처' })
    expect(result).toMatchObject({ mutated: true, summary: '“갑” → “발주처” ×3' })
    expect(changes).toEqual([{ kind: 'replaceAll', from: '갑', to: '발주처', count: 3 }])
  })

  it('reports a text that is not there', async () => {
    const { call, changes } = setup({
      replaceAllText: async () => ({ ok: false, reason: 'not_found', count: 0 }),
    })
    expect((await call('replace_all', { find: '없음', replace: 'x' })).isError).toBe(true)
    expect(changes).toEqual([])
  })
})

describe('insert_paragraphs', () => {
  it('adds the paragraphs next to the anchor and reports one change', async () => {
    const { call, changes, bridge } = setup()
    const result = await call('insert_paragraphs', {
      where: 'after',
      anchor: '본문입니다',
      paragraphs: ['ㅇ 첫째 항목', '', 'ㅇ 둘째 항목'],
    })
    expect(bridge.insertParagraphs).toHaveBeenCalledWith('본문입니다', null, 'after', [
      'ㅇ 첫째 항목',
      '',
      'ㅇ 둘째 항목',
    ])
    expect(result).toMatchObject({ mutated: true, summary: 'aiToolInsert:{"count":2}' })
    // empty lines are layout, not content: the list shows the text that came in
    expect(changes).toEqual([
      { kind: 'insert', from: '', to: 'ㅇ 첫째 항목 ⏎ ㅇ 둘째 항목', count: 1 },
    ])
  })

  it('needs no anchor for the end of the document', async () => {
    const { call, bridge } = setup()
    expect((await call('insert_paragraphs', { where: 'end', paragraphs: ['끝.'] })).mutated).toBe(
      true,
    )
    expect(bridge.insertParagraphs).toHaveBeenCalledWith('', null, 'end', ['끝.'])
  })

  it('asks for an anchor otherwise, and for one-line paragraphs', async () => {
    const { call, bridge } = setup()
    expect((await call('insert_paragraphs', { where: 'after', paragraphs: ['x'] })).isError).toBe(
      true,
    )
    expect(
      (await call('insert_paragraphs', { where: 'beside', anchor: 'a', paragraphs: ['x'] }))
        .isError,
    ).toBe(true)
    const broken = await call('insert_paragraphs', {
      where: 'after',
      anchor: '본문',
      paragraphs: ['한 줄\n두 줄'],
    })
    expect(broken.output).toContain('line break')
    expect(bridge.insertParagraphs).not.toHaveBeenCalled()
  })

  it('tells the model when an object is in the way', async () => {
    const { call, changes } = setup({
      insertParagraphs: async () => ({ ok: false, reason: 'has_objects', count: 1 }),
    })
    const result = await call('insert_paragraphs', {
      where: 'before',
      anchor: '제목',
      paragraphs: ['x'],
    })
    expect(result.isError).toBe(true)
    expect(result.output).toContain('a table, a picture or a form field')
    expect(result.summary).toBe('aiToolNotDone:{"what":"제목"}')
    expect(changes).toEqual([])
  })

  it('lists the places when the anchor is ambiguous', async () => {
    const { call } = setup({
      insertParagraphs: async () => ({
        ok: false,
        reason: 'ambiguous',
        count: 2,
        matches: [
          { occurrence: 1, inTable: false, context: '첫 문단' },
          { occurrence: 2, inTable: true, context: '표 안 문단' },
        ],
      }),
    })
    const result = await call('insert_paragraphs', {
      where: 'after',
      anchor: '문단',
      paragraphs: ['x'],
    })
    expect(result.output).toContain('occurs 2 times')
    expect(result.output).toContain('#2 (in a table): …표 안 문단…')
  })
})

describe('delete_paragraph', () => {
  it('reports the removed text as a change', async () => {
    const { call, changes, bridge } = setup()
    const result = await call('delete_paragraph', { find: '지울 문단', occurrence: 2 })
    expect(bridge.deleteParagraph).toHaveBeenCalledWith('지울 문단', 2)
    expect(result).toMatchObject({ mutated: true, output: 'Removed the paragraph.' })
    expect(changes).toEqual([{ kind: 'delete', from: '지울 문단입니다.', to: '', count: 1 }])
  })

  it('says so when the paragraph could only be emptied', async () => {
    const { call } = setup({
      deleteParagraph: async () => ({ ok: true, text: '첫 줄', emptied: true, inTable: true }),
    })
    expect((await call('delete_paragraph', { find: '첫 줄' })).output).toContain('emptied')
  })
})

describe('insert_table', () => {
  it('adds the table and lists it by its first row', async () => {
    const { call, changes, bridge } = setup()
    const rows = [
      ['항목', '기한', '비고'],
      ['신청서', '3월 2일'],
    ]
    const result = await call('insert_table', { where: 'after', anchor: '본문입니다', rows })
    expect(bridge.insertTable).toHaveBeenCalledWith('본문입니다', null, 'after', rows)
    expect(result).toMatchObject({ mutated: true, summary: 'aiToolTable:{"rows":2,"cols":3}' })
    expect(changes).toEqual([{ kind: 'table', from: '', to: '항목 | 기한 | 비고', count: 1 }])
  })

  it('tells the model that a table cannot go inside a table', async () => {
    const { call, changes } = setup({
      insertTable: async () => ({ ok: false, reason: 'in_table', count: 1 }),
    })
    const result = await call('insert_table', { where: 'after', anchor: '대상', rows: [['가']] })
    expect(result.isError).toBe(true)
    expect(result.output).toContain('inside another table')
    expect(changes).toEqual([])
  })

  it('refuses rows that are not lists of one-line text', async () => {
    const { call, bridge } = setup()
    expect((await call('insert_table', { where: 'end', rows: [] })).isError).toBe(true)
    expect((await call('insert_table', { where: 'end', rows: [['가\n나']] })).isError).toBe(true)
    expect((await call('insert_table', { where: 'end', rows: ['가', '나'] })).isError).toBe(true)
    expect(bridge.insertTable).not.toHaveBeenCalled()
  })
})

describe('form fields', () => {
  it('lists them', async () => {
    const { call } = setup({
      listFields: async () => [
        { field: 1, name: '성명', guide: '이름을 쓰세요', value: '', inCell: false },
      ],
    })
    const result = await call('list_fields')
    expect(JSON.parse(result.output)).toEqual([
      { field: 1, name: '성명', guide: '이름을 쓰세요', value: '', inCell: false },
    ])
    expect(result.summary).toBe('aiToolFields:{"count":1}')
  })

  it('fills one and reports the change', async () => {
    const { call, changes, bridge } = setup()
    const result = await call('fill_field', { field: 1, value: '홍길동' })
    expect(bridge.fillField).toHaveBeenCalledWith(1, '홍길동')
    expect(result.mutated).toBe(true)
    // the change is listed under the number and the name the editor gave back
    expect(changes).toEqual([{ kind: 'field', from: '#1 성명', to: '홍길동', count: 1 }])
  })

  it('lists a field nobody named under its number alone', async () => {
    const { call, changes } = setup({ fillField: async () => ({ ok: true, name: '' }) })
    await call('fill_field', { field: 3, value: '홍길동' })
    expect(changes).toEqual([{ kind: 'field', from: '#3', to: '홍길동', count: 1 }])
  })

  it('points at list_fields for a number that is not there', async () => {
    const { call, changes } = setup({
      fillField: async () => ({ ok: false, reason: 'no_such_field', count: 2 }),
    })
    const result = await call('fill_field', { field: 7, value: 'x' })
    expect(result.isError).toBe(true)
    expect(result.output).toContain('the document has 2')
    expect(result.output).toContain('list_fields')
    expect(result.summary).toBe('aiToolNotDone:{"what":"#7"}')
    expect(changes).toEqual([])
  })

  it('never sends a value with a line break to the editor', async () => {
    const { call, bridge } = setup()
    expect((await call('fill_field', { field: 1, value: '홍\n길동' })).isError).toBe(true)
    expect(bridge.fillField).not.toHaveBeenCalled()
  })
})

describe('the skill as the model sees it', () => {
  it('offers exactly the tools it can execute', async () => {
    const { skill, call } = setup()
    expect(skill.tools.map((tool) => tool.name)).toEqual([
      'read_document',
      'find_text',
      'replace_text',
      'replace_all',
      'insert_paragraphs',
      'delete_paragraph',
      'insert_table',
      'list_fields',
      'fill_field',
    ])
    expect((await call('delete_everything')).isError).toBe(true)
  })

  it('names the product, not the upstream project', () => {
    expect(setup().skill.systemPrompt).not.toContain('GenOffice')
  })
})
