import { InjectionToken } from '@angular/core';

/**
 * Shape of the static `appconfig.json` file served alongside the front-end.
 *
 * This file lets the app be deployed standalone (without the back-end serving
 * it) and still know where to find the back-end. Every field is optional; when
 * a field is missing the resolution logic falls through to the next source.
 */
export interface AppConfig {
  backend?: {
    host?: string;
    port?: number;
  };
  /** When false, the back-end connection in localStorage is ignored. Default: true. */
  local_storage_override?: boolean;
  /** When false, the back-end connection in sessionStorage is ignored. Default: true. */
  session_storage_override?: boolean;
}

/** Resolved back-end connection used for both HTTP and WebSocket. */
export interface BackendConnection {
  host: string;
  port: number;
}

export const DEFAULT_BACKEND_PORT = 3000;

/** The loaded appconfig.json (or an empty object if it could not be loaded). */
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

/** The back-end connection resolved from the 6-step lookup sequence. */
export const BACKEND_CONNECTION = new InjectionToken<BackendConnection>('BACKEND_CONNECTION');

/**
 * Fetch the static appconfig.json. Never rejects — a missing or invalid file
 * simply yields an empty config so the resolution sequence can fall through.
 */
export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const res = await fetch('appconfig.json', { cache: 'no-cache' });
    if (res.ok) {
      return (await res.json()) as AppConfig;
    }
  } catch {
    // ignore — fall back to an empty config
  }
  return {};
}

/**
 * Read a back-end connection from a Web Storage area. Accepts either a
 * dedicated `backend` entry ({ host, port }) or the legacy full `settings`
 * object that stores the connection under `settings.backend`.
 */
function readStoredConnection(storage: Storage): BackendConnection | null {
  try {
    const raw = storage.getItem('backend');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BackendConnection>;
      if (parsed?.host) {
        return { host: parsed.host, port: parsed.port || DEFAULT_BACKEND_PORT };
      }
    }

    const settingsRaw = storage.getItem('settings');
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw) as { backend?: Partial<BackendConnection> };
      if (settings?.backend?.host) {
        return { host: settings.backend.host, port: settings.backend.port || DEFAULT_BACKEND_PORT };
      }
    }
  } catch {
    // ignore malformed storage
  }
  return null;
}

/**
 * Persist a successfully-connected back-end so future loads find it first.
 *
 * Writes a dedicated `backend` entry ({ host, port }) to sessionStorage and/or
 * localStorage, gated by the same override flags used on read: when an override
 * is disabled in appconfig.json the app neither reads from nor writes to that
 * storage, so the appconfig.json value stays authoritative.
 */
export function persistBackendConnection(connection: BackendConnection, config: AppConfig): void {
  const sessionAllowed = config.session_storage_override !== false; // default true
  const localAllowed = config.local_storage_override !== false; // default true
  const payload = JSON.stringify({ host: connection.host, port: connection.port });

  try {
    if (sessionAllowed) sessionStorage.setItem('backend', payload);
  } catch {
    // storage may be unavailable (private mode / quota) — ignore
  }
  try {
    if (localAllowed) localStorage.setItem('backend', payload);
  } catch {
    // ignore
  }
}

/**
 * Resolve the back-end connection using the following precedence:
 *   1. sessionStorage           (unless session_storage_override === false)
 *   2. localStorage             (unless local_storage_override === false)
 *   3. appconfig.json backend
 *   4. hostname + port from the URL of the loaded app
 *   5. hostname from the URL + default port 3000
 *   6. defaults: localhost:3000
 */
export function resolveBackendConnection(config: AppConfig): BackendConnection {
  const sessionAllowed = config.session_storage_override !== false; // default true
  const localAllowed = config.local_storage_override !== false; // default true

  // 1. session storage
  if (sessionAllowed) {
    const fromSession = readStoredConnection(sessionStorage);
    if (fromSession) return fromSession;
  }

  // 2. local storage
  if (localAllowed) {
    const fromLocal = readStoredConnection(localStorage);
    if (fromLocal) return fromLocal;
  }

  // 3. appconfig.json
  if (config.backend?.host) {
    return { host: config.backend.host, port: config.backend.port || DEFAULT_BACKEND_PORT };
  }

  // 4. hostname + port from the URL of the loaded app
  const urlHost = window.location.hostname;
  const urlPort = window.location.port;
  if (urlHost && urlPort) {
    return { host: urlHost, port: parseInt(urlPort, 10) };
  }

  // 5. hostname from the URL + default port 3000
  if (urlHost) {
    return { host: urlHost, port: DEFAULT_BACKEND_PORT };
  }

  // 6. defaults
  return { host: 'localhost', port: DEFAULT_BACKEND_PORT };
}
