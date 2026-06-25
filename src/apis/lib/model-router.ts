/**
 * Capability-aware Model Router (Improvement #8)
 * Uses Ollama's /api/show capabilities to select the best available model
 * for a given task, ranked by parameter count (larger = better).
 * Falls back to static hints if Ollama is unreachable.
 */

type TaskType = 'chat' | 'websearch' | 'vision' | 'thinking' | 'json' | 'tool_call';
export type ModelPriority = 'quality' | 'speed'; // quality = largest params first, speed = smallest first

// Map task types to Ollama capability strings
const TASK_TO_CAPABILITY: Record<TaskType, string> = {
  tool_call: 'tools',
  websearch:  'tools',
  vision:     'vision',
  thinking:   'thinking',
  json:       'tools',       // prefer tools-capable for structured output
  chat:       'completion',
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LS_KEY = 'model_router_capability_cache';

interface PersistedCache {
  endpoint: string;
  map: Record<string, Record<string, number>>;
  ts: number;
}

// In-memory cache (warmed from localStorage on first access)
let _capabilityCache: Record<string, Record<string, number>> | null = null;
let _cacheEndpoint = '';
let _refreshPromise: Promise<void> | null = null;

function loadFromStorage(): PersistedCache | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    return raw ? (JSON.parse(raw) as PersistedCache) : null;
  } catch { return null; }
}

function saveToStorage(endpoint: string, map: Record<string, Record<string, number>>) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_KEY, JSON.stringify({ endpoint, map, ts: Date.now() }));
    }
  } catch {}
}

function getEndpoint(): string {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('ollama_endpoints') : null;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) && arr[0] ? arr[0] : 'http://localhost:11434';
  } catch {
    return 'http://localhost:11434';
  }
}

async function fetchModelIds(endpoint: string): Promise<string[]> {
  const res = await fetch(`${endpoint}/v1/models`);
  if (!res.ok) throw new Error(`/v1/models ${res.status}`);
  const data = await res.json();
  return data.data.map((m: { id: string }) => m.id);
}

async function fetchModelCapabilities(endpoint: string, modelId: string) {
  const res = await fetch(`${endpoint}/api/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId }),
  });
  if (!res.ok) throw new Error(`/api/show ${res.status}`);
  const data = await res.json();
  return {
    capabilities: (data.capabilities as string[]) ?? [],
    paramCount: (data.model_info?.['general.parameter_count'] as number) ?? 0,
  };
}

/** Rebuild the capability→{model:params} map from live Ollama data */
async function buildCapabilityMap(endpoint: string): Promise<Record<string, Record<string, number>>> {
  const map: Record<string, Record<string, number>> = {};
  const modelIds = await fetchModelIds(endpoint);
  await Promise.all(modelIds.map(async (id) => {
    try {
      const { capabilities, paramCount } = await fetchModelCapabilities(endpoint, id);
      for (const cap of capabilities) {
        if (!map[cap]) map[cap] = {};
        map[cap][id] = paramCount;
      }
    } catch {
      // skip unavailable models silently
    }
  }));
  return map;
}

/** Refresh the cache in the background (deduplicated) */
function scheduleRefresh(ep: string) {
  if (_refreshPromise) return;
  _refreshPromise = buildCapabilityMap(ep)
    .then((map) => {
      _capabilityCache = map;
      _cacheEndpoint = ep;
      saveToStorage(ep, map);
    })
    .catch(() => {})
    .finally(() => { _refreshPromise = null; });
}

/**
 * Returns the capability map immediately from memory or localStorage.
 * Triggers a background refresh if stale/missing — never blocks a prompt.
 */
function getCapabilityMap(): Record<string, Record<string, number>> {
  const ep = getEndpoint();

  // Memory hit (same endpoint)
  if (_capabilityCache && _cacheEndpoint === ep) return _capabilityCache;

  // Try localStorage
  const stored = loadFromStorage();
  const fresh = stored && stored.endpoint === ep && (Date.now() - stored.ts) < CACHE_TTL_MS;

  if (stored && stored.endpoint === ep) {
    // Serve stale or fresh from storage immediately
    _capabilityCache = stored.map;
    _cacheEndpoint = ep;
    if (!fresh) scheduleRefresh(ep); // stale — refresh in background
    return _capabilityCache;
  }

  // Nothing cached — kick off background build, return empty map now
  scheduleRefresh(ep);
  return {};
}

/** Pick the best model for a capability, ordered by priority */
function bestModelForCapability(
  map: Record<string, Record<string, number>>,
  capability: string,
  priority: ModelPriority = 'quality',
): string | null {
  const bucket = map[capability];
  if (!bucket) return null;
  const entries = Object.entries(bucket);
  if (!entries.length) return null;
  // quality → largest params first (most capable); speed → smallest params first (fastest)
  entries.sort((a, b) => priority === 'speed' ? a[1] - b[1] : b[1] - a[1]);
  return entries[0][0];
}

export const modelRouter = {
  /** Invalidate the capability cache (e.g. after endpoint change) */
  invalidateCache() {
    _capabilityCache = null;
  },

  /**
   * Synchronous resolve — always instant (reads memory/localStorage).
   * A background refresh runs automatically when cache is stale.
   * Falls back to defaultModel if cache is empty (first ever cold start).
   */
  resolve(taskType: TaskType, _prompt: string, defaultModel: string, priority: ModelPriority = 'quality'): string {
    const map = getCapabilityMap();
    const cap = TASK_TO_CAPABILITY[taskType] ?? 'completion';
    return bestModelForCapability(map, cap, priority) ?? defaultModel;
  },

  /** Kept for backward compat — now just wraps the sync resolve */
  async resolveAsync(taskType: TaskType, defaultModel: string, priority: ModelPriority = 'quality'): Promise<string> {
    return this.resolve(taskType, '', defaultModel, priority);
  },
};