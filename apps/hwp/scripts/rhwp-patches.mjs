/**
 * The source patches this app applies to rhwp when it builds it. Each one is
 * an exact-text replacement that fails loudly when the text is gone, so an
 * rhwp upgrade cannot drop one silently.
 *
 * sdk-scheme, studio-scheme
 *   rhwp's embed bridge accepts only http(s) origins, on both ends: the SDK
 *   (`@rhwp/editor`) refuses a studio URL on any other scheme, and the studio
 *   ignores a parent whose origin is not http(s). The packaged app serves every
 *   renderer from the privileged `genoffice-app` scheme, so both checks have to
 *   admit that one scheme as well.
 *
 * studio-password-flag
 *   The bridge's export calls write plain bytes even for a document that was
 *   opened with a password; only the studio's own Save, which embed mode
 *   removes, asks for the password again. The studio knows the document is
 *   protected but does not say so over the bridge, so its command context
 *   gains one field and the host can refuse to write such a document.
 *
 * studio-plugin-allow
 *   The studio loads plugins only from a list compiled into it, and in a
 *   production build that list holds its own HwpCtrl plugin alone. The AI
 *   panel edits the document through this app's plugin
 *   (studio-plugin/agent-plugin.mjs), so the list gains that one name.
 */

/** Must equal RENDERER_SCHEME in packages/electron-utils/src/renderer-scheme.ts. */
export const APP_SCHEME = 'genoffice-app'

/** Field the studio-password-flag patch adds to the studio's command context. */
export const PASSWORD_FLAG = 'passwordProtected'

/** Module specifier the studio-plugin-allow patch imports; build-studio.mjs aliases it. */
export const AGENT_PLUGIN_MODULE = '@ieum/agent-plugin'

const PATCHES = {
  'sdk-scheme': {
    file: /[\\/]@rhwp[\\/]editor[\\/]transport\.js$/,
    find: "if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {",
    replace: `if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:' && targetUrl.protocol !== '${APP_SCHEME}:') {`,
  },
  'studio-scheme': {
    file: /[\\/]rhwp-studio[\\/]src[\\/]embed[\\/]protocol\.ts$/,
    find: "return protocol === 'http:' || protocol === 'https:';",
    replace: `return protocol === 'http:' || protocol === 'https:' || protocol === '${APP_SCHEME}:';`,
  },
  'studio-password-flag': {
    file: /[\\/]rhwp-studio[\\/]src[\\/]main\.ts$/,
    find: '    isDirty: documentState.isDirty(),',
    replace: `    isDirty: documentState.isDirty(),\n    ${PASSWORD_FLAG}: wasm.requiresPasswordForSave,`,
  },
  'studio-plugin-allow': {
    file: /[\\/]rhwp-studio[\\/]src[\\/]main\.ts$/,
    find: "  if (import.meta.env.DEV && id === 'dev-probe') {",
    replace:
      "  if (id === 'ieum-agent') {\n" +
      `    return (await import('${AGENT_PLUGIN_MODULE}')).agentPlugin as StudioPlugin;\n` +
      '  }\n' +
      "  if (import.meta.env.DEV && id === 'dev-probe') {",
  },
}

/**
 * @param {keyof typeof PATCHES} name
 * @param {string} code
 * @returns {string}
 */
export function applyPatch(name, code) {
  const patch = PATCHES[name]
  if (!patch) throw new Error(`rhwp patch: unknown patch "${name}"`)
  const first = code.indexOf(patch.find)
  if (first === -1 || code.indexOf(patch.find, first + 1) !== -1) {
    throw new Error(
      `rhwp patch ${name}: expected exactly one occurrence of the text to replace; ` +
        'the upstream source changed, review apps/hwp/scripts/rhwp-patches.mjs',
    )
  }
  return code.replace(patch.find, patch.replace)
}

/**
 * Vite plugin applying the named patches during a production build. Dev
 * servers load the renderer over http://localhost, where the unpatched SDK
 * check already passes; the studio is always a production build.
 *
 * @param {...keyof typeof PATCHES} names
 * @returns {import('vite').Plugin}
 */
export function rhwpPatches(...names) {
  const applied = new Set()
  return {
    name: `rhwp-patches:${names.join('+')}`,
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0]
      let next = code
      for (const name of names) {
        if (!PATCHES[name].file.test(file)) continue
        next = applyPatch(name, next)
        applied.add(name)
      }
      return next === code ? null : { code: next, map: null }
    },
    buildEnd() {
      const missing = names.filter((name) => !applied.has(name))
      if (missing.length > 0) {
        this.error(`rhwp patches never applied: ${missing.join(', ')} (file not loaded)`)
      }
    },
  }
}
