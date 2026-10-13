import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { NsisUpdater } from 'electron-updater/out/NsisUpdater'
import { PRODUCT_REPO_NAME, PRODUCT_REPO_OWNER } from '@genoffice/i18n'

/**
 * What the update feed is configured to be, as opposed to how the updater
 * behaves on it (updater.test.ts): the installer is built unsigned and must
 * still be able to update itself from the product's GitHub Releases, and
 * nothing of the upstream vendor's update service is left in the updater.
 */

const require = createRequire(import.meta.url)
const SHELL = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = join(SHELL, '../..')

/** The packaging config as a build host with this environment would load it
 * (same approach as product-identity.test.ts). */
function loadBuilderConfig(env: Record<string, string> = {}) {
  const configModule = { exports: {} as ReturnType<typeof require> }
  runInNewContext(readFileSync(join(SHELL, 'electron-builder.cjs'), 'utf8'), {
    module: configModule,
    __dirname: SHELL,
    process: { platform: 'win32', arch: 'x64', env: { ...env } },
    require: (id: string) =>
      id === 'node:fs' ? { ...require(id), existsSync: () => true } : require(id),
  })
  return configModule.exports
}

describe('unsigned Windows builds can update', () => {
  /**
   * electron-updater 6.8.9, NsisUpdater.verifySignature: the downloaded
   * installer's Authenticode signature is compared against `publisherName`
   * from the installed app's app-update.yml — and only when that key exists.
   * This runs the dependency's own method on the two shapes of that file.
   */
  const verifySignature = (appUpdateYml: Record<string, unknown>) => {
    const verify = vi.fn(() => Promise.resolve<string | null>('not signed by the publisher'))
    const outcome = (
      NsisUpdater.prototype as unknown as {
        verifySignature(this: unknown, file: string): Promise<string | null>
      }
    ).verifySignature.call(
      {
        configOnDisk: { value: Promise.resolve(appUpdateYml) },
        _verifyUpdateCodeSignature: verify,
      },
      'C:\\cache\\pending\\IeumOffice-Setup-0.2.0.exe',
    )
    return { outcome, verify }
  }

  it('skips the signature check when app-update.yml names no publisher', async () => {
    const { outcome, verify } = verifySignature({
      provider: 'github',
      owner: PRODUCT_REPO_OWNER,
      repo: PRODUCT_REPO_NAME,
      updaterCacheDirName: 'ieumoffice-updater',
    })
    // null is "nothing wrong": NsisUpdater goes on to install the download
    await expect(outcome).resolves.toBeNull()
    expect(verify).not.toHaveBeenCalled()
  })

  it('would enforce it as soon as a publisher is baked in', async () => {
    const { outcome, verify } = verifySignature({
      provider: 'github',
      owner: PRODUCT_REPO_OWNER,
      repo: PRODUCT_REPO_NAME,
      publisherName: ['Some Publisher'],
    })
    await expect(outcome).resolves.toBe('not signed by the publisher')
    expect(verify).toHaveBeenCalledWith(['Some Publisher'], expect.any(String))
  })

  it('the packaging config bakes in no publisher and configures no signing', () => {
    // electron-builder 26 writes app-update.yml from publish[0] and adds
    // publisherName only from a signing certificate it was configured with
    // (app-builder-lib PublishManager.getAppUpdatePublishConfiguration)
    const config = loadBuilderConfig()
    expect(config.publish).toEqual([
      { provider: 'github', owner: PRODUCT_REPO_OWNER, repo: PRODUCT_REPO_NAME },
    ])
    expect(config.win.signtoolOptions).toBeUndefined()
    expect(config.win.azureSignOptions).toBeUndefined()
    expect(config.win.verifyUpdateCodeSignature).not.toBe(true)
    // the vendor's feed variable no longer selects anything
    expect(
      loadBuilderConfig({ GENOFFICE_UPDATE_URL: 'https://updates.example.test/x' }).publish,
    ).toEqual(config.publish)
  })
})

describe('no trace of the upstream update service', () => {
  const sources = [
    'apps/shell/src/main/updater.ts',
    'apps/shell/src/main/update-window.ts',
    'apps/shell/src/main/update-resume.ts',
    'apps/shell/src/shared/update-api.ts',
    'apps/shell/src/preload/update.ts',
    'apps/shell/src/renderer/src/update.ts',
    'apps/shell/src/renderer/update.html',
  ]

  it.each(sources)('%s names no vendor feed, CDN or URL', (file) => {
    const text = readFileSync(join(ROOT, file), 'utf8')
    expect(text).not.toMatch(/azure/i)
    expect(text).not.toContain('GENOFFICE_UPDATE_URL')
    // no literal address at all: every link comes from the repository constants
    expect(text).not.toMatch(/https?:\/\//)
  })

  it('the updater takes its download links from the repository constants', () => {
    const text = readFileSync(join(ROOT, 'apps/shell/src/main/updater.ts'), 'utf8')
    expect(text).toContain('GITHUB_LATEST_RELEASE_URL')
    // and no longer derives one from the feed file on disk
    expect(text).not.toContain("from 'node:fs'")
  })
})
