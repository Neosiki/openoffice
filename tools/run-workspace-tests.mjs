/**
 * Run every workspace's `npm run test`, several workspaces at a time.
 *
 * The root `npm test` used to chain 32 `npm run test -w …` calls, so a
 * workspace that mostly waits (a Chromium page load, a jsdom start-up) kept
 * every core idle until it finished. Running a few workspaces side by side
 * overlaps those waits. Each workspace's output is held back and printed in
 * one piece when it ends, so logs do not interleave; a summary table follows.
 *
 * TEST_JOBS=<n> sets how many workspaces run at once (TEST_JOBS=1 is the old
 * serial run, for debugging). Exits 1 when any workspace failed.
 *
 * Each vitest starts a worker per core by default, so a few suites at once
 * would put several times the core count of CPU-bound workers on the machine:
 * a test that takes 2 s alone then ran past its 20 s timeout. Unless
 * VITEST_MAX_WORKERS is set, each workspace gets about twice its share of
 * the cores instead.
 */
import { spawn } from 'node:child_process'
import { availableParallelism } from 'node:os'

const WORKSPACES = [
  '@genoffice/i18n',
  '@genoffice/electron-utils',
  '@genoffice/font-metrics',
  '@genoffice/zip-gate',
  '@genoffice/google-drive',
  '@genoffice/xmind-engine',
  '@genoffice/docx-engine',
  '@genoffice/odt-engine',
  '@genoffice/pdf2docx',
  '@genoffice/pdf-structure',
  '@genoffice/html2docx',
  '@genoffice/file-parse',
  '@genoffice/pptx-engine',
  '@genoffice/xlsx-gateway',
  '@genoffice/pptx-ops',
  '@genoffice/pptx-render',
  '@genoffice/pipelines',
  '@genoffice/ai-search',
  '@genoffice/agent-core',
  '@genoffice/ai-provider',
  '@genoffice/project-store',
  '@genoffice/cli',
  '@genoffice/ui',
  '@genoffice/docs',
  '@genoffice/sheets',
  '@genoffice/shell',
  '@genoffice/slides',
  '@genoffice/pdf',
  '@genoffice/markdown',
  '@genoffice/html',
  '@genoffice/mindmap',
  '@genoffice/hwp',
]

/**
 * Workspaces that must wait for another one to finish. The sheets test script
 * rebuilds the xlsx sidecar, which the cli tests execute: started together,
 * the cli could run a binary that cargo is still writing.
 */
const AFTER = { '@genoffice/cli': ['@genoffice/sheets'] }

/** Started first: the longest workspaces, so none of them is left to run alone at the end */
const FIRST = [
  '@genoffice/docs',
  '@genoffice/sheets',
  '@genoffice/html2docx',
  '@genoffice/slides',
  '@genoffice/markdown',
]

function jobCount() {
  const fromEnv = Number.parseInt(process.env.TEST_JOBS ?? '', 10)
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv
  // most suites already use every core on their own; a few at once is enough
  // to fill the gaps without thrashing
  return Math.max(2, Math.min(4, Math.floor(availableParallelism() / 4)))
}

function workerEnv(jobs) {
  if (process.env.VITEST_MAX_WORKERS || jobs === 1) return process.env
  const workers = Math.max(2, Math.floor((availableParallelism() * 2) / jobs))
  return { ...process.env, VITEST_MAX_WORKERS: String(workers) }
}

function runWorkspace(name, env) {
  return new Promise((resolve) => {
    const started = Date.now()
    // npm sets npm_execpath for scripts; going through node avoids needing a
    // shell for npm.cmd on Windows
    const npmCli = process.env.npm_execpath
    const child = npmCli
      ? spawn(process.execPath, [npmCli, 'run', 'test', '-w', name], { env })
      : spawn('npm', ['run', 'test', '-w', name], {
          env,
          shell: process.platform === 'win32',
        })
    const chunks = []
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.stderr.on('data', (chunk) => chunks.push(chunk))
    child.on('error', (error) => chunks.push(Buffer.from(`${error.message}\n`)))
    child.on('close', (code) => {
      resolve({ name, code: code ?? 1, seconds: (Date.now() - started) / 1000, chunks })
    })
  })
}

async function main() {
  const jobs = jobCount()
  const env = workerEnv(jobs)
  const queue = [...FIRST, ...WORKSPACES.filter((name) => !FIRST.includes(name))]
  const done = new Set()
  const results = []
  const started = Date.now()
  let running = 0

  await new Promise((resolveAll) => {
    const next = () => {
      if (queue.length === 0 && running === 0) {
        resolveAll()
        return
      }
      while (running < jobs) {
        const index = queue.findIndex((name) => (AFTER[name] ?? []).every((dep) => done.has(dep)))
        if (index === -1) return
        const [name] = queue.splice(index, 1)
        running++
        void runWorkspace(name, env).then((result) => {
          running--
          done.add(name)
          results.push(result)
          const mark = result.code === 0 ? 'ok' : 'FAILED'
          process.stdout.write(`\n── ${name} (${mark}, ${result.seconds.toFixed(1)} s) ──\n`)
          process.stdout.write(Buffer.concat(result.chunks))
          next()
        })
      }
    }
    next()
  })

  const failed = results.filter((result) => result.code !== 0)
  const workers = env.VITEST_MAX_WORKERS
    ? `, up to ${env.VITEST_MAX_WORKERS} vitest workers each`
    : ''
  process.stdout.write(`\nworkspace tests, ${jobs} at a time${workers}:\n`)
  for (const result of [...results].sort((a, b) => b.seconds - a.seconds)) {
    const mark = result.code === 0 ? 'ok    ' : 'FAILED'
    process.stdout.write(`  ${mark} ${result.seconds.toFixed(1).padStart(6)} s  ${result.name}\n`)
  }
  const total = ((Date.now() - started) / 1000).toFixed(1)
  process.stdout.write(`${results.length} workspaces in ${total} s, ${failed.length} failed\n`)
  if (failed.length > 0) {
    process.stdout.write(`failed: ${failed.map((result) => result.name).join(', ')}\n`)
    process.exitCode = 1
  }
}

await main()
