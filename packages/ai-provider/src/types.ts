import type {
  AgentMessage,
  AgentToolCall,
  AgentToolDef,
  IpcStreamErrorKind,
} from '@genoffice/agent-core'

export type AiProviderId =
  | 'genspark'
  | 'codex'
  | 'claude-code'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'openai'
  | 'kimi'
  | 'glm'
  | 'qwen'
  | 'doubao'
  | 'mimo'
  | 'hunyuan'
  | 'ling'
  | 'spark'
  | 'longcat'
  | 'minimax'
  | 'xai'
  | 'mistral'
  | 'openrouter'
  | 'requesty'
  | 'opper'
  | 'cheaperinference'
  | 'atlascloud'
  | 'opencode-zen'
  | 'opencode-go'
  | 'custom'

/** Providers reached through the locally installed, already signed-in vendor CLI (a subscription, not a key) */
export type AiSubscriptionProviderId = 'claude-code' | 'codex'

/** What the provider setting holds: `auto` (first ready subscription) or one provider id */
export type AiProviderSelection = 'auto' | AiProviderId

export type AiSubscriptionState =
  'checking' | 'not-installed' | 'signed-out' | 'ready' | 'metered' | 'error'

/** how the CLI is signed in; `unknown` is handled as `metered` */
export type AiSubscriptionLoginMethod = 'subscription' | 'metered' | 'unknown'

/** Connection status of one subscription provider. Carries no account identity (email, organisation). */
export interface AiSubscriptionStatus {
  provider: AiSubscriptionProviderId
  /** `ready` only when loginMethod is `subscription`; `metered` covers the metered and unknown logins */
  state: AiSubscriptionState
  /** CLI version, when the program reported one */
  version?: string | undefined
  /** absent until the CLI is known to be signed in */
  loginMethod?: AiSubscriptionLoginMethod | undefined
  /** plan name the CLI reported, display only */
  planName?: string | undefined
  /** the user chose "use anyway" for this metered login */
  meteredAccepted: boolean
  /** what went wrong, on state `error` */
  error?: string | undefined
}

export type AiSubscriptionStatuses = Partial<Record<AiSubscriptionProviderId, AiSubscriptionStatus>>

export type AiUsageWindow = 'five_hour' | 'seven_day'

/** How much of one rate-limit window a subscription has used */
export interface AiSubscriptionUsage {
  provider: AiSubscriptionProviderId
  window: AiUsageWindow
  /** 0 (unused) to 1 (exhausted) */
  utilization: number
  /** epoch milliseconds; absent when the CLI reported no reset time */
  resetsAt?: number | undefined
}

/** Machine-readable cause of a failed run; one union shared with the renderer transport */
export type AiRunErrorKind = IpcStreamErrorKind

/** Genspark account status (gsk login state; the sole auth source for AI features) */
export interface GenSparkAccountStatus {
  loggedIn: boolean
  email?: string
}

export interface AiProviderConfig {
  apiKey: string
  model: string
  /** required for custom; for other direct providers it overrides the default endpoint (regional mirrors) */
  baseUrl?: string | undefined
  /** optional Codex CLI override; empty means auto-detect the current authenticated install */
  cliPath?: string | undefined
}

/** One user-hosted OpenAI-compatible server; the active one is mirrored into `providers.custom` */
export interface AiCustomEndpoint {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  /** ids the server advertised on the last `/models` probe, so the composer chip can list them offline */
  models?: string[] | undefined
}

/** Live picker data returned by Codex app-server's model/list method. */
export interface CodexModelCatalog {
  models: string[]
  defaultModel: string
}

export interface AiProviderMeta {
  id: AiProviderId
  label: string
  models: string[]
  defaultModel: string
  keyPlaceholder: string
  needsBaseUrl?: boolean
  needsCliPath?: boolean
}

/** Image generation / media analysis backends (separate from the chat provider) */
export type AiMediaProviderId =
  | 'genspark'
  | 'openai'
  | 'gemini'
  | 'doubao'
  | 'glm'
  | 'xai'
  | 'qwen'
  | 'minimax'
  | 'deepseek'
  | 'custom'

/** Media backends configured with a key (or a base URL): the AI_MEDIA_PROVIDERS catalog minus Genspark */
export type AiMediaKeyProviderId = Exclude<AiMediaProviderId, 'genspark'>

/** generate_image choice: the Codex subscription, a key provider, or `none` (first configured key provider) */
export type AiImageProviderSelection = 'codex' | 'none' | AiMediaProviderId
/** analyze_media choice for images: `chat` shows the image to the current AI provider */
export type AiAnalysisProviderSelection = 'chat' | AiMediaProviderId
/** analyze_media choice for video/audio: `none` or a video-capable key provider */
export type AiVideoAnalysisProviderSelection = 'none' | AiMediaProviderId

/** wire shape of the image endpoint */
export type AiImageProtocol = 'openai-images' | 'gemini' | 'dashscope' | 'minimax'
/** wire shape of the understanding endpoint */
export type AiAnalysisProtocol = 'openai-chat' | 'gemini'

export interface AiMediaProviderConfig {
  apiKey: string
  /** required for custom; for the others it overrides the official endpoint (regional mirrors) */
  baseUrl?: string | undefined
  /** image generation model (empty = the provider default) */
  imageModel: string
  /** image/video understanding model (empty = the provider default) */
  analysisModel: string
}

export interface AiMediaProviderMeta {
  id: AiMediaProviderId
  label: string
  /** one-line English blurb shown on the provider card */
  description: string
  keyPlaceholder: string
  needsBaseUrl?: boolean
  /** '' for genspark (gsk login) and custom (user-supplied) */
  defaultBaseUrl: string
  /** absent = the provider does not generate images */
  imageProtocol?: AiImageProtocol
  imageModels: string[]
  defaultImageModel: string
  /** absent = the provider does not analyze media */
  analysisProtocol?: AiAnalysisProtocol
  analysisModels: string[]
  defaultAnalysisModel: string
  /** the analysis model accepts video input (Gemini natively; OpenAI-compatible vendors via a video_url part) */
  videoAnalysis: boolean
}

export interface AiMediaSettings {
  /** provider behind generate_image */
  imageProvider: AiImageProviderSelection
  /** provider behind analyze_media for images */
  analysisProvider: AiAnalysisProviderSelection
  /** provider behind analyze_media when the input has video/audio (only video-capable vendors qualify) */
  videoAnalysisProvider: AiVideoAnalysisProviderSelection
  providers: Record<AiMediaProviderId, AiMediaProviderConfig>
  /** pre-catalog shape (one provider for both); migrated by resolveAiMediaSettings */
  provider?: AiMediaProviderId | undefined
}

/** web/image search backends; Parallel supports both a user key and free keyless search */
export type AiSearchProviderId =
  'genspark' | 'serper' | 'serply' | 'tavily' | 'parallel' | 'exa' | 'firecrawl'

export interface AiSearchProviderMeta {
  id: AiSearchProviderId
  label: string
  keyPlaceholder: string
  /** the backend also serves image search (otherwise image search falls back to free sources) */
  imageSearch: boolean
}

export interface AiSearchSettings {
  provider: AiSearchProviderId
  providers: Record<Exclude<AiSearchProviderId, 'genspark'>, { apiKey: string }>
}

export interface AiSettings {
  /** `auto` or one provider id; resolve it with selectAiProvider before indexing `providers` */
  provider: AiProviderSelection
  /**
   * One config per provider. The `auto` slot is never populated: it exists so
   * code that indexes with the raw selection keeps compiling and reads undefined.
   */
  providers: Record<AiProviderId, AiProviderConfig> & { auto?: AiProviderConfig | undefined }
  /** every saved custom endpoint; absent on files written before the list existed */
  customEndpoints?: AiCustomEndpoint[] | undefined
  /** id of the endpoint `providers.custom` mirrors */
  customEndpoint?: string | undefined
  /**
   * Provider for generate_image / analyze_media. Absent (pre-media settings
   * files) means Genspark, i.e. the gsk login + gskToolsEnabled gate.
   */
  media?: AiMediaSettings | undefined
  /** web/image search backend; absent means Genspark (gsk when signed in, then the free chain) */
  search?: AiSearchSettings | undefined
  /**
   * Genspark cloud tools (web/image search via gsk, image generation, media
   * analysis). Default true; false makes tools skip the gsk backend entirely
   * (search falls back to free sources, gsk-only tools are unavailable).
   * Only meaningful while signed in — signed out, the gsk backend is
   * unavailable regardless.
   */
  gskToolsEnabled?: boolean
  /**
   * Output-token cap for ONE model turn of agent runs (default
   * DEFAULT_MAX_OUTPUT_TOKENS). Reasoning models bill their thinking against
   * this same budget, so a heavy edit turn can consume all of it and close with
   * finish_reason=length and no prose at all — raising it is the user's lever
   * (absent = the default, so pre-existing settings files keep working).
   */
  maxOutputTokens?: number | undefined
  /** per subscription provider: the user accepted a metered (pay-as-you-go) CLI login; absent = false */
  meteredAccepted?: Partial<Record<AiSubscriptionProviderId, boolean>> | undefined
  /** headless callers (terminal commands, MCP) may use subscription providers; absent = false */
  headlessSubscriptionEnabled?: boolean | undefined
  /** the first-connection notice has been shown; absent = false */
  subscriptionNoticeSeen?: boolean | undefined
}

/** pre-provider settings shape (single OpenAI-compatible endpoint); migrated into "custom" */
export interface LegacyAiSettings {
  baseUrl?: string
  apiKey?: string
  model?: string
}

export interface AiChatRequest {
  settings: AiSettings
  system: string
  user: string
}

export interface AiChatResponse {
  ok: boolean
  content?: string
  error?: string
}

export interface AiStreamRequest {
  requestId: string
  /** Stable renderer transport id used to retain native provider sessions. */
  sessionId?: string
  settings: AiSettings
  system: string
  messages: AgentMessage[]
  tools?: AgentToolDef[]
  maxTokens?: number
}

/** Token usage a provider reported for one model turn. Both fields are best-effort:
 * some providers (and the Genspark proxy) never report usage, and consumers must
 * treat an absent figure as "unknown", never as zero. */
export interface AiTokenUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface AiStreamChunk {
  requestId: string
  /** 'ping' = wire-level keepalive so the renderer can tell a live stream from a dead one;
   * 'reasoning' = model thinking delta (text carries it), stored for interleaved-thinking echo;
   * 'subscription-usage' = rate-limit windows a subscription CLI reported;
   * 'input-truncated' = the input was cut to fit a limit and the user must be told */
  type:
    | 'delta'
    | 'reasoning'
    | 'tool-call'
    | 'usage'
    | 'subscription-usage'
    | 'input-truncated'
    | 'done'
    | 'error'
    | 'ping'
  text?: string
  /** complete parsed tool call (emitted once its arguments finish streaming) */
  toolCall?: AgentToolCall
  error?: string
  /** machine-readable error cause ('timeout', exhausted 'credits', 'network' connectivity failure, 'overloaded' capacity/rate limit, or a subscription cause); lets the renderer localize the message */
  errorCode?: AiRunErrorKind
  /** subscription provider the error is about ('not-installed', 'signed-out', 'rate-limit', 'metered-not-accepted', 'needs-update') */
  errorProvider?: AiSubscriptionProviderId
  /** epoch milliseconds: when the limit resets ('rate-limit', when reported) or calls are allowed again ('headless-limit') */
  errorResetsAt?: number
  /** normalized stop reason carried on 'done' ('max_tokens' = output cut off by the token limit) */
  stopReason?: string
  /** tokens the provider billed for this turn, carried on 'usage' (always sent before 'done') */
  usage?: AiTokenUsage
  /** rate-limit windows carried on 'subscription-usage' */
  subscriptionUsage?: AiSubscriptionUsage[]
}
