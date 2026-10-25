/**
 * Tools off: a model whose profile says it cannot call tools gets no tool
 * definitions and a system paragraph telling it to answer in text only. The
 * run id keeps one tool loop under one context-gate question.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  AgentLoop,
  TOOLS_UNAVAILABLE_NOTE,
  type AgentStreamCallbacks,
  type AgentStreamRequest,
  type AgentSkill,
  type AgentToolCall,
  type AgentTransport,
  type ToolExecution,
} from '../src'

/** A transport that replays one scripted turn per request and records what it was asked */
function recordingTransport(
  script: Array<(cb: AgentStreamCallbacks) => void>,
): AgentTransport & { requests: AgentStreamRequest[] } {
  let turn = 0
  const transport = {
    requests: [] as AgentStreamRequest[],
    stream(request: AgentStreamRequest, cb: AgentStreamCallbacks) {
      transport.requests.push(request)
      const step = script[turn++]
      if (step) queueMicrotask(() => step(cb))
      return {
        cancel: () => {
          queueMicrotask(() => cb.onDone())
        },
      }
    },
  }
  return transport
}

function makeSkill(execute?: (call: AgentToolCall) => ToolExecution): AgentSkill {
  return {
    id: 'test',
    systemPrompt: 'system',
    tools: [
      { name: 'edit_text', description: 'Edits the document', inputSchema: { type: 'object' } },
    ],
    buildContext: () => 'CTX',
    executeTool: execute ?? (() => ({ output: 'ok', summary: 'edited', mutated: true })),
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('AgentLoop tools off', () => {
  it('sends no tools and the fixed paragraph when toolsAllowed is false', async () => {
    const transport = recordingTransport([(cb) => cb.onDone()])
    const loop = new AgentLoop({ transport, skill: makeSkill(), toolsAllowed: () => false })
    loop.run('q')
    await flush()
    expect(transport.requests[0]!.tools).toEqual([])
    expect(transport.requests[0]!.system).toContain(TOOLS_UNAVAILABLE_NOTE)
    expect(transport.requests[0]!.system).toContain('Answer in text only')
    expect(transport.requests[0]!.system).toContain('Do not claim to edit the document')
  })

  it('keeps the skill tools when toolsAllowed is true', async () => {
    const transport = recordingTransport([(cb) => cb.onDone()])
    const loop = new AgentLoop({ transport, skill: makeSkill(), toolsAllowed: () => true })
    loop.run('q')
    await flush()
    expect(transport.requests[0]!.tools.map((tool) => tool.name)).toEqual(['edit_text'])
    expect(transport.requests[0]!.system).not.toContain(TOOLS_UNAVAILABLE_NOTE)
  })

  it('keeps the skill tools when toolsAllowed is absent', async () => {
    const transport = recordingTransport([(cb) => cb.onDone()])
    const loop = new AgentLoop({ transport, skill: makeSkill() })
    loop.run('q')
    await flush()
    expect(transport.requests[0]!.tools.map((tool) => tool.name)).toEqual(['edit_text'])
    expect(transport.requests[0]!.system).not.toContain(TOOLS_UNAVAILABLE_NOTE)
  })

  it('keeps tools off for every turn of a multi-turn run', async () => {
    const transport = recordingTransport([
      (cb) => {
        cb.onToolCall({ id: 'c1', name: 'edit_text', input: {} })
        cb.onDone()
      },
      (cb) => {
        cb.onDelta('done')
        cb.onDone()
      },
    ])
    const execute = vi.fn(() => ({ output: 'ok', summary: 'edited', mutated: true }))
    const loop = new AgentLoop({
      transport,
      skill: makeSkill(execute),
      toolsAllowed: () => false,
    })
    loop.run('q')
    await flush()
    await flush()
    expect(transport.requests).toHaveLength(2)
    for (const request of transport.requests) {
      expect(request.tools).toEqual([])
      expect(request.system).toContain(TOOLS_UNAVAILABLE_NOTE)
    }
  })
})

describe('AgentLoop run id', () => {
  it('uses one run id for every turn of a run and a fresh one for the next run', async () => {
    const transport = recordingTransport([
      (cb) => {
        cb.onToolCall({ id: 'c1', name: 'edit_text', input: {} })
        cb.onDone()
      },
      (cb) => {
        cb.onDelta('done')
        cb.onDone()
      },
      (cb) => cb.onDone(),
    ])
    const loop = new AgentLoop({ transport, skill: makeSkill() })
    loop.run('first')
    await flush()
    await flush()
    loop.run('second')
    await flush()
    expect(transport.requests).toHaveLength(3)
    const [first, second, third] = transport.requests
    expect(first!.runId).toBeTruthy()
    expect(second!.runId).toBe(first!.runId)
    expect(third!.runId).toBeTruthy()
    expect(third!.runId).not.toBe(first!.runId)
  })

  it('marks the internal compaction summary as skipping the context gate', async () => {
    const transport = recordingTransport([
      (cb) => {
        cb.onDelta('first answer')
        cb.onDone()
      },
      (cb) => {
        cb.onDelta('second answer')
        cb.onDone()
      },
      (cb) => {
        cb.onDelta('a summary')
        cb.onDone()
      },
      (cb) => {
        cb.onDelta('third answer')
        cb.onDone()
      },
    ])
    const loop = new AgentLoop({
      transport,
      skill: makeSkill(),
      compaction: { maxBytes: 20, keepRecentBytes: 1 },
    })
    loop.run('x'.repeat(30))
    await flush()
    loop.run('y'.repeat(30))
    await flush()
    loop.run('z'.repeat(30))
    await flush()
    await flush()
    const summary = transport.requests.find((request) => request.tools.length === 0)
    expect(summary).toBeDefined()
    expect(summary!.skipContextGate).toBe(true)
    expect(summary!.runId).toBeUndefined()
    // the run's own turns carry the run id, so the gate asks once per run
    const turns = transport.requests.filter((request) => request !== summary)
    expect(turns.length).toBeGreaterThan(0)
    for (const request of turns) expect(request.runId).toBeTruthy()
  })
})
