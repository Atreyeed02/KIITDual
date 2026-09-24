/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the KIITDual REST API (planned; not used until backend integration). */
  readonly VITE_API_BASE_URL?: string;
  /** Optional override for the WebSocket origin; derived from VITE_API_BASE_URL when unset. */
  readonly VITE_WS_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
