/** Browser-safe settings surface. Keep Node-backed transports out of renderer bundles. */
export type {
  AiCustomEndpoint,
  AiProviderConfig,
  AiProviderId,
  AiProviderMeta,
  AiSettings,
  CodexModelCatalog,
  AiAnalysisProviderSelection,
  AiImageProviderSelection,
  AiMediaKeyProviderId,
  AiProviderSelection,
  AiRunErrorKind,
  AiSubscriptionLoginMethod,
  AiSubscriptionProviderId,
  AiSubscriptionState,
  AiSubscriptionStatus,
  AiSubscriptionStatuses,
  AiSubscriptionUsage,
  AiUsageWindow,
  AiVideoAnalysisProviderSelection,
} from './types'
export {
  AI_SUBSCRIPTION_PROVIDERS,
  isKeyProviderConfigured,
  isSubscriptionProvider,
  providerSelectionOf,
  selectAiProvider,
  subscriptionConnection,
} from './provider-selection'
export type { AiNotConnectedReason, AiProviderChoice } from './provider-selection'
export {
  DEFAULT_AI_ANALYSIS_PROVIDER,
  DEFAULT_AI_IMAGE_PROVIDER,
  DEFAULT_AI_PROVIDER_SELECTION,
  DEFAULT_AI_SEARCH_PROVIDER,
  DEFAULT_AI_VIDEO_ANALYSIS_PROVIDER,
  normalizeAiSettings,
} from './legacy-settings'
export {
  codexImageGenerationAvailable,
  configuredImageKeyProviders,
  imageProviderSelection,
  resolveImageBackend,
  setCodexImageGenerationAvailable,
} from './image-backend'
export type { AiImageBackend, AiImageBackendContext } from './image-backend'
export {
  SUBSCRIPTION_INSTALL_COMMANDS,
  SUBSCRIPTION_INSTALL_URLS,
  SUBSCRIPTION_IPC_CHANNELS,
  checkingSubscriptionStatus,
  checkingSubscriptionStatuses,
  isSubscriptionProviderId,
  subscriptionLaunchResultOf,
  subscriptionMeteredResultOf,
  subscriptionStatusErrorKind,
  subscriptionStatusMapOf,
} from './subscription/contract'
export type {
  SubscriptionIpcChannel,
  SubscriptionIpcContract,
  SubscriptionLaunchFailure,
  SubscriptionLaunchResult,
  SubscriptionMeteredRequest,
  SubscriptionMeteredResult,
  SubscriptionProviderRequest,
  SubscriptionRecheckRequest,
  SubscriptionStatusErrorKind,
  SubscriptionStatusMap,
} from './subscription/contract'
export {
  AI_PROVIDERS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_MAX_OUTPUT_TOKENS,
  MIN_MAX_OUTPUT_TOKENS,
  clampMaxOutputTokens,
} from './providers'
export {
  activeCustomEndpoint,
  customEndpointLabel,
  newCustomEndpointId,
  removeCustomEndpoint,
  resolveCustomEndpoints,
  selectCustomEndpoint,
  upsertCustomEndpoint,
} from './custom-endpoints'
export { getProviderAdapter, modelLacksVision } from './registry'
export { AI_MEDIA_PROVIDERS } from './media'
export { AI_SEARCH_PROVIDERS } from './search-settings'
