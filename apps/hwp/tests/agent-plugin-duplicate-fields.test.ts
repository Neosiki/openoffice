/**
 * Click-here fields that share an id: a form whose fields were copied and pasted. The
 * engine sets a field's value by id, which reaches only the first of them; each field is
 * to be filled where it stands. Fixture: three fields, the first two with the same id.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import init, { HwpDocument } from '@rhwp/core'
import { agentPlugin, type AgentPluginHost } from '../studio-plugin/agent-plugin.mjs'

const require = createRequire(import.meta.url)

beforeAll(async () => {
  const wasm = join(dirname(require.resolve('@rhwp/core')), 'rhwp_bg.wasm')
  await init({ module_or_path: readFileSync(wasm) })
})

const FIXTURE = join(__dirname, 'fixtures', 'duplicate-field-ids.hwpx')

interface EngineField {
  fieldId: number
  value: string
}

function openForm(bytes: Uint8Array = readFileSync(FIXTURE)) {
  let doc = new HwpDocument(new Uint8Array(bytes))
  const host = {
    read: (fn: (d: never) => unknown) => fn(doc as never),
    transaction: (_label: string, fn: (tx: never) => unknown) => {
      const before = doc.exportHwp()
      try {
        return fn({ doc: () => doc, deferPagination: () => {} } as never)
      } catch (thrown) {
        doc = new HwpDocument(before)
        throw thrown
      }
    },
    events: { on: () => {} },
    automation: { execute: () => null },
  } as unknown as AgentPluginHost
  const plugin = agentPlugin.activate(host)
  return {
    plugin,
    doc: () => doc,
    fields: () => JSON.parse(doc.getFieldList()) as EngineField[],
  }
}

describe('fields that share an id', () => {
  it('start out sharing it', () => {
    const ids = openForm()
      .fields()
      .map((field) => field.fieldId)
    expect(ids[0]).toBe(ids[1])
    expect(ids[2]).not.toBe(ids[0])
  })

  it('fills the field asked for, not the first of its namesakes', () => {
    const form = openForm()
    expect(form.plugin.fillField(2, '총무과')).toMatchObject({ ok: true })
    expect(form.plugin.listFields().map((field) => field.value)).toEqual(['', '총무과', ''])
    expect(form.plugin.fillField(1, '홍길동')).toMatchObject({ ok: true })
    expect(form.plugin.fillField(3, '010-0000-0000')).toMatchObject({ ok: true })
    expect(form.plugin.listFields().map((field) => field.value)).toEqual([
      '홍길동',
      '총무과',
      '010-0000-0000',
    ])
  })

  it('writes over a value already there', () => {
    const form = openForm()
    form.plugin.fillField(1, '홍길동')
    form.plugin.fillField(2, '총무과')
    expect(form.plugin.fillField(2, '기획과')).toMatchObject({ ok: true })
    expect(form.plugin.listFields().map((field) => field.value)).toEqual(['홍길동', '기획과', ''])
  })

  it('keeps each value through saving as HWP and as HWPX', () => {
    const form = openForm()
    form.plugin.fillField(1, '홍길동')
    form.plugin.fillField(2, '총무과')
    for (const bytes of [form.doc().exportHwp(), form.doc().exportHwpx()]) {
      expect(
        openForm(bytes)
          .fields()
          .map((field) => field.value),
      ).toEqual(['홍길동', '총무과', ''])
    }
  })
})
