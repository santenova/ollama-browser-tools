import axios from 'axios'; // Import axios directly

import { appParams, appId, token, functionsVersion, appBaseUrl, getAppParams, localStorage, LS_PREFIX } from "../apis/lib/app-params.ts";

import { createEsEntities, getEsConfig, saveEsConfig, esEntities } from "../apis/lib/es-entities.ts";
import { validateClientConfig } from "../apis/lib/config-schema.ts";
import { clientLogger } from "../apis/lib/client-logger.ts";
import { createCircuitBreaker } from "../apis/lib/circuit-breaker.ts";
import { telemetry } from "../apis/lib/telemetry.ts";
import { toolRegistry } from "../apis/lib/tool-registry.ts";
import { modelRouter } from "../apis/lib/model-router.ts";
import { promptRouter } from "../apis/lib/prompt-router.ts";
import { createBatcher } from "../apis/lib/request-batcher.ts";
import { createAuthMiddleware } from "../apis/lib/auth-middleware.ts";
import { abortManager } from "../apis/lib/abort-manager.ts";
import { webSearch } from "../apis/modules/websearch/websearch-tools.ts";
import { multiToolRun } from "../apis/modules/tools/multi-tool.ts";
import { thinkingStreamingFetch } from "../apis/modules/thinking/thinking-streaming.ts";

interface ToolSchema {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export const _local = true;
export const getSocket = () => {
    if (!socket) {
      socket = RoomsSocket({
        config: socketConfig,
      });
    }
    return socket;
  };
// Dump localStorage as a table

export function dumpObject(obj) {
  if (obj) {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      console.log("obj is empty.");
      return;
    }

    console.log(JSON.stringify(obj));
  }
}

// Refactor createAxiosClient to a direct Axios implementation
export function createAxiosClient({ baseURL, headers, token, interceptResponses }) {
  const instance = axios.create({
    baseURL: baseURL,
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (interceptResponses) {
    instance.interceptors.response.use(
      response => response,
      error => {
        return Promise.reject(error);
      }
    );
  }

  return instance;  
}

export function isLocalMode() {
  try {
    const prefix = import.meta.env.APP_PREFIX;
    const s = localStorage.getItem(prefix + "_settings");
    return s ? JSON.parse(s).local_mode === true : false;
  } catch {
    return false;
  }
}

export const serverUrl = "https://eu-vector-cloud.ngrok.dev";
export const headers = {
    ...{},
    "X-App-Id": String(appId),
  };
export const axiosClient = createAxiosClient({
    baseURL: `${serverUrl}/api`,
    headers,
    token
  });





/**
 * Determines the appropriate endpoint for making API requests based on environment variables and predefined endpoints.
 * 
 * @returns A string representing the selected endpoint.
 */
const _isBrowser = typeof window !== 'undefined';

const _isLocal = () => {
  const host = _isBrowser
    ? window.location.hostname
    : (process.env.HOSTNAME || '127.0.0.1');
  return host === '127.0.0.1' || host === '127.0.0.1' || host.startsWith('192.168.');
};

/**
 * Returns the Ollama endpoint.
 * - browser + local  → '/proxy'  (Vite dev proxy)
 * - Node   + local   → 'http://127.0.0.1:11434'  (direct)
 * - remote           → ngrok public URL
 */
export const getOllamaEndpoint = () => {
  if (_isLocal()) {
    return _isBrowser ? '/proxy' : 'http://127.0.0.1:11434';
  }
  return 'https://christy-ramentaceous-verbatim.ngrok-free.dev';
};

/**
 * Returns the Elasticsearch endpoint.
 * - browser + local  → '/db'  (Vite dev proxy)
 * - Node   + local   → 'http://127.0.0.1:9200'  (direct)
 * - remote           → ngrok public URL
 */
export const getElasticsearchEndpoint = () => {
  if (_isLocal()) {
    return _isBrowser ? '/db' : 'http://127.0.0.1:9200';
  }
  return 'https://eu-vector-cloud.ngrok.dev';
};



export const createOllamaClient = (apiKey?: string) => {
  return { apiKey };
}



/**
 * Standalone InvokeLLM — calls Ollama's OpenAI-compatible /v1/chat/completions endpoint.
 * Returns parsed JSON when response_json_schema is provided, otherwise plain text.
 */
export async function invokeLLM(opts: {
  prompt?: string;
  /** OpenAI-style messages array — takes precedence over `prompt` when provided. */
  messages?: Array<{ role: string; content: string }>;
  /** System message (e.g. persona instructions) — prepended to the conversation. */
  system?: string | null;
  add_context_from_internet?: boolean;
  response_json_schema?: Record<string, any> | null;
  file_urls?: string | string[] | null;
  model?: string | null;
  temperature?: number;
  /** Ollama thinking extension — set true to enable chain-of-thought. */
  think?: boolean;
  /** Stream SSE chunks; incremental tokens are delivered to `onToken`. */
  stream?: boolean;
  /** Streaming callback — receives each content delta as it arrives. */
  onToken?: (delta: string) => void;
  /** OpenAI-style tool schemas — when provided, returns the raw response (for tool-call loops). */
  tools?: unknown[];
  /** Return the full raw API response instead of just the content string. */
  returnRaw?: boolean;
  /** Optional abort signal — wired to the underlying fetch for cancellation. */
  signal?: AbortSignal;
  ollamaEndpoints: string[];
  defaultModel: string;
}) {
  const {
    prompt,
    messages: callerMessages,
    system = null,
    add_context_from_internet = false,
    response_json_schema = null,
    file_urls = null,
    model: requestedModel = null,
    temperature,
    think = false,
    stream = false,
    onToken,
    tools,
    returnRaw = false,
    signal,
    ollamaEndpoints,
    defaultModel,
  } = opts || {};

  const endpoint =
    (ollamaEndpoints[1] || ollamaEndpoints[0] || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const useModel = requestedModel || defaultModel || 'qwen3:0.6b';

  // Build the messages array — OpenAI Chat Completions spec
  const messages: Array<{ role: string; content: string }> = [];

  // 1. System message (persona instructions) first
  if (system) {
    messages.push({ role: 'system', content: system });
  }

  // 2. Web search context (injected as system message)
  if (add_context_from_internet) {
    try {
      const results = await webSearch({ prompt: prompt || '', ollamaEndpoints, defaultModel });
      if (results) {
        const contextStr =
          typeof results === 'string' ? results : JSON.stringify(results);
        messages.push({
          role: 'system',
          content: `Use the following web search results to inform your response:\n\n${contextStr}`,
        });
      }
    } catch {}
  }

  // 3. Caller-provided messages take precedence; otherwise build from prompt
  if (callerMessages && callerMessages.length > 0) {
    messages.push(...callerMessages);
  } else if (prompt) {
    messages.push({ role: 'user', content: prompt });
  } else if (messages.length === 0) {
    throw new Error('InvokeLLM requires either a "prompt" or "messages" parameter.');
  }

  // 4. File URLs appended as system context
  if (file_urls) {
    const urls = Array.isArray(file_urls) ? file_urls : [file_urls];
    messages.push({
      role: 'system',
      content: `Reference files provided by the user: ${urls.join(', ')}`,
    });
  }

  const body: Record<string, any> = {
    model: useModel,
    messages,
    stream,
  };

  if (temperature !== undefined && temperature !== null) {
    body.temperature = temperature;
  }

  if (think) {
    body.think = true;
  }

  if (tools) {
    body.tools = tools;
  }

  if (response_json_schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema: response_json_schema,
        strict: false,
      },
    };
  }

  const res = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `InvokeLLM error: ${res.status} ${res.statusText}${errText ? ` — ${errText}` : ''}`
    );
  }

  // Streaming mode — parse SSE chunks (OpenAI-compatible: data: {...}\n\n)
  if (stream && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let content = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const chunk = JSON.parse(payload);
          const delta = chunk?.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            content += delta;
            onToken?.(delta);
          }
        } catch {}
      }
    }

    if (response_json_schema) {
      try { return JSON.parse(content); } catch { return content; }
    }
    return content;
  }

  const data = await res.json();

  // When tools or returnRaw are requested, return the full response object
  // so callers can inspect tool_calls, thinking traces, etc.
  if (tools || returnRaw) {
    return data;
  }

  const content = data?.choices?.[0]?.message?.content ?? '';

  if (response_json_schema) {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  return content;
}

export function createClient(config: {
  serverUrl: string;
  appId: string;
  functionsVersion?: string;
  headers: Record<string, string>;
  model: string;
  ollamaEndpoints: string[];
  messages: Message[];
}) {
  // ── #1: Validate config schema before proceeding ──
  const validation = validateClientConfig(config);
  if (!validation.valid) {
    clientLogger.warn('createClient: config validation issues', { errors: validation.errors });
  }

  // ── #2: Auth middleware for token injection ──
  const authMiddleware = createAuthMiddleware({
    getToken: () => {
      try { return localStorage.getItem(`${LS_PREFIX}token`) || null; } catch { return null; }
    },
  });

  // ── #3: Circuit breaker for primary API ──
  const circuitBreaker = createCircuitBreaker('primary-api', {
    failureThreshold: 3,
    recoveryTimeMs: 30_000,
    onStateChange: (state) => {
      if (state === 'open') telemetry.emit('client:circuit-open', { name: 'primary-api' });
      if (state === 'closed') telemetry.emit('client:circuit-closed', { name: 'primary-api' });
    },
  });

  // ── Failsafe: load context from localStorage and merge into config ──
  let resolvedServerUrl = config.serverUrl;
  let resolvedAppId = config.appId;
  let resolvedFunctionsVersion = config.functionsVersion;
  let resolvedHeaders = config.headers;
  let resolvedModel = config.model;
  let resolvedOllamaEndpoints = config.ollamaEndpoints;

  try {
    {
      const ls = localStorage;

      // Merge stored values for any config fields not explicitly provided
      const storedServerUrl = ls.getItem(`${LS_PREFIX}server_url`);
      if (storedServerUrl && !resolvedServerUrl) resolvedServerUrl = storedServerUrl;

      const storedAppId = ls.getItem(`${LS_PREFIX}app_id`);
      if (storedAppId && !resolvedAppId) resolvedAppId = storedAppId;

      const storedFunctionsVersion = ls.getItem(`${LS_PREFIX}functions_version`);
      if (storedFunctionsVersion && !resolvedFunctionsVersion) resolvedFunctionsVersion = storedFunctionsVersion;

      const storedModel = ls.getItem(`${LS_PREFIX}default_model`) || ls.getItem('ollama_default_model');
      if (storedModel && !resolvedModel) resolvedModel = storedModel;

      // Endpoints: stored as JSON array under 'ollama_endpoints'
      const storedEndpointsRaw = ls.getItem('ollama_endpoints');
      if (storedEndpointsRaw) {
        try {
          const parsed = JSON.parse(storedEndpointsRaw);
          if (Array.isArray(parsed) && parsed.length > 0 && (!resolvedOllamaEndpoints || resolvedOllamaEndpoints.length === 0)) {
            resolvedOllamaEndpoints = parsed;
          }
        } catch {}
      }

      // Merge stored headers
      const storedHeadersRaw = ls.getItem(`${LS_PREFIX}headers`);
      if (storedHeadersRaw) {
        try {
          const parsedHeaders = JSON.parse(storedHeadersRaw);
          if (parsedHeaders && typeof parsedHeaders === 'object') {
            resolvedHeaders = { ...parsedHeaders, ...resolvedHeaders };
          }
        } catch {}
      }

      // Persist resolved values back to localStorage for next load
      if (resolvedServerUrl) ls.setItem(`${LS_PREFIX}server_url`, resolvedServerUrl);
      if (resolvedAppId) ls.setItem(`${LS_PREFIX}app_id`, resolvedAppId);
      if (resolvedFunctionsVersion) ls.setItem(`${LS_PREFIX}functions_version`, String(resolvedFunctionsVersion));
      if (resolvedModel) ls.setItem(`${LS_PREFIX}default_model`, resolvedModel);
      if (resolvedOllamaEndpoints?.length) ls.setItem('ollama_endpoints', JSON.stringify(resolvedOllamaEndpoints));
      if (resolvedHeaders) ls.setItem(`${LS_PREFIX}headers`, JSON.stringify(resolvedHeaders));
    }
  } catch (e) {
    // localStorage may be unavailable (SSR, privacy mode) — fail silently with config as-is
    console.warn('createClient: localStorage context load/store skipped —', e?.message || e);
  }

  const configResolved = {
    ...config,
    serverUrl: resolvedServerUrl,
    appId: resolvedAppId,
    functionsVersion: resolvedFunctionsVersion,
    headers: resolvedHeaders,
    model: resolvedModel,
    ollamaEndpoints: resolvedOllamaEndpoints,
  };

  const { headers: _h, model: _m, ollamaEndpoints: _o, messages: _msgs } = configResolved;

  let modelName = resolvedModel;
  let lastUserMessagePromptText = '';

  // ── Warm capability cache in background (non-blocking) ──
  modelRouter.resolveAsync('chat', resolvedModel).catch(() => {});

  // ── #6: Register default tools into the tool registry ──
  toolRegistry.register('InvokeLLM', (params) =>
    invokeLLM({ ...params, ollamaEndpoints: resolvedOllamaEndpoints, defaultModel: resolvedModel })
  );
  toolRegistry.register('websearch', (params) =>
    webSearch({ ...params, ollamaEndpoints: resolvedOllamaEndpoints, defaultModel: resolvedModel })
  );
  toolRegistry.register('toolbox', (params) =>
    multiToolRun({ ...params, ollamaEndpoints: resolvedOllamaEndpoints, defaultModel: resolvedModel })
  );

  // ── #5: LLM request batcher (batches parallel InvokeLLM calls within 20ms) ──
  const batchedInvoke = createBatcher<string>(
    async (batchArgs) => Promise.all(
      batchArgs.map(([params]) =>
        invokeLLM({ ...params, ollamaEndpoints: resolvedOllamaEndpoints, defaultModel: resolvedModel })
      )
    )
  );

  const client =
        { entities:[
          { name: 'Persona', defaultIndex: 'sample-prompt-persona'},
          { name: 'Template', defaultIndex: 'sample-prompt-template'},
          { name: 'ChatSession', defaultIndex: 'sample-prompt-session'},
          { name: 'Scenario', defaultIndex: 'sample-prompt-scenario'},
          { name: 'DevilsAdvocateResult', defaultIndex: 'sample-prompt-devils'},
          { name: 'AnalogyBuilderResult', defaultIndex: 'sample-prompt-analogy'},
          { name: 'PersonaDebateResult', defaultIndex: 'sample-prompt-debate'},
          { name: 'ContentRepurposerResult', defaultIndex: 'sample-prompt-repurpose'},
          { name: 'StructureArchitectResult', defaultIndex: 'sample-prompt-outline'},
          { name: 'GeneratorList', defaultIndex: 'sample-prompt-generator-list'}
        ],
    capabilities:{},
    setConfig: async (newConfig) => {
      saveEsConfig(newConfig);
    },
    /**
     * Reliably update client config after creation.
     * Updates the live closure variables so all integration methods
     * (InvokeLLM, websearch, toolbox, thinking, vision, expandQuery)
     * immediately use the new values. Also persists to localStorage.
     *
     * Usage:
     *   client.updateConfig({ model: 'gpt-oss:20b' });
     *   client.updateConfig({ ollamaEndpoints: ['http://my-host:11434'] });
     */
    updateConfig: (partial: Partial<typeof configResolved>) => {
      if (partial.model !== undefined) {
        resolvedModel = partial.model;
        configResolved.model = partial.model;
        try { localStorage.setItem(`${LS_PREFIX}default_model`, partial.model); } catch {}
      }
      if (partial.ollamaEndpoints !== undefined) {
        resolvedOllamaEndpoints = partial.ollamaEndpoints;
        configResolved.ollamaEndpoints = partial.ollamaEndpoints;
        try { localStorage.setItem('ollama_endpoints', JSON.stringify(partial.ollamaEndpoints)); } catch {}
      }
      if (partial.serverUrl !== undefined) {
        resolvedServerUrl = partial.serverUrl;
        configResolved.serverUrl = partial.serverUrl;
        try { localStorage.setItem(`${LS_PREFIX}server_url`, partial.serverUrl); } catch {}
      }
      if (partial.appId !== undefined) {
        resolvedAppId = partial.appId;
        configResolved.appId = partial.appId;
        try { localStorage.setItem(`${LS_PREFIX}app_id`, partial.appId); } catch {}
      }
      if (partial.headers !== undefined) {
        resolvedHeaders = { ...resolvedHeaders, ...partial.headers };
        configResolved.headers = resolvedHeaders;
        try { localStorage.setItem(`${LS_PREFIX}headers`, JSON.stringify(resolvedHeaders)); } catch {}
      }
      if (partial.functionsVersion !== undefined) {
        resolvedFunctionsVersion = partial.functionsVersion;
        configResolved.functionsVersion = partial.functionsVersion;
        try { localStorage.setItem(`${LS_PREFIX}functions_version`, String(partial.functionsVersion)); } catch {}
      }
      // Re-warm model router cache with new model
      modelRouter.resolveAsync('chat', resolvedModel).catch(() => {});
    },
    /** Returns the current live config (reflects updateConfig changes). */
    getConfig: () => ({ ...configResolved }),
    getEsConfig,
    saveEsConfig,
    integrations: {
        Core: {
          vision: {
            /**
             * Encode an image source into an OpenAI-compatible image_url string.
             * Accepts:
             *   - a dataUrl string ("data:image/...;base64,...")  → used as-is
             *   - a raw base64 string (no prefix)                → wrapped with detected MIME
             *   - a File / Blob object                           → read via FileReader
             */
            async encode(imageSource: string | File | Blob): Promise<string> {
              if (typeof imageSource === 'string') {
                if (imageSource.startsWith('data:')) return imageSource;
                // Detect actual image format from the base64 signature so the
                // data URL matches the real bytes — a PNG wrapped as jpeg causes
                // "flate: corrupt input" decode errors in vision models.
                const mime = imageSource.startsWith('iVBORw0KGgo') ? 'image/png'
                  : imageSource.startsWith('/9j/') ? 'image/jpeg'
                  : imageSource.startsWith('R0lGOD') ? 'image/gif'
                  : imageSource.startsWith('UklGR') ? 'image/webp'
                  : 'image/jpeg';
                return `data:${mime};base64,${imageSource}`;
              }
              // File / Blob — read asynchronously
              return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to read image file'));
                reader.readAsDataURL(imageSource);
              });
            },

            /**
             * Send a vision request to Ollama's OpenAI-compatible /v1/chat/completions.
             *
             * When `schema` is provided, the response is parsed as JSON (code fences
             * are stripped) and the parsed object is returned. Otherwise a
             * { content, raw } object is returned.
             *
             * Usage (structured):
             *   const result = await client.integrations.Core.vision.send(
             *     endpoint, model, dataUrl, "Describe this image",
             *     { type: "object", properties: { description: { type: "string" } } },
             *     0,
             *   );
             *
             * Usage (plain text):
             *   const { content } = await client.integrations.Core.vision.send(
             *     endpoint, model, dataUrl, "What is in this image?", null, 0,
             *   );
             */
            async send(endpoint: string, model: string, imageBase64: string, prompt: string, schema?: Record<string, any> | null, temperature?: number, signal?: AbortSignal): Promise<any> {
              const dataUrl = await this.encode(imageBase64);

              const body: Record<string, any> = {
                model,
                messages: [{ role: "user", content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: dataUrl } },
                ]}],
                temperature: temperature ?? 0,
              };

              if (schema) {
                body.response_format = { type: "json_schema", json_schema: { name: "result", strict: false, schema } };
              }

              const response = await fetch(`${endpoint.replace(/\/$/, '')}/v1/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal,
              });

              if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(`Local LMS error: ${response.status} ${response.statusText} — ${errText}`);
              }

              const raw = await response.json();
              let content = raw?.choices?.[0]?.message?.content ?? "{}";

              if (schema) {
                if (typeof content === "string") {
                  content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
                  return JSON.parse(content);
                }
                return content;
              }

              return { content, raw };
            },
          },
          /**
           * Expand a search query into 5-8 related terms using the LLM.
           * Returns an array always containing the original query plus expanded terms.
           * Usage:
           *   const terms = await client.integrations.Core.expandQuery("coral reefs");
           */
          async expandQuery(query: string, signal?: AbortSignal): Promise<string[]> {
            if (!query?.trim()) return [];
            const endpoint = resolvedOllamaEndpoints[0] || resolvedOllamaEndpoints[1] || 'http://127.0.0.1:11434';
            const useModel = modelRouter.resolve('chat', query, resolvedModel);
            const prompt = `You are a search query expansion expert. Given the query "${query}", output a JSON array of 5-8 closely related search terms, synonyms, and technical concepts that would help retrieve relevant documents. Output ONLY the JSON array, no explanation. Example: ["term1","term2","term3"]`;

            const controller = new AbortController();
            if (signal) signal.addEventListener('abort', () => controller.abort());
            const expTimeout = setTimeout(() => controller.abort(), 90000);
            const res = await fetch(`${endpoint.replace(/\/$/, '')}/v1/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: useModel, messages: [{ role: 'user', content: prompt }], stream: false }),
              signal: controller.signal,
            }).finally(() => clearTimeout(expTimeout));
            if (!res.ok) throw new Error(`expandQuery error: ${res.status}`);
            const json = await res.json();
            const text = json.choices?.[0]?.message?.content || '';
            const match = text.match(/\[[\s\S]*?\]/);
            if (!match) return [query];
            const expanded = JSON.parse(match[0]).filter((t: unknown) => typeof t === 'string' && t.trim());

            console.log([query, ...expanded.slice(0, 7)]);
            return [query, ...expanded.slice(0, 7)];
          },
          /**
           * Run a solutions debate: prompt → keywords → 2 personas → LLM debate → solutions manifest.
           *
           * Flow:
           *   1. Converts the user prompt into focused search keywords.
           *   2. Queries two personas from Elasticsearch matching those keywords.
           *   3. Runs a multi-turn debate between the two personas (analyze → critique → refine).
           *   4. Produces a final solutions manifest with resolved approach and key arguments.
           *
           * Returns:
           *   { manifest, personas, debate }
           *
           * Usage:
           *   const { manifest, personas, debate } = await client.integrations.Core.solution(
           *     "How can we reduce plastic waste in the ocean?"
           *   );
           */
          async solution(prompt: string, signal?: AbortSignal): Promise<{ manifest: string; personas: any[]; debate: string[] }> {
            // ── 1. Convert prompt to focused search keywords ──
            const kwEndpoint = resolvedOllamaEndpoints[0] || resolvedOllamaEndpoints[1] || 'http://127.0.0.1:11434';
            const keywordPrompt = `Given the problem statement: "${prompt}". Output ONLY a JSON array of 3-5 focused search keywords that would find AI personas qualified to solve this problem. Example: ["keyword1","keyword2"]. Output ONLY the JSON array.`;
            const kwModel = modelRouter.resolve('json', keywordPrompt, resolvedModel);
            const controller = new AbortController();
            if (signal) signal.addEventListener('abort', () => controller.abort());
            const kwTimeout = setTimeout(() => controller.abort(), 90000);
            const kwRes = await fetch(`${kwEndpoint.replace(/\/$/, '')}/v1/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: kwModel, messages: [{ role: 'user', content: keywordPrompt }], stream: false }),
              signal: controller.signal,
            }).finally(() => clearTimeout(kwTimeout));
            if (!kwRes.ok) throw new Error(`solution keyword error: ${kwRes.status}`);
            const kwJson = await kwRes.json();
            const kwText = kwJson.choices?.[0]?.message?.content || '';
            const match = kwText.match(/\[[\s\S]*?\]/);
            const keywords: string[] = match
              ? JSON.parse(match[0]).filter((t: unknown) => typeof t === 'string')
              : [prompt];
            const terms = [prompt, ...keywords].slice(0, 7);
            console.log(terms);

            // ── 2. Query two personas from ES matching the keywords ──
            //    Use multi_match full-text search (not wildcards) so ES
            //    relevance scoring ranks the best-matching personas first.
            //    Wildcard queries on .keyword score all matches equally (1.0),
            //    so results are non-deterministic — multi_match is stable.
            const esCfg = getEsConfig();
            const personaIndex = esCfg.indices?.['Persona'] || 'sample-prompt-persona';
            const seen = new Set<string>();
            const personas: any[] = [];

            const shouldClauses = terms.map((term: string) => ({
              multi_match: {
                query: term,
                fields: ['name^3', 'description^2', 'expertise_areas', 'instructions', 'tags'],
                type: 'best_fields',
                operator: 'or',
              },
            }));

            const searchRes = await fetch(`${esCfg.endpoint}/${personaIndex}/_search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: { bool: { should: shouldClauses, minimum_should_match: 1 } },
                size: 10,
                sort: [{ _score: { order: 'desc' } }, { created_date: { order: 'desc' } }],
              }),
            });
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              const hits = searchData.hits?.hits || [];
              for (const hit of hits) {
                if (!seen.has(hit._id) && personas.length < 2) {
                  seen.add(hit._id);
                  personas.push({ id: hit._id, ...hit._source });
                }
              }
            }
            if (personas.length < 2) {
              // Fallback: keyword search found too few — list any available personas
              const allPersonas = await esEntities.Persona.list('-created_date', 10);
              for (const p of allPersonas) {
                if (!seen.has(p.id) && personas.length < 2) {
                  seen.add(p.id);
                  personas.push(p);
                }
              }
            }
            if (personas.length < 2) {
              throw new Error(`solution: need 2 personas but only found ${personas.length} for "${prompt}"`);
            }

            // ── 3. Multi-turn debate between the two personas ──
            const systemA = `You are ${personas[0].name}. ${personas[0].description || ''}. ${personas[0].instructions || ''} Respond concisely as this persona.`;
            const systemB = `You are ${personas[1].name}. ${personas[1].description || ''}. ${personas[1].instructions || ''} Respond concisely as this persona.`;
            const debate: string[] = [];

            // Turn 1: Persona A analyzes problem and proposes solutions
            const t1 = await invokeLLM({
              system: systemA,
              messages: [{ role: 'user', content: `Problem: "${prompt}". Analyze this problem and propose your key solution in 2–3 sentences.` }],
              ollamaEndpoints: resolvedOllamaEndpoints,
              defaultModel: resolvedModel,
              model: modelRouter.resolve('thinking', prompt, resolvedModel),
              temperature: 0.7,
            });
            debate.push(t1 as string);

            // Turn 2: Persona B critiques Persona A and offers an alternative approach
            const t2 = await invokeLLM({
              system: `${systemB}. ${personas[0].name} just said: "${(t1 as string).slice(0, 300)}"`,
              messages: [{ role: 'user', content: `Critique the solution proposed above and offer your own alternative approach to "${prompt}" in 2–3 sentences.` }],
              ollamaEndpoints: resolvedOllamaEndpoints,
              defaultModel: resolvedModel,
              model: modelRouter.resolve('thinking', prompt, resolvedModel),
              temperature: 0.7,
            });
            debate.push(t2 as string);

            // Turn 3: Persona A rebuts and refines their position
            const t3 = await invokeLLM({
              system: `${systemA}. ${personas[1].name} just argued: "${(t2 as string).slice(0, 300)}"`,
              messages: [{ role: 'user', content: `Respond to the critique and refine your solution in 2–3 sentences.` }],
              ollamaEndpoints: resolvedOllamaEndpoints,
              defaultModel: resolvedModel,
              model: modelRouter.resolve('thinking', prompt, resolvedModel),
              temperature: 0.7,
            });
            debate.push(t3 as string);

            // ── 4. Final summary produces the solutions manifest ──
            const t4 = await invokeLLM({
              system: 'You are an impartial solution synthesis expert. Synthesize the best of both perspectives into a concrete, actionable solution.',
              messages: [
                { role: 'user', content: `${personas[0].name} argued:\n${(t1 as string).slice(0, 400)}\n` },
                { role: 'user', content: `${personas[1].name} argued:\n${(t2 as string).slice(0, 400)}\n` },
                { role: 'user', content: `${personas[0].name} refined:\n${(t3 as string).slice(0, 400)}\n` },
              ],
              ollamaEndpoints: resolvedOllamaEndpoints,
              defaultModel: resolvedModel,
              model: modelRouter.resolve('chat', prompt, resolvedModel),
              temperature: 0.5,
              response_json_schema: null,
            });
            const manifest = t4 as string;

            return { manifest, personas, debate };
          },
          thinking: (prompt) => thinkingStreamingFetch(prompt, { ollamaEndpoints: resolvedOllamaEndpoints, model: resolvedModel }),
          websearch: (params) => {
            // #8: Route to best model for websearch task
            const routedModel = modelRouter.resolve('websearch', params?.prompt || '', resolvedModel);
            telemetry.emit('client:model-routed', { task: 'websearch', model: routedModel });
            return clientLogger.timed('websearch', () =>
              webSearch({ ...params, ollamaEndpoints: resolvedOllamaEndpoints, defaultModel: routedModel })
            );
          },
          toolbox: (params) => {
            const routedModel = modelRouter.resolve('tool_call', params?.prompt || '', resolvedModel);
            return clientLogger.timed('toolbox', () =>
              multiToolRun({ ...params, ollamaEndpoints: resolvedOllamaEndpoints, defaultModel: routedModel })
            );
          },
          InvokeLLM: (params) => {
            // #4 + #8: Timed + model routing
            const taskType = params?.response_json_schema ? 'json' : 'chat';
            // Route using prompt text or last user message content
            const routeText = params?.prompt
              || (params?.messages?.length
                ? [...params.messages].reverse().find((m: any) => m.role === 'user')?.content || ''
                : '');
            const routedModel = modelRouter.resolve(taskType, routeText, resolvedModel);
            telemetry.emit('client:request-start', { tool: 'InvokeLLM', model: routedModel });
            // #7: Register abort controller for this call
            const controller = abortManager.create('InvokeLLM');
            return clientLogger.timed('InvokeLLM', () =>
              invokeLLM({ ...params, signal: controller.signal, ollamaEndpoints: resolvedOllamaEndpoints, defaultModel: routedModel })
            ).finally(() => {
              telemetry.emit('client:request-end', { tool: 'InvokeLLM' });
              abortManager.cancel('InvokeLLM');
            });
          },
          // #5: Batched variant for parallel calls
          InvokeLLMBatched: batchedInvoke,
          UploadFile: async () => {},
          SendEmail: async () => {},
          GenerateImage: async () => {},
          ExtractDataFromUploadedFile: async () => {},
        }
    },
    // ── Expose improvement utilities on the client ──
    // #3: circuit breaker
    circuitBreaker,
    // #7: abort manager
    abortManager,
    // #4: structured logger (timed/info/warn/error)
    clientLogger,
    // #10: telemetry emitter/subscriber
    telemetry,
    // #6: tool registry
    toolRegistry,
    // #8: model router
    modelRouter,
    // #9: prompt router (openai-style enhancement of routed prompt)
    promptRouter,
    // #2: auth middleware
    authMiddleware,
    // ES entities proxy and endpoint — used by tests and app code via client
    esEntities,
    esEndpoint: getEsConfig().endpoint,
  };
  return client;
}






export const config = {
  serverUrl: getElasticsearchEndpoint(),
  appId: appId,
  functionsVersion: functionsVersion ?? undefined,
  entityEndpoint: [getElasticsearchEndpoint()],
  headers: {
    'Content-Type': 'application/json',
    'X-App-Id': String(appId),
  },
  capabilities: {},
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'why is the sky blue' },
  ],
  ollamaEndpoints: [getOllamaEndpoint(), 'http://127.0.0.1:11434'],
  model: 'qwen3:0.6b',
};





export const defaultClient = createClient(config);




// Create entity proxy with automatic fallback
const createEntityProxy = (entityName, baseEntity) => {
  return new Proxy(baseEntity, {
    get(target, prop) {
      if (typeof target[prop] !== 'function') {
        return target[prop];
      }
      
      return async (...args) => {
        try {
          // If we know apiClient is down, skip directly to Elasticsearch
          if (apiIsDown) {
            if (elasticsearchOps[prop]) {
              console.log(`📊 Using Elasticsearch for ${entityName}.${prop}`);
              return await elasticsearchOps[prop](entityName, ...args);
            }
            throw new Error(`Operation ${prop} not supported in Elasticsearch fallback`);
          }
          
          // Try apiClient first
          return await target[prop](...args);
        } catch (error) {
          // Check if it's a network/server error
          const isServerError = 
            error.message?.includes('fetch') || 
            error.message?.includes('network') ||
            error.message?.includes('Failed to fetch') ||
            error.status >= 500;
          
          if (isServerError) {
            console.warn(`⚠️ apiClient ${prop} failed for ${entityName}, switching to Elasticsearch:`, error.message);
            
            // Mark apiClient as down
            apiIsDown = true;
            lastCheckTime = Date.now();
            
            if (elasticsearchOps[prop]) {
              try {
                console.log(`📊 Using Elasticsearch fallback for ${entityName}.${prop}`);
                return await elasticsearchOps[prop](entityName, ...args);
              } catch (esError) {
                console.error(`❌ Elasticsearch fallback also failed for ${entityName}.${prop}:`, esError.message);
                throw error; // Throw original apiClient error
              }
            }
          }
          
          throw error;
        }
      };
    }
  });
};


// Create client wrapper with automatic fallback
export const createclientWithFallback = (originalclient) => {

      const formData =  {"name": "Marine Biologist",
  "creator_name": null,
  "description": "Scientist studying ocean life and marine ecosystems",
  "icon": "🐠",
  "color": "from-blue-500 to-teal-600",
  "category": "Science",
  "status": "draft",
  "project": null,
  "instructions": "Explain marine life, ocean ecosystems, and conservation with scientific expertise.",
  "tone": "Enthusiastic",
  "expertise_areas": [
    "Marine Biology",
    "Ocean Ecology",
    "Conservation",
    "Research"
  ]};
      const expertiseAreas = [
    "Marine Biology",
    "Ocean Ecology",
    "Conservation",
    "Research"
  ];
      const endpoint =  "http://127.0.0.1:11434";
      const model = 'llama3:latest';
      
  return {
    ...defaultClient,
    entities: new Proxy(defaultClient.entities, {
      get(target, entityName) {
        if (typeof entityName === 'symbol' || entityName === 'then') {
          return target[entityName];
        }
        
        const baseEntity = target[entityName];
        if (!baseEntity) return baseEntity;
        
        return createEntityProxy(entityName, baseEntity);
      }
    })
  };
};




// Full ES-backed entity management — no React hook needed at module level.
// createEsEntities returns a Proxy: client.entities.Persona.list(), .filter(), .get(), etc.
export const esConfig = getEsConfig();

export const baseClient = _local
  ? { ...defaultClient, entities: esEntities }
  : createclientWithFallback({ ...defaultClient, entities: esEntities });

baseClient.entities = esEntities;

export const client = createclientWithFallback(baseClient);

// Direct access to ES-backed entities and config helpers
export { esEntities, getEsConfig, saveEsConfig, createEsEntities };
