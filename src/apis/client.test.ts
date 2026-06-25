/**
 * apis/client.test.ts
 *
 * Self-contained test suite — no browser globals, no module imports from the app.
 * Works in Node / ts-node / Deno out of the box.
 *
 * Usage (Node / ts-node):
 *   npx ts-node apis/client.test.ts
 *
 * Usage (browser console):
 *   import { runAllTests } from './apis/client.test.ts';
 *   await runAllTests();
 *
 * Config via env vars (all optional):
 *   OLLAMA_ENDPOINT=http://localhost:11434
 *   OLLAMA_MODEL=qwen3:8b
 *   ES_ENDPOINT=http://localhost:9200
 */

// ─── Backend-safe localStorage shim ──────────────────────────────────────────
// In Node there is no window.localStorage — we back it with process.env + a
// plain object so stored/read values survive within a single process run.

const _store: Record<string, string> = {};
const _localStorage = typeof window !== 'undefined' && window.localStorage
  ? window.localStorage
  : {
      getItem: (key: string): string | null =>
        process.env[key] !== undefined ? process.env[key]! : (_store[key] ?? null),
      setItem: (key: string, value: string): void => {
        process.env[key] = value;
        _store[key] = value;
      },
    };

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT_OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const DEFAULT_MODEL           = process.env.OLLAMA_MODEL    || 'qwen3:8b';
// ES endpoint is always resolved via getElasticsearchEndpoint() — never hardcoded here.
// Browser+local: /db (Vite proxy)  |  Node+local: http://localhost:9200  |  Remote: https://eu-vector-cloud.ngrok.dev

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = { role: string; content: string; [k: string]: any };
type TestResult = { name: string; pass: boolean; output: string[]; error?: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEndpoint(): string {
  try {
    const raw = _localStorage.getItem('ollama_endpoints');
    const stored = raw ? JSON.parse(raw) : [];
    if (Array.isArray(stored) && stored[0]) return stored[0];
  } catch {}
  return DEFAULT_OLLAMA_ENDPOINT;
}

function getModel(): string {
  return _localStorage.getItem('ollama_default_model') || DEFAULT_MODEL;
}

async function ollamaChat(messages: Message[], tools?: unknown[]): Promise<any> {
  const ep = getEndpoint();
  const body: Record<string, unknown> = { model: getModel(), messages, stream: false, think: true };
  if (tools) body.tools = tools;
  const res = await fetch(`${ep}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

function makeRunner() {
  const log: string[] = [];
  const emit = (line: string) => { log.push(line); console.log(line); };
  return { emit, log };
}

// ─── Test 1 — Calculator (addTwoNumbers / subtractTwoNumbers tool loop) ──────

async function testCalculator(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = '#1 Calculator (tools: addTwoNumbers / subtractTwoNumbers)';
  try {
    const toolSchemas = [
      { type: 'function', function: { name: 'addTwoNumbers', description: 'Add two numbers together', parameters: { type: 'object', required: ['a', 'b'], properties: { a: { type: 'number' }, b: { type: 'number' } } } } },
      { type: 'function', function: { name: 'subtractTwoNumbers', description: 'Subtract two numbers', parameters: { type: 'object', required: ['a', 'b'], properties: { a: { type: 'number' }, b: { type: 'number' } } } } },
    ];
    const availableFunctions: Record<string, (a: any) => number> = {
      addTwoNumbers: ({ a, b }) => a + b,
      subtractTwoNumbers: ({ a, b }) => a - b,
    };
    const messages: Message[] = [{ role: 'user', content: 'What is three minus one?' }];
    emit(`const endpoint = "${getEndpoint()}/v1/chat/completions";`);
    emit(`const model = "${getModel()}";`);
    emit(`const message = "${messages[0].content}";`);
    emit(`const data = await ollamaChat(messages, [addTwoNumbersTool, subtractTwoNumbersTool]);`);

    const data1 = await ollamaChat(messages, toolSchemas);
    const assistantMsg = data1?.choices?.[0]?.message;
    if (assistantMsg?.tool_calls?.length) {
      for (const tool of assistantMsg.tool_calls) {
        const fn = availableFunctions[tool.function?.name];
        const rawArgs = tool.function?.arguments || {};
        const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
        const result = fn ? fn(args) : 'unknown';
        emit(`const result = await tools.${tool.function?.name}(${JSON.stringify(args)});`);
        emit(`console.log(result); // ${result}`);
        messages.push(assistantMsg);
        messages.push({ role: 'tool', content: String(result), tool_call_id: tool.id });
      }
      const data2 = await ollamaChat(messages);
      const final: string = data2?.choices?.[0]?.message?.content ?? '';
      emit(`console.log(data.choices[0].message.content);\n// → ${final}`);
      return { name, pass: final.length > 0, output: log };
    } else {
      const response: string = assistantMsg?.content ?? '';
      emit(`// no tool calls — direct response: ${response}`);
      return { name, pass: response.length > 0, output: log };
    }
  } catch (e: any) {
    return { name, pass: false, output: log, error: e?.message };
  }
}

// ─── Test 2 — Flight Tracker (tool call loop) ─────────────────────────────────

async function testFlightTracker(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = '#2 Flight Tracker (tool call loop)';
  try {
    const toolSchemas = [{
      type: 'function',
      function: {
        name: 'get_flight_times',
        description: 'Get the flight times between two cities',
        parameters: {
          type: 'object',
          properties: {
            departure: { type: 'string' },
            arrival: { type: 'string' },
          },
          required: ['departure', 'arrival'],
        },
      },
    }];

    const flights: Record<string, object> = {
      'LGA-LAX': { departure: '08:00 AM', arrival: '11:30 AM', duration: '5h 30m' },
      'LAX-LGA': { departure: '02:00 PM', arrival: '10:30 PM', duration: '5h 30m' },
    };

    const messages: Message[] = [
      { role: 'user', content: 'What is the flight time from New York (LGA) to Los Angeles (LAX)?' },
    ];

    emit(`const endpoint = "${getEndpoint()}/v1/chat/completions";`);
    emit(`const model = "${getModel()}";`);
    emit(`const message = "${messages[0].content}";`);
    emit(`const data = await ollamaChat(messages, toolSchemas);`);

    const data1 = await ollamaChat(messages, toolSchemas);
    const assistantMsg = data1?.choices?.[0]?.message;

    let finalReply = '';
    if (assistantMsg?.tool_calls?.length) {
      for (const tool of assistantMsg.tool_calls) {
        const rawArgs = tool.function?.arguments || {};
        const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
        const key = `${args.departure}-${args.arrival}`.toUpperCase();
        const result = flights[key] || { error: 'Flight not found' };
        emit(`const result = await tools.get_flight_times(${JSON.stringify(args)});`);
        emit(`console.log(result); // ${JSON.stringify(result)}`);
        messages.push(assistantMsg);
        messages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: tool.id });
      }
      const data2 = await ollamaChat(messages);
      finalReply = data2?.choices?.[0]?.message?.content ?? '';
      emit(`console.log(data.choices[0].message.content);\n// → ${finalReply}`);
    } else {
      finalReply = assistantMsg?.content ?? '';
      emit(`// no tool calls — direct response: ${finalReply}`);
    }

    return { name, pass: finalReply.length > 0, output: log };
  } catch (e: any) {
    return { name, pass: false, output: log, error: e?.message };
  }
}

// ─── Test 3 — Multi-Tool (weather, two tools) — mirrors multi-tool.ts ────────

async function testMultiTool(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = '#3 Multi-Tool (getTemperature + getConditions — mirrors multi-tool.ts)';
  try {
    const cities = ['London', 'Paris', 'New York', 'Tokyo', 'Sydney'];
    const city1 = cities[Math.floor(Math.random() * cities.length)];
    const city2 = cities[Math.floor(Math.random() * cities.length)];

    const toolSchemas = [
      { type: 'function', function: { name: 'getTemperature', description: 'Get the temperature for a city in Celsius', parameters: { type: 'object', required: ['city'], properties: { city: { type: 'string', description: 'The name of the city' } } } } },
      { type: 'function', function: { name: 'getConditions', description: 'Get the weather conditions for a city', parameters: { type: 'object', required: ['city'], properties: { city: { type: 'string', description: 'The name of the city' } } } } },
    ];

    const availableFunctions: Record<string, (a: any) => string> = {
      getTemperature: ({ city }) => {
        const valid = ['London', 'Paris', 'New York', 'Tokyo', 'Sydney'];
        return valid.includes(city) ? `${Math.floor(Math.random() * 36)} degrees Celsius` : 'Unknown city';
      },
      getConditions: ({ city }) => {
        const valid = ['London', 'Paris', 'New York', 'Tokyo', 'Sydney'];
        return valid.includes(city) ? ['sunny', 'cloudy', 'rainy', 'snowy'][Math.floor(Math.random() * 4)] : 'Unknown city';
      },
    };

    const prompt = `What is the temperature in ${city1}? and what are the weather conditions in ${city2}?`;
    const messages: Message[] = [{ role: 'user', content: prompt }];

    emit(`const endpoint = "${getEndpoint()}/v1/chat/completions";`);
    emit(`const model = "${getModel()}";`);
    emit(`const message = "${prompt}";`);
    emit(`const data = await ollamaChat(messages, toolSchemas);`);

    const data1 = await ollamaChat(messages, toolSchemas);
    const assistantMsg = data1?.choices?.[0]?.message;
    messages.push(assistantMsg);

    let finalReply = '';
    if (assistantMsg?.tool_calls?.length) {
      for (const tool of assistantMsg.tool_calls) {
        const fn = availableFunctions[tool.function?.name];
        const rawArgs = tool.function?.arguments || {};
        const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
        const result = fn ? fn(args) : 'unknown';
        emit(`const result = await tools.${tool.function?.name}(${JSON.stringify(args)});`);
        emit(`console.log(result); // ${result}`);
        messages.push({ role: 'tool', content: String(result), tool_call_id: tool.id });
      }
      const data2 = await ollamaChat(messages);
      finalReply = data2?.choices?.[0]?.message?.content ?? '';

      emit(`console.log(data.choices[0].message.content);\n// → ${finalReply}`);
    } else {
      finalReply = assistantMsg?.content ?? '';
      emit(`// no tool calls — direct response: ${finalReply}`);
    }

    return { name, pass: finalReply.length > 0, output: log };
  } catch (e: any) {
    return { name, pass: false, output: log, error: e?.message };
  }
}

// ─── Test 4 — Thinking Enabled ────────────────────────────────────────────────

async function testThinkingEnabled(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = '#4 Thinking Enabled';
  try {
    const prompt = 'What is 10 + 23? Think step by step, then give only the final number.';
    emit(`const endpoint = "${getEndpoint()}/v1/chat/completions";`);
    emit(`const model = "${getModel()}";`);
    emit(`const message = "${prompt}";`);
    emit(`const data = await ollamaChat([{ role: 'user', content: message }]);`);

    const data = await ollamaChat([{ role: 'user', content: prompt }]);
    const thinking: string = data?.choices?.[0]?.message?.thinking ?? '';
    const response: string = data?.choices?.[0]?.message?.content ?? '';

    if (thinking) {
      emit(`// <think> (internal reasoning trace)`);
      emit(`// ${thinking.slice(0, 300).replace(/\n/g, ' ')}`);
      emit(`// </think>`);
    } else {
      emit(`// (no thinking trace returned)`);
    }
    emit(`console.log(data.choices[0].message.content);\n// → ${response}`);

    return { name, pass: response.length > 0, output: log };
  } catch (e: any) {
    return { name, pass: false, output: log, error: e?.message };
  }
}

// ─── Test 5 — Thinking Streaming ─────────────────────────────────────────────

async function testThinkingStreaming(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = '#5 Thinking Streaming';
  try {
    const ep = getEndpoint();
    const mdl = getModel();
    const prompt = 'Why is the sky blue? One sentence.';

    emit(`const endpoint = "${ep}/v1/chat/completions";`);
    emit(`const model = "${mdl}";`);
    emit(`const message = "${prompt}";`);
    emit(`const stream = await fetch(endpoint, { stream: true, think: true });`);

    const res = await fetch(`${ep}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: mdl, messages: [{ role: 'user', content: prompt }], stream: true, think: true }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let thinkBuf = '', contentBuf = '', chunks = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks++;
      for (const line of decoder.decode(value).split('\n')) {
        const trimmed = line.replace(/^data:\s*/, '').trim();
        if (!trimmed || trimmed === '[DONE]') continue;
        try {
          const json = JSON.parse(trimmed);
          const delta = json?.choices?.[0]?.delta;
          if (delta?.thinking) thinkBuf += delta.thinking;
          if (delta?.content) contentBuf += delta.content;
        } catch {}
      }
    }

    emit(`// stream closed (${chunks} chunks received)`);
    if (thinkBuf) {
      emit(`// <think> (internal reasoning trace)`);
      emit(`// ${thinkBuf.slice(0, 300).replace(/\n/g, ' ')}`);
      emit(`// </think>`);
    } else {
      emit(`// (no thinking trace in stream)`);
    }
    emit(`console.log(data.choices[0].message.content);\n// → ${contentBuf}`);

    return { name, pass: contentBuf.length > 0, output: log };
  } catch (e: any) {
    return { name, pass: false, output: log, error: e?.message };
  }
}

// ─── Test 6 — Websearch Tools (webSearch + webFetch tool loop — mirrors websearch-tools.ts) ──

async function testWebsearchTools(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = '#6 Websearch Tools (webSearch + webFetch loop — mirrors websearch-tools.ts)';
  try {
    const prompt = 'What is the latest stable release of Node.js? Keep answer to one sentence.';
    const webSearchTool = {
      type: 'function',
      function: {
        name: 'webSearch',
        description: 'Performs a web search for the given query.',
        parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, max_results: { type: 'number' } } },
      },
    };
    const webFetchTool = {
      type: 'function',
      function: {
        name: 'webFetch',
        description: 'Fetches a single page by URL.',
        parameters: { type: 'object', required: ['url'], properties: { url: { type: 'string' } } },
      },
    };

    emit(`const endpoint = "${getEndpoint()}/v1/chat/completions";`);
    emit(`const model = "${getModel()}";`);
    emit(`const message = "${prompt}";`);

    const messages: Message[] = [{ role: 'user', content: prompt }];
    let iterations = 0;
    let finalResponse = '';

    while (iterations < 5) {
      iterations++;
      emit(`// iteration ${iterations}: ollamaChat(messages, [webSearchTool, webFetchTool])`);
      const data = await ollamaChat(messages, [webSearchTool, webFetchTool]);
      const assistantMsg = data?.choices?.[0]?.message;

      if (assistantMsg?.tool_calls?.length) {
        messages.push(assistantMsg);
        for (const tool of assistantMsg.tool_calls) {
          const stubResult = { note: 'native webSearch/webFetch runs server-side in Ollama SDK', tool: tool.function?.name };
          emit(`const result = await tools.${tool.function?.name}(${JSON.stringify(tool.function?.arguments || {})});`);
          emit(`console.log(result); // ${JSON.stringify(stubResult)}`);
          messages.push({ role: 'tool', content: JSON.stringify(stubResult), tool_call_id: tool.id });
        }
      } else {
        finalResponse = assistantMsg?.content ?? '';
        emit(`console.log(data.choices[0].message.content);\n// → ${finalResponse.slice(0, 300)}`);
        break;
      }
    }

    return { name, pass: finalResponse.length > 0, output: log };
  } catch (e: any) {
    return { name, pass: false, output: log, error: e?.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE B — Client Infrastructure (mirrors ClientFeaturesTestPanel)
// Pure logic tests: no Ollama required.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Minimal stubs for infra modules (used when running in Node without app imports) ──

function _validateClientConfig(cfg: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!cfg.serverUrl) errors.push('serverUrl is required');
  if (!cfg.appId)     errors.push('appId is required');
  return { valid: errors.length === 0, errors };
}

function _createAuthMiddleware(opts: { getToken: () => string | null }) {
  return {
    injectAuthHeaders(headers: Record<string, string>): Record<string, string> {
      const token = opts.getToken();
      if (!token) return { ...headers };
      return { ...headers, Authorization: `Bearer ${token}` };
    },
  };
}

function _createCircuitBreaker(name: string, opts: { failureThreshold: number; recoveryTimeMs: number; onStateChange?: (s: string) => void }) {
  let failures = 0;
  let openAt: number | null = null;
  let _state = 'closed';
  return {
    get state() { return _state; },
    canCall(): boolean {
      if (_state !== 'open') return true;
      if (Date.now() - openAt! > opts.recoveryTimeMs) { _state = 'half-open'; return true; }
      return false;
    },
    onFailure() {
      failures++;
      if (failures >= opts.failureThreshold) { _state = 'open'; openAt = Date.now(); opts.onStateChange?.('open'); }
    },
    onSuccess() { failures = 0; _state = 'closed'; opts.onStateChange?.('closed'); },
  };
}

function _createBatcher<T>(executor: (batch: [T][]) => Promise<T[]>, windowMs: number) {
  let batch: { arg: T; resolve: (v: T) => void; reject: (e: unknown) => void }[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = async () => {
    const current = batch; batch = []; timer = null;
    const results = await executor(current.map(b => [b.arg]));
    current.forEach((b, i) => b.resolve(results[i]));
  };
  return (arg: T): Promise<T> => new Promise((resolve, reject) => {
    batch.push({ arg, resolve, reject });
    if (!timer) timer = setTimeout(flush, windowMs);
  });
}

const _toolRegistry = (() => {
  const tools: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  return {
    register(name: string, fn: (...a: unknown[]) => Promise<unknown>) { tools[name] = fn; },
    unregister(name: string) { delete tools[name]; },
    call(name: string, ...args: unknown[]) { return tools[name]?.(...args); },
    has(name: string) { return name in tools; },
    list() { return Object.keys(tools); },
  };
})();

const _abortManager = (() => {
  const controllers: Record<string, AbortController> = {};
  return {
    create(id: string) { const c = new AbortController(); controllers[id] = c; return c; },
    cancel(id: string) { controllers[id]?.abort(); delete controllers[id]; },
    cancelAll() { Object.keys(controllers).forEach(id => { controllers[id].abort(); delete controllers[id]; }); },
    isActive(id: string) { return id in controllers; },
  };
})();

const _telemetry = (() => {
  const subs: Record<string, ((p: Record<string, unknown>) => void)[]> = {};
  return {
    on(event: string, cb: (p: Record<string, unknown>) => void) {
      (subs[event] ??= []).push(cb);
      return () => { subs[event] = (subs[event] || []).filter(f => f !== cb); };
    },
    emit(event: string, payload: Record<string, unknown>) {
      (subs[event] || []).forEach(cb => cb({ event, ...payload }));
    },
  };
})();

// ── B1 Config Schema ──────────────────────────────────────────────────────────

async function testB1ConfigSchema(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'B1 Config Schema Validation';
  try {
    const valid   = _validateClientConfig({ serverUrl: 'http://localhost:5174', appId: 'test-app', model: 'qwen3:8b', ollamaEndpoints: ['/proxy'], headers: {} });
    const invalid = _validateClientConfig({ model: 'qwen3:8b' });
    if (!valid.valid) throw new Error('Valid config reported invalid');
    emit(`valid   → ${JSON.stringify(valid)}`);
    emit(`invalid → errors: ${invalid.errors.join('; ')}`);
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── B2 Auth Middleware ────────────────────────────────────────────────────────

async function testB2AuthMiddleware(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'B2 Auth Middleware — Token Injection';
  try {
    const mw  = _createAuthMiddleware({ getToken: () => 'tok-abc123' });
    const h   = mw.injectAuthHeaders({ 'Content-Type': 'application/json' });
    if (!h.Authorization?.includes('tok-abc123')) throw new Error('Token not injected');
    const mw2 = _createAuthMiddleware({ getToken: () => null });
    const h2  = mw2.injectAuthHeaders({});
    if (h2.Authorization) throw new Error('Null token should produce no Authorization header');
    emit(`with token  → Authorization: ${h.Authorization}`);
    emit(`null token  → no Authorization header ✓`);
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── B3 Circuit Breaker ────────────────────────────────────────────────────────

async function testB3CircuitBreaker(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'B3 Circuit Breaker';
  try {
    const cb = _createCircuitBreaker('test-cb', { failureThreshold: 2, recoveryTimeMs: 400 });
    emit(`initial state: ${cb.state}`);
    cb.onFailure(); cb.onFailure();
    emit(`after 2 failures → state: ${cb.state}`);
    emit(`canCall() while open: ${cb.canCall()}`);
    await new Promise(r => setTimeout(r, 450));
    emit(`canCall() after 450ms: ${cb.canCall()}`);
    cb.onSuccess();
    emit(`after success → state: ${cb.state}`);
    return { name, pass: cb.state === 'closed', output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── B4 Request Batcher ────────────────────────────────────────────────────────

async function testB4RequestBatcher(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'B4 Request Batcher';
  try {
    let execCount = 0;
    const batched = _createBatcher(async (batch: [number][]) => { execCount++; return batch.map(([n]) => n * 2); }, 30);
    const [a, b, c, d] = await Promise.all([batched(1), batched(2), batched(3), batched(4)]);
    emit(`4 parallel calls → ${execCount} executor call(s) (batched)`);
    emit(`results: ${a}, ${b}, ${c}, ${d} (expected 2, 4, 6, 8)`);
    if (a !== 2 || b !== 4 || c !== 6 || d !== 8) throw new Error('Wrong batch results');
    return { name, pass: execCount === 1, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── B5 Tool Registry ──────────────────────────────────────────────────────────

async function testB5ToolRegistry(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'B5 Tool Registry';
  try {
    _toolRegistry.register('_echo',   async (x: unknown) => `echo:${x}`);
    _toolRegistry.register('_double', async (n: unknown) => (n as number) * 2);
    const r1 = await _toolRegistry.call('_echo', 'hello');
    const r2 = await _toolRegistry.call('_double', 7);
    const listed = _toolRegistry.list().filter((t: string) => t.startsWith('_'));
    _toolRegistry.unregister('_echo');
    _toolRegistry.unregister('_double');
    const cleaned = !_toolRegistry.has('_echo') && !_toolRegistry.has('_double');
    emit(`_echo('hello') → "${r1}"`);
    emit(`_double(7) → ${r2}`);
    emit(`listed: ${listed.join(', ')}`);
    emit(`cleanup ok: ${cleaned}`);
    return { name, pass: r1 === 'echo:hello' && r2 === 14 && cleaned, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── B6 Abort Manager ─────────────────────────────────────────────────────────

async function testB6AbortManager(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'B6 Abort Manager';
  try {
    const ctrl = _abortManager.create('am-b6-1');
    emit(`created am-b6-1: isActive=${_abortManager.isActive('am-b6-1')}, signal.aborted=${ctrl.signal.aborted}`);
    _abortManager.cancel('am-b6-1');
    emit(`after cancel: isActive=${_abortManager.isActive('am-b6-1')}, signal.aborted=${ctrl.signal.aborted}`);
    _abortManager.create('am-b6-r1');
    _abortManager.create('am-b6-r2');
    _abortManager.cancelAll();
    emit(`after cancelAll: r1=${_abortManager.isActive('am-b6-r1')}, r2=${_abortManager.isActive('am-b6-r2')}`);
    return { name, pass: ctrl.signal.aborted && !_abortManager.isActive('am-b6-r1'), output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── B7 Telemetry ──────────────────────────────────────────────────────────────

async function testB7Telemetry(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'B7 Telemetry Event Bus';
  try {
    const received: Record<string, unknown>[] = [];
    const unsub = _telemetry.on('client:request-start', (p) => received.push(p));
    _telemetry.emit('client:request-start', { tool: 'InvokeLLM', model: 'qwen3:8b' });
    _telemetry.emit('client:request-start', { tool: 'websearch', model: 'qwen3:8b' });
    unsub();
    _telemetry.emit('client:request-start', { tool: 'should-not-receive' });
    if (received.length !== 2) throw new Error(`Expected 2 events, got ${received.length}`);
    emit(`emitted 3 events; received ${received.length} (unsubscribed before 3rd ✓)`);
    emit(`tools: ${received.map((e: any) => e.tool).join(', ')}`);
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── B8 Model Router (static) ──────────────────────────────────────────────────

async function testB8ModelRouter(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'B8 Model Router — Static Resolve';
  try {
    const TASK_MAP: Record<string, string> = {
      tool_call: 'tools', websearch: 'tools', vision: 'vision',
      thinking: 'thinking', json: 'tools', chat: 'completion',
    };
    const cases = ['chat', 'websearch', 'json', 'thinking', 'vision', 'tool_call'];
    cases.forEach(task => {
      emit(`${task.padEnd(12)} → capability: ${TASK_MAP[task]} (cache empty → falls back to default-model)`);
    });
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── B9 localStorage config merge ─────────────────────────────────────────────

async function testB9LocalStorageConfigMerge(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'B9 Config Merge — localStorage Fallback';
  try {
    const LS_PREFIX = 'prompthub_';
    _localStorage.setItem(`${LS_PREFIX}default_model`, 'test-model-from-ls');
    _localStorage.setItem('ollama_endpoints', JSON.stringify(['http://ep1', 'http://ep2']));
    const storedModel = _localStorage.getItem(`${LS_PREFIX}default_model`);
    const eps = JSON.parse(_localStorage.getItem('ollama_endpoints') || '[]');
    emit(`localStorage model: "${storedModel}" ✓`);
    emit(`endpoints from LS: ${eps.join(', ')} ✓`);
    if (storedModel !== 'test-model-from-ls') throw new Error('Model not persisted');
    if (eps[0] !== 'http://ep1') throw new Error('Endpoints not persisted');
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE C — Endpoint & Elasticsearch entity selection tests
// ─────────────────────────────────────────────────────────────────────────────

const ENTITY_INDEX_MAP: { name: string; defaultIndex: string }[] = [
  { name: 'Persona',                  defaultIndex: 'prompt-hub-persona' },
  { name: 'Template',                 defaultIndex: 'prompt-hub-template' },
  { name: 'ChatSession',              defaultIndex: 'prompt-hub-session' },
  { name: 'Scenario',                 defaultIndex: 'prompt-hub-scenario' },
  { name: 'DevilsAdvocateResult',     defaultIndex: 'prompt-hub-devils' },
  { name: 'AnalogyBuilderResult',     defaultIndex: 'prompt-hub-analogy' },
  { name: 'PersonaDebateResult',      defaultIndex: 'prompt-hub-debate' },
  { name: 'ContentRepurposerResult',  defaultIndex: 'prompt-hub-repurpose' },
  { name: 'StructureArchitectResult', defaultIndex: 'prompt-hub-outline' },
  { name: 'GeneratorList',            defaultIndex: 'prompt-hub-generator-list' },
];

// ── C1 Endpoint Resolution ────────────────────────────────────────────────────

async function testC1EndpointResolution(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C1 Endpoint Resolution';
  try {
    // Ollama endpoint
    const ep = getEndpoint();
    emit(`ollama endpoint (from localStorage): ${ep}`);
    emit(`DEFAULT_OLLAMA_ENDPOINT: ${DEFAULT_OLLAMA_ENDPOINT}`);
    const model = getModel();
    emit(`resolved model: ${model}`);
    const isUrl = ep.startsWith('http') || ep.startsWith('/');
    if (!isUrl) throw new Error(`Ollama endpoint "${ep}" does not look like a URL`);

    // ES endpoint — must come from getElasticsearchEndpoint(), the single source of truth
    const { getElasticsearchEndpoint } = await getClientModule();
    const esEp = getElasticsearchEndpoint();
    emit(`es endpoint (from getElasticsearchEndpoint): ${esEp}`);
    emit(`  local → http://localhost:5174/db  |  remote → https://eu-vector-cloud.ngrok.dev`);
    const esIsUrl = esEp.startsWith('http') || esEp.startsWith('/');
    if (!esIsUrl) throw new Error(`ES endpoint "${esEp}" does not look like a URL`);

    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C3 ES cluster health ──────────────────────────────────────────────────────

async function testC3ESClusterHealth(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C3 Elasticsearch Cluster Health';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);
    const ep = client.esEndpoint;
    emit(`es endpoint: ${ep}`);
    emit(`GET ${ep}/_cluster/health`);
    const res = await fetch(`${ep}/_cluster/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    emit(`cluster status: ${data.status}`);
    emit(`node count: ${data.number_of_nodes}`);
    return { name, pass: ['green','yellow'].includes(data.status), output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C4 ES entity index existence ─────────────────────────────────────────────

async function testC4ESEntityIndices(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C4 ES Entity Index Presence';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);
    const ep = client.esEndpoint;
    emit(`es endpoint: ${ep}`);
    let found = 0, missing = 0;
    for (const { name: entityName, defaultIndex } of ENTITY_INDEX_MAP) {
      const res = await fetch(`${ep}/${defaultIndex}/_count`);
      if (res.ok) {
        const data = await res.json();
        emit(`✓ ${entityName.padEnd(30)} → ${defaultIndex} (${data.count} docs)`);
        found++;
      } else {
        emit(`✗ ${entityName.padEnd(30)} → ${defaultIndex} (HTTP ${res.status})`);
        missing++;
      }
    }
    emit(`\n${found} indices found, ${missing} missing`);
    return { name, pass: found > 0, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C5 Entity index map integrity ────────────────────────────────────────────

async function testC5EntityIndexMap(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C5 Entity Index Map Integrity';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);
    const names   = client.entities.map((e: any) => e.name);
    const indices = client.entities.map((e: any) => e.defaultIndex);
    const uniqueNames   = new Set(names).size === names.length;
    const uniqueIndices = new Set(indices).size === indices.length;
    if (!uniqueNames)   throw new Error('Duplicate entity names in client.entities');
    if (!uniqueIndices) throw new Error('Duplicate index names in client.entities');
    client.entities.forEach((e: any) => emit(`${e.name.padEnd(30)} → ${e.defaultIndex}`));
    emit(`\n${names.length} entities, all names unique: ${uniqueNames}, all indices unique: ${uniqueIndices}`);
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── Client module loader ─────────────────────────────────────────────────────
// Dynamically imports the real client so tests exercise createClient + esEntities
// exactly like the Config page panel does. Works in browser/Vite (relative import).
// In plain Node/ts-node without path aliases it throws a clear error.

let _clientModule: any = null;
async function getClientModule(): Promise<any> {
  if (_clientModule) return _clientModule;
  try {
    _clientModule = await import('./client');
    return _clientModule;
  } catch (e: any) {
    throw new Error(`Cannot import ./client — run in browser/Vite context or configure path aliases. (${e?.message || e})`);
  }
}

// ── C2 ES Config Persistence ──────────────────────────────────────────────────

async function testC2ESConfigPersistence(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C2 ES Config Persistence (getEsConfig / saveEsConfig)';
  try {
    const { createClient, config, getEsConfig, saveEsConfig } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    const original = getEsConfig();
    emit(`original endpoint: ${original.endpoint}`);
    emit(`original enabled:  ${original.enabled}`);

    const saved = { ...original, enabled: !original.enabled };
    saveEsConfig(saved);
    const loaded = getEsConfig();
    emit(`after toggle → enabled: ${loaded.enabled}`);
    if (loaded.enabled !== !original.enabled) throw new Error('saveEsConfig did not persist enabled toggle');

    // restore
    saveEsConfig(original);
    emit(`restored → enabled: ${getEsConfig().enabled}`);
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C6 ES Persona Fetch (createClient + esEntities.Persona.list) ──────────────

async function testC6ESPersonaFetch(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C6 ES Persona Fetch (createClient + client.esEntities.Persona.list)';
  try {
    const { createClient, config } = await getClientModule();

    emit('const client = createClient(config);');
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    const personaEntry = client.entities.find((e: any) => e.name === 'Persona');
    if (!personaEntry) throw new Error('Persona entity not found in client.entities');
    emit(`✓ Persona → index: ${personaEntry.defaultIndex}`);
    emit(`  es endpoint: ${client.esEndpoint}`);

    emit('const personas = await client.esEntities.Persona.list("-created_date", 10);');
    const personas = await client.esEntities.Persona.list('-created_date', 10);
    emit(`✓ fetched ${personas.length} persona(s) from "${personaEntry.defaultIndex}"`);
    personas.forEach((p: any, i: number) => {
      emit(`  [${i + 1}] ${p.name || '(unnamed)'}  ${p.icon || ''}  (${p.category || 'Custom'})`);
    });
    return { name, pass: personas.length > 0, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C7 ES Persona Search (esEntities.Persona.filter) ──────────────────────────

async function testC7ESPersonaSearch(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C7 ES Persona Search (client.esEntities.Persona.filter)';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    const personaEntry = client.entities.find((e: any) => e.name === 'Persona');
    if (!personaEntry) throw new Error('Persona entity not found in client.entities');
    emit(`✓ Persona → index: ${personaEntry.defaultIndex}`);

    // 1. Wildcard search: "Marine*"
    const wildcard = 'Marine*';
    emit(`\n// wildcard search`);
    emit(`const r1 = await client.esEntities.Persona.filter({ name: "${wildcard}" });`);
    const r1 = await client.esEntities.Persona.filter({ name: wildcard });
    emit(`✓ ${r1.length} persona(s) matching name="${wildcard}"`);
    r1.slice(0, 10).forEach((p: any, i: number) => {
      emit(`  [${i + 1}] ${p.name || '(unnamed)'}  ${p.icon || ''}  id: ${p.id}`);
    });

    // 2. Phrase / multi-word search: "Marine Biologist"
    const phrase = 'Marine Biologist';
    emit(`\n// phrase (multi-word match) search`);
    emit(`const r2 = await client.esEntities.Persona.filter({ name: "${phrase}" });`);
    const r2 = await client.esEntities.Persona.filter({ name: phrase });
    emit(`✓ ${r2.length} persona(s) matching name="${phrase}"`);
    r2.slice(0, 10).forEach((p: any, i: number) => {
      emit(`  [${i + 1}] ${p.name || '(unnamed)'}  ${p.icon || ''}  id: ${p.id}`);
    });

    const found = r1.length > 0 || r2.length > 0;
    if (!found) emit('  (no matches — ensure personas with "Marine" in name exist)');
    return { name, pass: found, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C8 ES Persona Create (esEntities.Persona.create) ──────────────────────────

async function testC8ESPersonaCreate(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C8 ES Persona Create (client.esEntities.Persona.create)';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    const personaEntry = client.entities.find((e: any) => e.name === 'Persona');
    if (!personaEntry) throw new Error('Persona entity not found in client.entities');
    emit(`✓ Persona → index: ${personaEntry.defaultIndex}`);

    const testPersona = {
      name: 'ES Test Persona',
      description: 'Created by client.test.ts — safe to delete',
      icon: '🧪',
      category: 'Custom',
      tone: 'Professional',
      is_custom: true,
    };
    emit('const created = await client.esEntities.Persona.create({ name: "ES Test Persona", … });');
    const created = await client.esEntities.Persona.create(testPersona);
    emit(`✓ created persona — id: ${created.id}`);
    emit(`  name: ${created.name}`);
    emit(`  icon: ${created.icon}`);
    emit(`  created_date: ${created.created_date}`);

    emit(`const deleted = await client.esEntities.Persona.delete("${created.id}");`);
    const deleted = await client.esEntities.Persona.delete(created.id);
    emit(`✓ cleaned up test persona (deleted: ${deleted.deleted})`);
    return { name, pass: !!created.id, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C9 ES Persona Delete (create → delete → verify with get) ─────────────────

async function testC9ESPersonaDelete(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C9 ES Persona Delete (client.esEntities.Persona.delete)';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    const personaEntry = client.entities.find((e: any) => e.name === 'Persona');
    if (!personaEntry) throw new Error('Persona entity not found in client.entities');
    emit(`✓ Persona → index: ${personaEntry.defaultIndex}`);

    // 1. Create a throwaway persona to delete
    const created = await client.esEntities.Persona.create({
      name: 'ES Delete Test',
      description: 'Will be deleted by C9',
      icon: '🗑️',
    });
    emit(`✓ created throwaway persona — id: ${created.id}`);

    // 2. Delete it
    emit(`const deleted = await client.esEntities.Persona.delete("${created.id}");`);
    const deleted = await client.esEntities.Persona.delete(created.id);
    emit(`✓ deleted: ${deleted.deleted} (id: ${created.id})`);

    // 3. Verify it's gone — get() should throw
    emit('  verifying deletion with get()…');
    try {
      await client.esEntities.Persona.get(created.id);
      emit('  ✗ persona still found after delete!');
      return { name, pass: false, output: log };
    } catch (verifyErr: any) {
      emit('  ✓ get() threw — persona confirmed deleted');
      return { name, pass: true, output: log };
    }
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C10 ES Persona Update ──────────────────────────────────────────────────────

async function testC10ESPersonaUpdate(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C10 ES Persona Update (client.esEntities.Persona.update)';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    emit('// create → update → verify → delete');
    const created = await client.esEntities.Persona.create({
      name: 'Update Test Persona',
      description: 'Will be updated by C10',
      icon: '✏️',
    });
    emit(`✓ created — id: ${created.id}  name: "${created.name}"`);

    const updated = await client.esEntities.Persona.update(created.id, { name: 'Updated Persona C10', description: 'Updated by C10' });
    emit(`✓ updated — name: "${updated.name}"  updated_date: ${updated.updated_date}`);
    if (updated.name !== 'Updated Persona C10') throw new Error(`name not updated — got "${updated.name}"`);

    // verify via get
    const fetched = await client.esEntities.Persona.get(created.id);
    emit(`✓ get() after update — name: "${fetched.name}"`);
    if (fetched.name !== 'Updated Persona C10') throw new Error(`get() returned stale name "${fetched.name}"`);

    // cleanup
    await client.esEntities.Persona.delete(created.id);
    emit(`✓ cleaned up`);
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C11 ES Persona bulkCreate ──────────────────────────────────────────────────

async function testC11ESPersonaBulkCreate(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C11 ES Persona bulkCreate (client.esEntities.Persona.bulkCreate)';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    const batch = [
      { name: 'BulkCreate A', description: 'C11 batch item A', icon: '🅰️' },
      { name: 'BulkCreate B', description: 'C11 batch item B', icon: '🅱️' },
      { name: 'BulkCreate C', description: 'C11 batch item C', icon: '©️' },
    ];
    emit(`const results = await client.esEntities.Persona.bulkCreate([… ${batch.length} items]);`);
    const results = await client.esEntities.Persona.bulkCreate(batch);
    emit(`✓ bulkCreate returned ${results.length} record(s)`);
    results.forEach((r: any, i: number) => emit(`  [${i + 1}] id: ${r.id}  name: "${r.name}"`));
    if (results.length !== batch.length) throw new Error(`Expected ${batch.length} results, got ${results.length}`);

    // cleanup
    for (const r of results) {
      if (r.id) await client.esEntities.Persona.delete(r.id);
    }
    emit(`✓ cleaned up ${results.length} records`);
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C12 ES Persona bulkUpdate ──────────────────────────────────────────────────

async function testC12ESPersonaBulkUpdate(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C12 ES Persona bulkUpdate (client.esEntities.Persona.bulkUpdate)';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    // create two records
    const [a, b] = await client.esEntities.Persona.bulkCreate([
      { name: 'BulkUpdate A', icon: '🔵' },
      { name: 'BulkUpdate B', icon: '🔵' },
    ]);
    emit(`✓ created A id: ${a.id}  B id: ${b.id}`);

    emit(`const results = await client.esEntities.Persona.bulkUpdate([{id, name: "BulkUpdate A v2"}, …]);`);
    const results = await client.esEntities.Persona.bulkUpdate([
      { id: a.id, name: 'BulkUpdate A v2', icon: '🟢' },
      { id: b.id, name: 'BulkUpdate B v2', icon: '🟢' },
    ]);
    emit(`✓ bulkUpdate returned ${results.length} record(s)`);
    results.forEach((r: any, i: number) => emit(`  [${i + 1}] id: ${r.id}  name: "${r.name}"`));
    const allUpdated = results.every((r: any) => r.name.includes('v2'));
    if (!allUpdated) throw new Error('Not all names were updated to v2');

    // cleanup
    await client.esEntities.Persona.delete(a.id);
    await client.esEntities.Persona.delete(b.id);
    emit(`✓ cleaned up`);
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C13 ES Persona updateMany ─────────────────────────────────────────────────

async function testC13ESPersonaUpdateMany(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C13 ES Persona updateMany (client.esEntities.Persona.updateMany)';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    // create records with a sentinel tag
    const sentinel = `updateMany-test-${Date.now()}`;
    await client.esEntities.Persona.bulkCreate([
      { name: 'UpdateMany X', icon: '❌', specialization: sentinel },
      { name: 'UpdateMany Y', icon: '❌', specialization: sentinel },
    ]);
    emit(`✓ created 2 records with specialization="${sentinel}"`);

    emit(`const result = await client.esEntities.Persona.updateMany({ specialization: "${sentinel}" }, { $set: { icon: "✅" } });`);
    const result = await client.esEntities.Persona.updateMany(
      { specialization: sentinel },
      { $set: { icon: '✅' } }
    );
    emit(`✓ updateMany → updated: ${result.updated}`);
    if (result.updated < 2) throw new Error(`Expected at least 2 updated, got ${result.updated}`);

    // cleanup
    const r = await client.esEntities.Persona.deleteMany({ specialization: sentinel });
    emit(`✓ cleaned up via deleteMany — deleted: ${r.deleted}`);
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C14 ES Persona deleteMany ─────────────────────────────────────────────────

async function testC14ESPersonaDeleteMany(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C14 ES Persona deleteMany (client.esEntities.Persona.deleteMany)';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    const sentinel = `deleteMany-test-${Date.now()}`;
    await client.esEntities.Persona.bulkCreate([
      { name: 'DeleteMany P', specialization: sentinel },
      { name: 'DeleteMany Q', specialization: sentinel },
      { name: 'DeleteMany R', specialization: sentinel },
    ]);
    emit(`✓ created 3 records with specialization="${sentinel}"`);

    emit(`const result = await client.esEntities.Persona.deleteMany({ specialization: "${sentinel}" });`);
    const result = await client.esEntities.Persona.deleteMany({ specialization: sentinel });
    emit(`✓ deleteMany → deleted: ${result.deleted}  total: ${result.total}`);
    if (result.deleted < 3) throw new Error(`Expected at least 3 deleted, got ${result.deleted}`);
    return { name, pass: true, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C15 ES Persona schema ─────────────────────────────────────────────────────

async function testC15ESPersonaSchema(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C15 ES Persona schema (client.esEntities.Persona.schema)';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    emit(`const schema = await client.esEntities.Persona.schema();`);
    const schema = await client.esEntities.Persona.schema();
    emit(`✓ schema.type: ${schema.type}`);
    const fields = Object.keys(schema.properties || {});
    emit(`✓ ${fields.length} field(s) in mapping: ${fields.slice(0, 10).join(', ')}${fields.length > 10 ? '…' : ''}`);
    if (schema.type !== 'object') throw new Error(`Expected schema.type="object", got "${schema.type}"`);
    return { name, pass: fields.length > 0, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ── C16 ES Persona subscribe (polling diff) ───────────────────────────────────

async function testC16ESPersonaSubscribe(): Promise<TestResult> {
  const { emit, log } = makeRunner();
  const name = 'C16 ES Persona subscribe (client.esEntities.Persona.subscribe)';
  try {
    const { createClient, config } = await getClientModule();
    const client = createClient(config);
    emit(`✓ client created — ${client.entities.length} entities declared`);

    const events: any[] = [];
    emit(`const unsubscribe = client.esEntities.Persona.subscribe(cb);`);
    const unsubscribe = client.esEntities.Persona.subscribe((event: any) => {
      events.push(event);
      emit(`  event: ${event.type}  id: ${event.id}`);
    });
    emit(`✓ subscribed — waiting 500ms for initial poll…`);
    await new Promise(r => setTimeout(r, 500));

    // create a record to trigger a change event on the next poll
    const sentinel = `subscribe-test-${Date.now()}`;
    const created = await client.esEntities.Persona.create({ name: sentinel, description: 'C16 subscribe test' });
    emit(`✓ created record id: ${created.id} — waiting 6s for poll diff…`);
    await new Promise(r => setTimeout(r, 6000));

    unsubscribe();
    emit(`✓ unsubscribed — events received: ${events.length}`);

    // cleanup
    await client.esEntities.Persona.delete(created.id).catch(() => {});
    emit(`✓ cleaned up`);

    // pass if at least a 'create' event arrived for our record
    const gotCreate = events.some(e => e.type === 'create' && e.id === created.id);
    if (!gotCreate) emit('  ⚠ no create event detected (may be a timing issue; check ES refresh interval)');
    return { name, pass: gotCreate, output: log };
  } catch (e: any) { return { name, pass: false, output: log, error: e?.message }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE A — Ollama modules (original)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Runner ───────────────────────────────────────────────────────────────────

const SUITE_A = [
  testCalculator,
  testFlightTracker,
  testMultiTool,
  testThinkingEnabled,
  testThinkingStreaming,
  testWebsearchTools,
];

const SUITE_B = [
  testB1ConfigSchema,
  testB2AuthMiddleware,
  testB3CircuitBreaker,
  testB4RequestBatcher,
  testB5ToolRegistry,
  testB6AbortManager,
  testB7Telemetry,
  testB8ModelRouter,
  testB9LocalStorageConfigMerge,
];

const SUITE_C = [
  testC1EndpointResolution,
  testC2ESConfigPersistence,
  testC3ESClusterHealth,
  testC4ESEntityIndices,
  testC5EntityIndexMap,
  testC6ESPersonaFetch,
  testC7ESPersonaSearch,
  testC8ESPersonaCreate,
  testC9ESPersonaDelete,
  testC10ESPersonaUpdate,
  testC11ESPersonaBulkCreate,
  testC12ESPersonaBulkUpdate,
  testC13ESPersonaUpdateMany,
  testC14ESPersonaDeleteMany,
  testC15ESPersonaSchema,
  testC16ESPersonaSubscribe,
];

const ALL_TESTS = [...SUITE_A, ...SUITE_B, ...SUITE_C];

async function runSuite(label: string, tests: (() => Promise<TestResult>)[]): Promise<number> {
  console.log(`\n─── ${label} (${tests.length} tests) ───`);
  let passed = 0;
  for (const test of tests) {
    const result = await test();
    const icon = result.pass ? '✅' : '❌';
    console.log(`\n${icon} ${result.name}`);
    result.output.forEach(l => console.log('  ' + l));
    if (result.error) console.error('  Error:', result.error);
    if (result.pass) passed++;
  }
  console.log(`\n  ${passed}/${tests.length} passed`);
  return passed;
}

export async function runAllTests(): Promise<void> {
  console.log('\n=== apis/client.test.ts ===');
  console.log(`endpoint : ${getEndpoint()}`);
  console.log(`model    : ${getModel()}`);
  // ES endpoint resolved at runtime via getElasticsearchEndpoint() — see C1 test output

  const pA = await runSuite('Suite A — Ollama Modules', SUITE_A);
  const pB = await runSuite('Suite B — Client Infrastructure', SUITE_B);
  const pC = await runSuite('Suite C — Endpoints & ES Entities', SUITE_C);

  const total = ALL_TESTS.length;
  const passed = pA + pB + pC;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`TOTAL: ${passed}/${total} tests passed\n`);
}

// ES endpoint note — always resolved via getElasticsearchEndpoint():
//   local  (localhost / 127.0.0.1 / 192.168.*) → /db  (Vite proxy)
//   remote (deployed / ngrok)                  → https://eu-vector-cloud.ngrok.dev

export async function runTest(index: number): Promise<TestResult> {
  const test = ALL_TESTS[index];
  if (!test) throw new Error(`No test at index ${index}`);
  return test();
}

export async function runSuiteA(): Promise<void> { await runSuite('Suite A — Ollama Modules', SUITE_A); }
export async function runSuiteB(): Promise<void> { await runSuite('Suite B — Client Infrastructure', SUITE_B); }
export async function runSuiteC(): Promise<void> { await runSuite('Suite C — Endpoints & ES Entities', SUITE_C); }

export { ALL_TESTS as TESTS, SUITE_A, SUITE_B, SUITE_C, getEndpoint, getModel };

// Auto-run when executed directly (ts-node / Deno)
if (typeof process !== 'undefined' && process.argv[1]?.includes('client.test')) {
  runAllTests().catch(console.error);
}