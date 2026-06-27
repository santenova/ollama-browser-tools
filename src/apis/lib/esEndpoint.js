/**
 * Returns the Elasticsearch endpoint based on environment:
 * - browser + local  → '/db'                           (Vite proxy)
 * - Node   + local   → 'http://localhost:9200'          (direct)
 * - remote           → 'https://eu-vector-cloud.ngrok.dev'
 */
const _isBrowser = typeof window !== 'undefined';
export const LOCAL_ES_ENDPOINT = '/db';
export const REMOTE_ES_ENDPOINT = 'https://eu-vector-cloud.ngrok.dev';

export const getEsEndpoint = () => {
  const host = _isBrowser
    ? window.location.hostname
    : ((typeof globalThis.process !== 'undefined' && globalThis.process.env?.HOSTNAME) || 'localhost');
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
  if (isLocal) return _isBrowser ? '/db' : 'http://localhost:9200';
  return REMOTE_ES_ENDPOINT;
};

/**
 * Quick reachability check — pings /_cluster/health on the given endpoint.
 * Returns { ok, status, latencyMs }.
 */
export const checkEsEndpoint = async (endpoint, timeoutMs = 5000) => {
  const start = performance.now();
  try {
    const res = await fetch(`${endpoint}/_cluster/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) return { ok: false, status: res.status, latencyMs };
    const data = await res.json();
    return { ok: true, status: data.status, latencyMs, cluster: data.cluster_name };
  } catch (e) {
    return { ok: false, status: 0, latencyMs: Math.round(performance.now() - start), error: e?.message };
  }
};