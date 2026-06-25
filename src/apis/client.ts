import axios from 'axios'; // Import axios directly

import { appParams, appId, token, functionsVersion, appBaseUrl, getAppParams, localStorage, LS_PREFIX } from "../apis/lib/app-params.ts";

import { createEsEntities, getEsConfig, saveEsConfig, esEntities } from "../apis/lib/es-entities.ts";
import { validateClientConfig } from "../apis/lib/config-schema.ts";
import { clientLogger } from "../apis/lib/client-logger.ts";
import { createCircuitBreaker } from "../apis/lib/circuit-breaker.ts";
import { telemetry } from "../apis/lib/telemetry.ts";
import { toolRegistry } from "../apis/lib/tool-registry.ts";
import { modelRouter } from "../apis/lib/model-router.ts";
import { createBatcher } from "../apis/lib/request-batcher.ts";
import { createAuthMiddleware } from "../apis/lib/auth-middleware.ts";
import { abortManager } from "../apis/lib/abort-manager.ts";

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
    : (process.env.HOSTNAME || 'localhost');
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
};

/**
 * Returns the Ollama endpoint.
 * - browser + local  → '/proxy'  (Vite dev proxy)
 * - Node   + local   → 'http://localhost:11434'  (direct)
 * - remote           → ngrok public URL
 */
export const getOllamaEndpoint = () => {
  if (_isLocal()) {
    return _isBrowser ? '/proxy' : 'http://localhost:11434';
  }
  return 'https://christy-ramentaceous-verbatim.ngrok-free.dev';
};

/**
 * Returns the Elasticsearch endpoint.
 * - browser + local  → '/db'  (Vite dev proxy)
 * - Node   + local   → 'http://localhost:9200'  (direct)
 * - remote           → ngrok public URL
 */
export const getElasticsearchEndpoint = () => {
  if (_isLocal()) {
    return _isBrowser ? '/db' : 'http://localhost:9200';
  }
  return 'https://eu-vector-cloud.ngrok.dev';
};

export const prompt = 'why is the sky blue' ;

export const config = {
  serverUrl: getElasticsearchEndpoint(),
  appId: appId,
  functionsVersion: functionsVersion ?? undefined,
  entityEndpoint: [getElasticsearchEndpoint()],
  headers: {
    'Content-Type': 'application/json',
    'X-App-Id': String(appId),
  },
  prompt: prompt,
  capabilities: {},
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content:prompt},
  ],
  ollamaEndpoints: [getOllamaEndpoint(), 'http://localhost:11434'],
  model: 'qwen3:8b',
};




export const createOllamaClient = (apiKey?: string) => {
  return { apiKey };
}



/**
 * Streams thoughts and responses from the LLM using vanilla fetch.
 */
export async function thinkingStreamingFetch(prompt) {
  try {
    // Get the appropriate endpoint based on your configuration
    const endpoint = config.ollamaEndpoints[1]+'/v1/chat/completions';
    //'https://your-ollama-endpoint.';

    // Prepare the request payload
    const requestBody = JSON.stringify({
      model: 'qwen3:8b',
      messages: [
        {
          role: 'user',
          content:prompt,
        },
      ],
      stream: false,
      think: true,
    });

    // Make the fetch request
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });

    // Check for a successful response status
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}, Message: ${await response.text()}`);
    }

    // Handle streaming responses
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let startedThinking = false;
    let finishedThinking = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim() === '') continue;

        try {
          const message = line;
          process.stdout.write( message);
        } catch (parseError) {
          console.error('Failed to parse chunk:', line, parseError);
        }
      }
    }
  } catch (error) {
    console.error('Error invoking LLM:', error.message);
  }
}

/**
 * Standalone InvokeLLM — calls Ollama's OpenAI-compatible /v1/chat/completions endpoint.
 * Returns parsed JSON when response_json_schema is provided, otherwise plain text.
 */
export async function invokeLLM(opts) {
  console.log(opts);
  const {
      
    add_context_from_internet = false,
    response_json_schema = null,
    file_urls = null,
    model: requestedModel = null,
    ollamaEndpoints,
    defaultModel,
  } = opts || {};

  const prompt = 'InvokeLLM explain ';

  const endpoint =
    ollamaEndpoints[1] || ollamaEndpoints[0] || 'http://localhost:11434';
  const useModel = requestedModel || defaultModel || 'qwen3:8b';

  const messages: Array<{ role: string; content: string }> = [];

  if (add_context_from_internet) {
    try {
      const results = await websearchTools?.search?.(prompt);
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

  messages.push({ role: 'user', content: prompt });

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
    stream: false,
  };

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
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `InvokeLLM error: ${res.status} ${res.statusText}${errText ? ` — ${errText}` : ''}`
    );
  }

  const data = await res.json();
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

/**
 * Standalone webSearch — uses Ollama SDK with web search/fetch tools.
 * Returns the accumulated assistant content string.
 */
export async function webSearch(opts: {
  prompt: string;
  model?: string | null;
  ollamaEndpoints: string[];
  defaultModel: string;
}) {
  const {
    prompt,
    model: requestedModel = null,
    ollamaEndpoints,
    defaultModel,
  } = opts || {};

  if (!prompt) throw new Error('webSearch requires a "prompt" parameter.');

  const host =
    ollamaEndpoints[1] || ollamaEndpoints[0] || 'http://localhost:11434';
  const useModel = requestedModel || defaultModel || 'qwen3:8b';

  const webSearchTool = {
    type: 'function' as const,
    function: {
      name: 'webSearch',
      description: 'Performs a web search for the given query.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query string.' },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return per query (default 3).',
          },
        },
        required: ['query'],
      },
    },
  };

  const webFetchTool = {
    type: 'function' as const,
    function: {
      name: 'webFetch',
      description: 'Fetches a single page by URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'A single URL to fetch.' },
        },
        required: ['url'],
      },
    },
  };

  const messages = [{ role: 'user', content: prompt }];

  const res = await fetch(`${host}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: useModel, messages, stream: false, think: true }),
  });
  if (!res.ok) throw new Error(`webSearch error: ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

/**
 * Standalone multiToolRun — uses Ollama SDK with mock weather tools.
 * Accepts an optional prompt (defaults to a weather demo prompt) and
 * returns the accumulated assistant content string.
 */
export async function multiToolRun(opts: {
  prompt?: string;
  model?: string | null;
  ollamaEndpoints: string[];
  defaultModel: string;
}) {
  const {
    prompt,
    model: requestedModel = null,
    ollamaEndpoints,
    defaultModel,
  } = opts || {};

  const host =
    ollamaEndpoints[1] || ollamaEndpoints[0] || 'http://localhost:11434';
  const useModel = requestedModel || defaultModel || 'qwen3:8b';

  const cities = ['London', 'Paris', 'New York', 'Tokyo', 'Sydney'];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const city2 = cities[Math.floor(Math.random() * cities.length)];

  const messages: Message[] = [
    {
      role: 'user',
      content: prompt || `What is the temperature in ${city}? and what are the weather conditions in ${city2}?`,
    },
  ];

  const getTemperature = (args: { city: string }): string => {
    if (!cities.includes(args.city)) return 'Unknown city';
    return `${Math.floor(Math.random() * 36)} degrees Celsius`;
  };

  const getConditions = (args: { city: string }): string => {
    if (!cities.includes(args.city)) return 'Unknown city';
    const conditions = ['sunny', 'cloudy', 'rainy', 'snowy'];
    return conditions[Math.floor(Math.random() * conditions.length)];
  };

  const toolSchemas = [
    {
      type: 'function' as const,
      function: {
        name: 'getTemperature',
        description: 'Get the temperature for a city in Celsius',
        parameters: {
          type: 'object',
          required: ['city'],
          properties: {
            city: { type: 'string', description: 'The name of the city' },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'getConditions',
        description: 'Get the weather conditions for a city',
        parameters: {
          type: 'object',
          required: ['city'],
          properties: {
            city: { type: 'string', description: 'The name of the city' },
          },
        },
      },
    },
  ];

  const availableFunctions: Record<string, (args: { city: string }) => string> = {
    getTemperature,
    getConditions,
  };

  // First pass: ask model what tools to call
  const res1 = await fetch(`${host}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: useModel, messages, tools: toolSchemas, stream: false }),
  });
  if (!res1.ok) throw new Error(`multiToolRun error: ${res1.status}`);
  const data1 = await res1.json();
  const assistantMsg = data1?.choices?.[0]?.message;
  if (!assistantMsg) return '';

  messages.push(assistantMsg);

  if (assistantMsg.tool_calls?.length) {
    for (const tool of assistantMsg.tool_calls) {
      const fn = availableFunctions[tool.function?.name];
      if (fn) {
        const output = fn(tool.function.arguments as any);
        messages.push({ role: 'tool', content: output.toString(), tool_call_id: tool.id } as any);
      }
    }
    // Second pass: get final answer with tool results
    const res2 = await fetch(`${host}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: useModel, messages, stream: false }),
    });
    if (!res2.ok) throw new Error(`multiToolRun final error: ${res2.status}`);
    const data2 = await res2.json();
    return data2?.choices?.[0]?.message?.content ?? '';
  }

  return assistantMsg.content ?? '';
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
          { name: 'Persona', defaultIndex: 'prompt-hub-persona'},
          { name: 'Template', defaultIndex: 'prompt-hub-template'},
          { name: 'ChatSession', defaultIndex: 'prompt-hub-session'},
          { name: 'Scenario', defaultIndex: 'prompt-hub-scenario'},
          { name: 'DevilsAdvocateResult', defaultIndex: 'prompt-hub-devils'},
          { name: 'AnalogyBuilderResult', defaultIndex: 'prompt-hub-analogy'},
          { name: 'PersonaDebateResult', defaultIndex: 'prompt-hub-debate'},
          { name: 'ContentRepurposerResult', defaultIndex: 'prompt-hub-repurpose'},
          { name: 'StructureArchitectResult', defaultIndex: 'prompt-hub-outline'},
          { name: 'GeneratorList', defaultIndex: 'prompt-hub-generator-list'}
        ],
    capabilities:{},
    setConfig: async (newConfig) => {
      saveEsConfig(newConfig);
    },
    config: configResolved,
    getEsConfig,
    saveEsConfig,
    integrations: {
        Core: {
          vision: async () => {},
          thinking: thinkingStreamingFetch,
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
            const routedModel = modelRouter.resolve(taskType, params?.prompt || '', resolvedModel);
            telemetry.emit('client:request-start', { tool: 'InvokeLLM', model: routedModel });
            // #7: Register abort controller for this call
            const controller = abortManager.create('InvokeLLM');
            return clientLogger.timed('InvokeLLM', () =>
              invokeLLM({ ...params, ollamaEndpoints: resolvedOllamaEndpoints, defaultModel: routedModel })
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
    // #10: telemetry emitter/subscriber
    telemetry,
    // #6: tool registry
    toolRegistry,
    // #8: model router
    modelRouter,
    // #2: auth middleware
    authMiddleware,
    // ES entities proxy and endpoint — used by tests and app code via client
    esEntities,
    esEndpoint: getElasticsearchEndpoint(),
  };

  return client;
}






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


/*
{
  "name": "Marine Biologist",
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
  ],
  "example_prompts": [
    "Dr. Coral: 'The health of coral reefs is crucial for the survival of countless marine species.'",
    "Dr. Coral: 'By studying these tiny organisms, we can uncover how larger ecosystems function and thrive.'",
    "Dr. Coral: 'It's vital that we continue to protect our oceans because they are the lungs of our planet.'"
  ],
  "tags": [
    "marine biology",
    "ocean",
    "science",
    "conservation"
  ],
  "is_custom": false,
  "is_public": true,
  "use_count": 0,
  "rating": 0,
  "rating_count": 0,
  "user_ratings": {},
  "prompt_count": 0,
  "parent_persona_id": null,
  "family_name": null,
  "inherited_traits": [],
  "unique_traits": [],
  "specialization": null,
  "voice_profile": {
    "vocabulary": [
      "coral reefs",
      "biodiversity",
      "ecosystems",
      "habitat",
      "endangered species",
      "marine life",
      "conservation",
      "fieldwork"
    ],
    "sentence_patterns": [
      "Short and to the point for clarity.",
      "Active voice to emphasize action and engagement.",
      "Longer sentences to provide detailed explanations."
    ],
    "style_traits": [
      "Technical depth",
      "Use of scientific terminology",
      "Storytelling through real-life examples"
    ],
    "example_phrases": [
      "Dr. Coral: 'In this study, we discovered that coral reefs are not just habitats but entire ecosystems.'",
      "Dr. Coral: 'Our findings suggest that protecting specific species could have a cascading effect on the health of the reef as a whole.'",
      "Dr. Coral: 'The data collected during our fieldwork has been invaluable in shaping our understanding of these delicate systems.'"
    ],
    "tone_recommendation": {
      "primary_tone": "Professional",
      "modifiers": [
        "Enthusiastic",
        "Friendly"
      ],
      "adjustment_rules": [
        "Adjust to a more casual tone when communicating with non-scientific audiences.",
        "Maintain a formal tone for academic publications and presentations."
      ]
    },
    "dos": [
      "Use scientific jargon appropriately to convey complex ideas clearly.",
      "Share real-life examples and case studies to illustrate points effectively.",
      "Engage the audience by using analogies and metaphors where appropriate."
    ],
    "donts": [
      "Avoid overly technical language that may confuse non-scientific readers.",
      "Forgo storytelling in favor of presenting dry facts without context.",
      "Rely too heavily on jargon without explanation, making it difficult for those unfamiliar with the field to understand."
    ],
    "personality_summary": "Dr. Coral presents herself as a knowledgeable and passionate marine biologist, combining technical expertise with a love for storytelling and real-world applications of her research."
  },
  "collaborators": [],
  "change_log": [],
  "version": 1,
  "version_history": [],
  "id": "6951e9bb0ad495094419e4cd",
  "created_date": "2025-12-29T02:38:51.197000",
  "updated_date": "2026-01-03T21:54:17.004000",
  "created_by_id": "6901f73a3178f5670b5f2459",
  "created_by": "tokenfreeai@gmail.com",
  "is_sample": false
}*/
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
      const endpoint =  "http://localhost:11434";
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





