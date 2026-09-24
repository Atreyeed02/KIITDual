/**
 * KIITDual — Frontend environment configuration (single place to read env vars).
 *
 * Nothing in the app calls the backend yet: the simulated services in
 * `src/services/` are still the data source. The future API client should read
 * its origins from here instead of touching `import.meta.env` directly.
 * See docs/FRONTEND_INTEGRATION_GUIDE.md.
 */

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '');

/** REST API origin, e.g. http://localhost:5000 — undefined until configured. */
export const API_BASE_URL: string | undefined = import.meta.env.VITE_API_BASE_URL
  ? trimTrailingSlash(import.meta.env.VITE_API_BASE_URL)
  : undefined;

/** WebSocket origin: explicit override, else derived from the API origin (http→ws, https→wss). */
export const WS_BASE_URL: string | undefined = import.meta.env.VITE_WS_BASE_URL
  ? trimTrailingSlash(import.meta.env.VITE_WS_BASE_URL)
  : API_BASE_URL?.replace(/^http/, 'ws');
