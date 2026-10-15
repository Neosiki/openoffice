import { randomBytes } from 'node:crypto'
import { isInsidePath, comparablePath } from '@genoffice/ai-provider/agent-session'
import { redactHtmlSource, redactMarkdownSource } from '@genoffice/file-parse'
import { McpServerService, type McpToolDefinition } from '../mcp/mcp-server'
import { createDocumentTools, type DocsControl } from '../mcp/tools/document-tools'
import { createHwpTools } from '../mcp/tools/hwp-tools'
import {
  createOpenDocumentTools,
  type OpenDocumentsControl,
} from '../mcp/tools/open-documents-tools'
import { createPdfTools } from '../mcp/tools/pdf-tools'
import { createSessionHost, type TargetResolver } from '../mcp/tools/session-tools'
import { createSheetsTools, type SheetsControl } from '../mcp/tools/sheets-tools'
import { createSlidesTools, type SlidesControl } from '../mcp/tools/slides-tools'

/**
 * The app's own MCP server as an agent session sees it (decision 0032).
 *
 * One server per session: loopback, a port the system picks, and a fresh token
 * the program must send with every request. It is not the server the person
 * turns on under Integrations, and it runs whether or not that one is on.
 *
 * The tools are the existing open-document tools, narrowed:
 * - reading and editing documents open in tabs, through the editors' own
 *   executors, so changes show in the editor and can be undone;
 * - no tab closing, no editing session of its own, no headless file creation
 *   (the program writes files in the project folder itself);
 * - withheld words read as their `{{label}}` (decision 0016's rule, applied to
 *   this path): a deck through the bridge's withholding readout, Markdown and
 *   HTML through the same functions the cross-file reads use. A deck that
 *   withholds anything is not edited here, so a marker can never be written
 *   over the words it stands for. Word documents carry no mark this app
 *   recognises (a known gap, findings);
 * - `read_hwp` and `read_pdf` only inside the project folder.
 */

export const AGENT_MCP_TOOL_NAMES = [
  'open_documents',
  'read_document',
  'insert_content',
  'replace_blocks',
  'apply_ops',
  'read_sheet',
  'apply_sheet_ops',
  'read_deck',
  'apply_slide_ops',
  'read_hwp',
  'read_pdf',
] as const

export interface AgentMcpDeps {
  version: string
  defaultSaveDir: () => string
  docsControl?: DocsControl | undefined
  slidesControl?: SlidesControl | undefined
  sheetsControl?: SheetsControl | undefined
  openDocumentsControl?: OpenDocumentsControl | undefined
  resolveTarget?: TargetResolver | undefined
}

const WITHHELD_DECK =
  'This presentation withholds some of its content from AI. It cannot be edited from an agent session; ask the person to edit it in the app instead.'

/** Slides that read withheld words as labels and are not edited while they withhold anything */
export function withholdingSlides(control: SlidesControl): SlidesControl {
  return {
    ...control,
    readDeck: (wcId) => control.readDeck(wcId, { withhold: true }),
    runTxn: async (wcId, request) => {
      // without a way to tell, the deck is taken to withhold something
      const withholds = control.deckWithholds ? await control.deckWithholds(wcId) : true
      if (withholds) throw new Error(WITHHELD_DECK)
      return control.runTxn(wcId, request)
    },
  }
}

/** Open documents read with their withheld words as labels, and never closed */
export function withholdingOpenDocuments(control: OpenDocumentsControl): OpenDocumentsControl {
  return {
    list: () => control.list(),
    read: async (tab) => {
      if (tab.kind === 'slides') {
        throw new Error('Read a presentation with read_deck, passing its id or path as `document`.')
      }
      const content = await control.read(tab)
      if (tab.kind === 'markdown') return redactMarkdownSource(String(content))
      if (tab.kind === 'html') return redactHtmlSource(String(content))
      return content
    },
    close: async () => {
      throw new Error('Closing documents is not available in an agent session.')
    },
  }
}

function insideProject(
  tool: McpToolDefinition,
  projectRoot: string,
  platform: NodeJS.Platform,
): McpToolDefinition {
  return {
    ...tool,
    handler: (args) => {
      const path = typeof args.path === 'string' ? args.path : ''
      const root = comparablePath(projectRoot, projectRoot, platform)
      if (!path || !isInsidePath(comparablePath(path, root, platform), root, platform)) {
        throw new Error('Only files inside the project folder can be read here.')
      }
      return tool.handler(args)
    },
  }
}

export function buildAgentMcpTools(
  deps: AgentMcpDeps,
  projectRoot: string,
  platform: NodeJS.Platform = process.platform,
): McpToolDefinition[] {
  const host = createSessionHost()
  const resolveTarget = deps.resolveTarget ? { resolveTarget: deps.resolveTarget } : {}
  const all = [
    ...createDocumentTools(
      {
        version: deps.version,
        defaultSaveDir: deps.defaultSaveDir,
        background: false,
        docs: deps.docsControl,
        ...resolveTarget,
      },
      host,
    ),
    ...createSlidesTools(
      {
        defaultSaveDir: deps.defaultSaveDir,
        background: false,
        slides: deps.slidesControl ? withholdingSlides(deps.slidesControl) : undefined,
        ...resolveTarget,
      },
      host,
    ),
    ...createSheetsTools(
      {
        defaultSaveDir: deps.defaultSaveDir,
        background: false,
        sheets: deps.sheetsControl,
        ...resolveTarget,
      },
      host,
    ),
    ...createHwpTools(),
    ...createPdfTools(),
    ...createOpenDocumentTools({
      defaultSaveDir: deps.defaultSaveDir,
      ...(deps.openDocumentsControl
        ? { control: withholdingOpenDocuments(deps.openDocumentsControl) }
        : {}),
    }),
  ]
  const wanted = new Set<string>(AGENT_MCP_TOOL_NAMES)
  return all
    .filter((tool) => wanted.has(tool.name))
    .map((tool) =>
      tool.name === 'read_hwp' || tool.name === 'read_pdf'
        ? insideProject(tool, projectRoot, platform)
        : tool,
    )
}

export interface AgentMcpServer {
  url: string
  token: string
  stop(): Promise<void>
}

/** Start one session's server; the caller stops it when the session ends */
export async function startAgentMcpServer(
  deps: AgentMcpDeps,
  projectRoot: string,
): Promise<AgentMcpServer> {
  const token = randomBytes(24).toString('hex')
  const service = new McpServerService({
    port: 0,
    token,
    version: deps.version,
    maxListenAttempts: 1,
    toolsFactory: () => buildAgentMcpTools(deps, projectRoot),
  })
  await service.start(0)
  return {
    url: `${service.getUrl()}/mcp`,
    token,
    stop: () => service.stop(),
  }
}
