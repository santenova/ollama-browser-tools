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

/**
 * Pick a model for a capability using a Speed score (0–100), expressed as a
 * percentage of the average paramCount across models with that capability.
 *
 *   Speed=100  → target = min paramCount  (fastest model)
 *   Speed=50   → target = avg paramCount  (median model)
 *   Speed=0    → target = max paramCount  (most capable model)
 *
 * The target paramCount is interpolated through (0→max, 50→avg, 100→min) and
 * the model whose paramCount is closest to the target is returned.
 * Uses paramCount from /api/show (fetchModelCapabilities).
 */
function bestModelForSpeed(
  map: Record<string, Record<string, number>>,
  capability: string,
  speed: number,
): string | null {
  const bucket = map[capability];
  if (!bucket) return null;
  const entries = Object.entries(bucket);
  if (!entries.length) return null;

  const params = entries.map(([, p]) => p);
  const min = Math.min(...params);
  const max = Math.max(...params);
  const avg = params.reduce((s, p) => s + p, 0) / params.length;

  const s = Math.max(0, Math.min(100, speed));
  // Interpolate target paramCount: 0→max, 50→avg, 100→min
  let target: number;
  if (s >= 50) {
    // upper half: avg → min
    const t = (s - 50) / 50; // 0 at 50, 1 at 100
    target = avg - t * (avg - min);
  } else {
    // lower half: max → avg
    const t = s / 50; // 0 at 0, 1 at 50
    target = max - t * (max - avg);
  }

  // Find the model whose paramCount is closest to the target
  let best = entries[0];
  let bestDist = Math.abs(entries[0][1] - target);
  for (let i = 1; i < entries.length; i++) {
    const dist = Math.abs(entries[i][1] - target);
    if (dist < bestDist) {
      best = entries[i];
      bestDist = dist;
    }
  }
  return best[0];
}

/**
 * Pick the best model for a capability, filtered to models that also support
 * every capability in `requiredCaps`. Speed (0–100) selects by paramCount
 * within the filtered set.
 */
function bestModelForCapabilities(
  map: Record<string, Record<string, number>>,
  capability: string,
  requiredCaps: string[],
  speed: number,
): string | null {
  const bucket = map[capability];
  if (!bucket || !requiredCaps.length) return null;

  // Filter to models present under EVERY required capability
  let candidates: [string, number][] = [];
  if (map[requiredCaps[0]]) {
    candidates = Object.entries(map[requiredCaps[0]]);
  }
  if (!candidates.length) return null;
  for (let i = 1; i < requiredCaps.length; i++) {
    const cb = map[requiredCaps[i]];
    if (!cb) return null;
    candidates = candidates.filter(([mId]) => mId in cb);
  }

  // Further filter to models also in the primary capability bucket
  candidates = candidates.filter(([mId]) => mId in bucket);
  if (!candidates.length) return null;

  // Interpolated paramCount target (speed-axis), same logic as bestModelForSpeed
  const params = candidates.map(([, p]) => p);
  const min = Math.min(...params);
  const max = Math.max(...params);
  const avg = params.reduce((s, p) => s + p, 0) / params.length;
  const s = Math.max(0, Math.min(100, speed));
  let target: number;
  if (s >= 50) {
    const t = (s - 50) / 50;
    target = avg - t * (avg - min);
  } else {
    const t = s / 50;
    target = max - t * (max - avg);
  }

  let best = candidates[0];
  let bestDist = Math.abs(candidates[0][1] - target);
  for (let i = 1; i < candidates.length; i++) {
    const dist = Math.abs(candidates[i][1] - target);
    if (dist < bestDist) {
      best = candidates[i];
      bestDist = dist;
    }
  }
  return best[0];
}

/** Options object form for resolve — lets callers pass Speed (0–100). */
export interface ResolveOptions {
  TaskType: TaskType;
  Speed?: number;        // 0–100; 100 = fastest (smallest paramCount), 0 = most capable
  defaultModel?: string; // fallback when no capability data
  prompt?: string;       // reserved for future prompt-aware routing
  priority?: ModelPriority; // explicit override (ignores Speed if set)
  /**
   * Required capabilities filter. Only models registered under EVERY
   * capability in this list are considered. E.g. ['tools','thinking']
   * to find models that support both tools AND thinking.
   * Capped at the primary-capability bucket (TASK_TO_CAPABILITY[TaskType]).
   */
  requiredCaps?: string[];
}

export const modelRouter = {
  /** Read-only access to the in-memory capability cache (for diagnostics/tests) */
  get capabilityCache(): Record<string, Record<string, number>> | null {
    return _capabilityCache;
  },

  /** Invalidate the capability cache (e.g. after endpoint change) */
  invalidateCache() {
    _capabilityCache = null;
  },

  /**
   * Synchronous resolve — always instant (reads memory/localStorage).
   * A background refresh runs automatically when cache is stale.
   * Falls back to defaultModel if cache is empty (first ever cold start).
   *
   * Supports two call forms:
   *   resolve('chat', prompt, defaultModel, 'quality')        // positional (legacy)
   *   resolve({ TaskType: 'chat', Speed: 100 })               // options object
   *
   * Speed (0–100) ranks models by paramCount: 100 = fastest (smallest),
   * 0 = most capable (largest). Ignored if `priority` is set explicitly.
   */
  resolve(taskTypeOrOpts: TaskType | ResolveOptions, _prompt = '', defaultModel = '', priority: ModelPriority = 'quality'): string {
    const map = getCapabilityMap();
    let cap: string;
    let fallback: string;
    if (typeof taskTypeOrOpts === 'string') {
      cap = TASK_TO_CAPABILITY[taskTypeOrOpts] ?? 'completion';
      fallback = defaultModel;
      // Always use Speed=100 (fastest model) for positional calls
      return bestModelForSpeed(map, cap, 100) ?? bestModelForCapability(map, cap, priority) ?? fallback;
    }
    // Options object form
    const opts = taskTypeOrOpts;
    cap = TASK_TO_CAPABILITY[opts.TaskType] ?? 'completion';
    fallback = opts.defaultModel ?? '';
    if (opts.requiredCaps?.length) {
      const speed = opts.Speed ?? 100;
      return bestModelForCapabilities(map, cap, opts.requiredCaps, speed)
        ?? bestModelForSpeed(map, cap, speed)
        ?? bestModelForCapability(map, cap, opts.priority ?? 'quality')
        ?? fallback;
    }
    if (opts.priority) {
      return bestModelForCapability(map, cap, opts.priority) ?? fallback;
    }
    if (opts.Speed !== undefined) {
      return bestModelForSpeed(map, cap, opts.Speed) ?? fallback;
    }
    return bestModelForCapability(map, cap, 'quality') ?? fallback;
  },

  /** Kept for backward compat — now just wraps the sync resolve (always Speed=100) */
  async resolveAsync(taskType: TaskType, defaultModel: string, _priority: ModelPriority = 'quality'): Promise<string> {
    return this.resolve({ TaskType: taskType, Speed: 100, defaultModel });
  },
};