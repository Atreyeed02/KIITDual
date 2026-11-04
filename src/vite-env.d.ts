/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the KIITDual REST API (planned; not used until backend integration). */
  readonly VITE_API_BASE_URL?: string;
  /** Optional override for the WebSocket origin; derived from VITE_API_BASE_URL when unset. */
  readonly VITE_WS_BASE_URL?: string;
  /** Set to 'false' to hide the Analytics demo-data buttons (shown by default). */
  readonly VITE_ENABLE_ANALYTICS_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
