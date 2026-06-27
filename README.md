## ollama on the host machine
```
curl -fsSL https://ollama.com/install.sh | sh;

ollama pull qwen3:0.6b;
ollama pull llava:7b;
ollama pull qwen3:8b;
ollama pull nomic-embed-text:latest;
ollama serve;
```

## ollama via docker appears slower maybe badly configured
```
docker run \
  --name ollama \
  -d \
  --restart unless-stopped \
  -p 11434:11434 \
  -v ./ollama/ollama:/root/.ollama \
  --interactive \
  --tty \
  -e OLLAMA_KEEP_ALIVE=24h \
  -e OLLAMA_HOST=0.0.0.0 \
  ollama/ollama;
```

### pull

```
docker exec -it ollama ollama pull qwen3:0.6b;
docker exec -it ollama ollama pull llava:7b;
docker exec -it ollama ollama pull qwen3:8b;
docker exec -it ollama ollama pull nomic-embed-text:latest;
ollama list


NAME                       ID              SIZE      MODIFIED       
nomic-embed-text:latest    0a109f422b47    274 MB    3 seconds ago     
qwen3:8b                   500a1f067a9f    5.2 GB    20 seconds ago    
llava:7b                   8dd30f6b0cb1    4.7 GB    3 minutes ago     
qwen3:0.6b                 7df6b6e09427    522 MB    5 minutes ago     
```
## Elasticsearch
```
docker run \
       -p 9200:9200 \
       -p 9300:9300 \
       -e "discovery.type=single-node" \
       -e "xpack.security.enabled=false" \
       -m 6GB docker.elastic.co/elasticsearch/elasticsearch:8.4.2;
```
## install
```
git clone git@github.com:santenova/ollama-browser-tools.git;
cd ollama-browser-tools;
npm install;
npm run postinstall;
npm  run ingest;
npm run start;
```

 
## how it should look
```

=== apis/client.test.ts ===
endpoint : http://127.0.0.1:11434
model    : qwen3:0.6b

─── Suite A — Ollama Modules (6 tests) ───
[2026-06-27T18:36:57.204Z] [INFO] InvokeLLM start | {"key":"test-invoke-1","hasTools":true,"think":true,"returnRaw":true}
[2026-06-27T18:36:59.274Z] [INFO] InvokeLLM (2069ms)
[2026-06-27T18:36:59.274Z] [INFO] InvokeLLM (2069ms) | {"key":"test-invoke-1","hasTools":true}
[2026-06-27T18:36:59.274Z] [INFO] InvokeLLM start | {"key":"test-invoke-2","hasTools":false,"think":true,"returnRaw":true}
[2026-06-27T18:37:00.546Z] [INFO] InvokeLLM (1271ms)
[2026-06-27T18:37:00.546Z] [INFO] InvokeLLM (1272ms) | {"key":"test-invoke-2","hasTools":false}

✅ #1 Calculator (tools: addTwoNumbers / subtractTwoNumbers)
[2026-06-27T18:37:00.546Z] [INFO] InvokeLLM start | {"key":"test-invoke-3","hasTools":true,"think":true,"returnRaw":true}
[2026-06-27T18:37:00.747Z] [INFO] InvokeLLM (201ms)
[2026-06-27T18:37:00.748Z] [INFO] InvokeLLM (202ms) | {"key":"test-invoke-3","hasTools":true}

✅ #2 Flight Tracker (tool call loop)
[2026-06-27T18:37:00.748Z] [INFO] InvokeLLM start | {"key":"test-invoke-4","hasTools":true,"think":true,"returnRaw":true}
[2026-06-27T18:37:00.909Z] [INFO] InvokeLLM (161ms)
[2026-06-27T18:37:00.909Z] [INFO] InvokeLLM (161ms) | {"key":"test-invoke-4","hasTools":true}

✅ #3 Multi-Tool (getTemperature + getConditions — mirrors multi-tool.ts)
[2026-06-27T18:37:00.909Z] [INFO] InvokeLLM start | {"key":"test-invoke-5","hasTools":false,"think":true,"returnRaw":true}
[2026-06-27T18:37:01.274Z] [INFO] InvokeLLM (364ms)
[2026-06-27T18:37:01.274Z] [INFO] InvokeLLM (364ms) | {"key":"test-invoke-5","hasTools":false}

✅ #4 Thinking Enabled

✅ #5 Thinking Streaming
[2026-06-27T18:37:03.152Z] [INFO] InvokeLLM start | {"key":"test-invoke-6","hasTools":true,"think":true,"returnRaw":true}
[2026-06-27T18:37:04.456Z] [INFO] InvokeLLM (1304ms)
[2026-06-27T18:37:04.456Z] [INFO] InvokeLLM (1304ms) | {"key":"test-invoke-6","hasTools":true}

✅ #6 Websearch Tools (webSearch + webFetch loop — mirrors websearch-tools.ts)

  6/6 passed

─── Suite B — Client Infrastructure (9 tests) ───

✅ B1 Config Schema Validation

✅ B2 Auth Middleware — Token Injection

✅ B3 Circuit Breaker

✅ B4 Request Batcher

✅ B5 Tool Registry

✅ B6 Abort Manager

✅ B7 Telemetry Event Bus

✅ B8 Model Router — Static Resolve

✅ B9 Config Merge — localStorage Fallback

  9/9 passed

─── Suite C — Endpoints & ES Entities (22 tests) ───

✅ C1 Endpoint Resolution

✅ C2 ES Config Persistence (getEsConfig / saveEsConfig)

✅ C3 Elasticsearch Cluster Health

✅ C4 ES Entity Index Presence
Persona                        → sample-prompt-persona
Template                       → sample-prompt-template
ChatSession                    → sample-prompt-session
Scenario                       → sample-prompt-scenario
DevilsAdvocateResult           → sample-prompt-devils
AnalogyBuilderResult           → sample-prompt-analogy
PersonaDebateResult            → sample-prompt-debate
ContentRepurposerResult        → sample-prompt-repurpose
StructureArchitectResult       → sample-prompt-outline
GeneratorList                  → sample-prompt-generator-list

✅ C5 Entity Index Map Integrity
  Persona                        → sample-prompt-persona
  Template                       → sample-prompt-template
  ChatSession                    → sample-prompt-session
  Scenario                       → sample-prompt-scenario
  DevilsAdvocateResult           → sample-prompt-devils
  AnalogyBuilderResult           → sample-prompt-analogy
  PersonaDebateResult            → sample-prompt-debate
  ContentRepurposerResult        → sample-prompt-repurpose
  StructureArchitectResult       → sample-prompt-outline
  GeneratorList                  → sample-prompt-generator-list

✅ C6 ES Persona Fetch (createClient + client.esEntities.Persona.list)
  ES Persona wildcard search "Marine*" → 1 results
  ES Persona phrase search "Marine Biologist" → 1 results

✅ C7 ES Persona Search (client.esEntities.Persona.filter)
    ES Persona wildcard search "Marine*" → 1 results
    ES Persona phrase search "Marine Biologist" → 1 results

✅ C8 ES Persona Create (client.esEntities.Persona.create)

✅ C9 ES Persona Delete (client.esEntities.Persona.delete)

✅ C10 ES Persona Update (client.esEntities.Persona.update)
  [1] id: B5FeCp8BtIs6sWm7_L30  name: "BulkCreate A"
  [2] id: CJFeCp8BtIs6sWm7_L30  name: "BulkCreate B"
  [3] id: CZFeCp8BtIs6sWm7_L30  name: "BulkCreate C"

✅ C11 ES Persona bulkCreate (client.esEntities.Persona.bulkCreate)
    [1] id: B5FeCp8BtIs6sWm7_L30  name: "BulkCreate A"
    [2] id: CJFeCp8BtIs6sWm7_L30  name: "BulkCreate B"
    [3] id: CZFeCp8BtIs6sWm7_L30  name: "BulkCreate C"
  [1] id: CpFeCp8BtIs6sWm7_b0r  name: "BulkUpdate A v2"
  [2] id: C5FeCp8BtIs6sWm7_b0r  name: "BulkUpdate B v2"

✅ C12 ES Persona bulkUpdate (client.esEntities.Persona.bulkUpdate)
    [1] id: CpFeCp8BtIs6sWm7_b0r  name: "BulkUpdate A v2"
    [2] id: C5FeCp8BtIs6sWm7_b0r  name: "BulkUpdate B v2"

✅ C13 ES Persona updateMany (client.esEntities.Persona.updateMany)

✅ C14 ES Persona deleteMany (client.esEntities.Persona.deleteMany)

✅ C15 ES Persona schema (client.esEntities.Persona.schema)

✅ C16 ES Persona subscribe (client.esEntities.Persona.subscribe)
  model routing (Speed=100):
    chat       → "qwen2.5-coder:0.5b"
    thinking   → "qwen3:0.6b"
    json       → "qwen2.5-coder:0.5b"
    vision     → "moondream:latest"
  fastest chat model:     "qwen2.5-coder:0.5b"
  fastest thinking model: "qwen3:0.6b"
[2026-06-27T18:37:11.964Z] [INFO] InvokeLLM start | {"key":"test-invoke-7","hasTools":false,"think":false,"returnRaw":false}
[2026-06-27T18:37:12.286Z] [INFO] InvokeLLM (322ms)
[2026-06-27T18:37:12.286Z] [INFO] InvokeLLM (322ms) | {"key":"test-invoke-7","hasTools":false}
[2026-06-27T18:37:12.286Z] [INFO] InvokeLLM start | {"key":"test-invoke-8","hasTools":false,"think":false,"returnRaw":false}
[2026-06-27T18:37:12.524Z] [INFO] InvokeLLM (238ms)
[2026-06-27T18:37:12.524Z] [INFO] InvokeLLM (238ms) | {"key":"test-invoke-8","hasTools":false}
[2026-06-27T18:37:12.524Z] [INFO] InvokeLLM start | {"key":"test-invoke-9","hasTools":false,"think":false,"returnRaw":false}
[2026-06-27T18:37:12.781Z] [INFO] InvokeLLM (257ms)
[2026-06-27T18:37:12.781Z] [INFO] InvokeLLM (257ms) | {"key":"test-invoke-9","hasTools":false}
[2026-06-27T18:37:12.781Z] [INFO] InvokeLLM start | {"key":"test-invoke-10","hasTools":false,"think":true,"returnRaw":false}
[2026-06-27T18:37:16.653Z] [INFO] InvokeLLM (3872ms)
[2026-06-27T18:37:16.653Z] [INFO] InvokeLLM (3872ms) | {"key":"test-invoke-10","hasTools":false}
[2026-06-27T18:37:17.928Z] [INFO] InvokeLLM (1275ms)
[2026-06-27T18:37:19.151Z] [INFO] InvokeLLM (1223ms)
  batch[0] (model: "qwen2.5-coder:0.5b") → Octopus. 

Octopus live in the deep blue sea, consuming seag...
  batch[1] (model: "qwen2.5-coder:0.5b") → Mark the start of the JSON response

```
{
  "reef": "Bass R...
  batch[2] (model: "qwen3:0.6b") → The ocean is predominantly salty, consisting of approximatel...

✅ C17 Persona Search → InvokeLLM Chat (end-to-end client flow)
    model routing (Speed=100):
      chat       → "qwen2.5-coder:0.5b"
      thinking   → "qwen3:0.6b"
      json       → "qwen2.5-coder:0.5b"
      vision     → "moondream:latest"
    fastest chat model:     "qwen2.5-coder:0.5b"
    fastest thinking model: "qwen3:0.6b"
    batch[0] (model: "qwen2.5-coder:0.5b") → Octopus. 

Octopus live in the deep blue sea, consuming seag...
    batch[1] (model: "qwen2.5-coder:0.5b") → Mark the start of the JSON response

```
{
  "reef": "Bass R...
    batch[2] (model: "qwen3:0.6b") → The ocean is predominantly salty, consisting of approximatel...
  modelRouter(thinking, 60) → "qwen3:latest"
[2026-06-27T18:37:21.111Z] [INFO] promptRouter.enhance start | {"key":"test-promptRouter.enhance-1"}
[2026-06-27T18:37:22.872Z] [INFO] promptRouter.enhance (1761ms) | {"key":"test-promptRouter.enhance-1"}
  ── Real prompt-router call (thinking task) ──
  Model (expected): "qwen3:latest"
  ── Response ──
  Result: "**Enhanced Prompt for Marine Biology Report:**  

**Introduction**  
This report aims to provide a c..."
  ✅ enhance sent a real prompt and got a real enhanced response
  modelRouter('chat', 100) → "qwen2.5-coder:0.5b"
  modelRouter('thinking', 100) → "qwen3:0.6b"
  modelRouter('json', 100) → "qwen2.5-coder:0.5b"
  ✅ fastest chat model with tools+thinking: "qwen3:0.6b"
  modelRouter(chat, Speed=90, requiredCaps=['tools','thinking']) → "qwen3:1.7b" (most capable)

✅ C18 Prompt Router (openai-style enhancement of routed prompt)
    modelRouter(thinking, 60) → "qwen3:latest"
    ── Real prompt-router call (thinking task) ──
    Model (expected): "qwen3:latest"
    ── Response ──
    Result: "**Enhanced Prompt for Marine Biology Report:**  

**Introduction**  
This report aims to provide a c..."
    ✅ enhance sent a real prompt and got a real enhanced response
    modelRouter('chat', 100) → "qwen2.5-coder:0.5b"
    modelRouter('thinking', 100) → "qwen3:0.6b"
    modelRouter('json', 100) → "qwen2.5-coder:0.5b"
    ✅ fastest chat model with tools+thinking: "qwen3:0.6b"
    modelRouter(chat, Speed=90, requiredCaps=['tools','thinking']) → "qwen3:1.7b" (most capable)
  Core.vision: encode() + send() available
  Ollama endpoint: http://127.0.0.1:11434
  Endpoint reachable

  ── Stage 1: vision.encode + vision.send(schema) ──
  encode() → "data:image/png;base64,iVBORw0KGgoAAAANSU..."
  Resolved vision model: "moondream:latest"
[2026-06-27T18:37:23.304Z] [INFO] vision.send start | {"key":"test-vision.send-2"}
[2026-06-27T18:37:23.696Z] [INFO] vision.send (392ms) | {"key":"test-vision.send-2"}
  Vision analysis keys: description, dominant_color
  description: "A yellow smiley face with a black eye"
  dominant_color: "#FF5733"

  ── Stage 2: Core.expandQuery (from vision description) ──
[2026-06-27T18:37:23.696Z] [INFO] expandQuery start | {"key":"test-expandQuery-3"}
[
  'A yellow smiley face with a black eye',
  'yellow smiley face',
  'beautiful smile',
  'eyes in a yellow',
  'expression',
  "nature's eyes"
]
[2026-06-27T18:37:23.865Z] [INFO] expandQuery (169ms) | {"key":"test-expandQuery-3"}
  Expanded 6 terms: A yellow smiley face with a black eye, yellow smiley face, beautiful smile, eyes in a yellow, expression...

  ── Stage 3: modelRouter.resolve (chat / thinking / json) ──
  chat → "orca-mini:latest"  |  thinking → "qwen3:latest"  |  json → "llama3.2:latest"

  ── Stage 4: promptRouter.enhance (from vision description) ──
[2026-06-27T18:37:23.865Z] [INFO] promptRouter.enhance start | {"key":"test-promptRouter.enhance-4"}
[2026-06-27T18:37:28.040Z] [INFO] promptRouter.enhance (4175ms) | {"key":"test-promptRouter.enhance-4"}
  Enhanced: "As you stand in the middle of the city, surrounded by tall buildings and bustlin..."

  ── Stage 5: InvokeLLM (thinking, model: "qwen3:latest") ──
[2026-06-27T18:37:28.040Z] [INFO] InvokeLLM start | {"key":"test-invoke-11","hasTools":false,"think":true,"returnRaw":true}
[2026-06-27T18:38:06.098Z] [INFO] InvokeLLM (38058ms)
[2026-06-27T18:38:06.100Z] [INFO] InvokeLLM (38060ms) | {"key":"test-invoke-11","hasTools":false}
  Thinking trace: (none — model may not support CoT)
  Think result: "The narrative you've described is rich with visual symbolism and metaphor, and a..."

  ── Stage 6: InvokeLLMBatched (3 parallel: caption / haiku / tags) ──
[2026-06-27T18:38:06.100Z] [INFO] InvokeLLMBatched start | {"key":"test-InvokeLLMBatched-5"}
[2026-06-27T18:38:06.101Z] [INFO] InvokeLLMBatched start | {"key":"test-InvokeLLMBatched-6"}
[2026-06-27T18:38:06.101Z] [INFO] InvokeLLMBatched start | {"key":"test-InvokeLLMBatched-7"}
[2026-06-27T18:38:09.343Z] [INFO] InvokeLLMBatched (3243ms) | {"key":"test-InvokeLLMBatched-5"}
[2026-06-27T18:38:09.343Z] [INFO] InvokeLLMBatched (3242ms) | {"key":"test-InvokeLLMBatched-6"}
[2026-06-27T18:38:09.343Z] [INFO] InvokeLLMBatched (3242ms) | {"key":"test-InvokeLLMBatched-7"}
  batch[0] (model: "orca-mini:latest") →  "The irony of the black eyeball is not lost on me."
  batch[1] (model: "orca-mini:latest") →  Two dots on high,
A smile with a slant,
Yellow and black ey...
  batch[2] (model: "llama3.2:latest") → Based on the image you described, I would create a JSON obje...

  ── Stage 7: InvokeLLM (streaming final summary) ──
[2026-06-27T18:38:09.343Z] [INFO] InvokeLLM start | {"key":"test-invoke-12","hasTools":false,"think":false,"returnRaw":false}
[2026-06-27T18:38:09.673Z] [INFO] InvokeLLM (330ms)
[2026-06-27T18:38:09.674Z] [INFO] InvokeLLM (331ms) | {"key":"test-invoke-12","hasTools":false}
  Streamed 30 tokens → " The yellow smiley face with a black eye conveys a sense of confusion or discomf..."

  ✅ C19 pipeline complete — 7 stages chained: vision.encode → vision.send(schema) → expandQuery → modelRouter → promptRouter → InvokeLLM(thinking) → InvokeLLMBatched → InvokeLLM(stream)

✅ C19 Core.vision (complex pipeline: vision → expand → enhance → think → batch → stream)
    Core.vision: encode() + send() available
    Ollama endpoint: http://127.0.0.1:11434
    Endpoint reachable
  
  ── Stage 1: vision.encode + vision.send(schema) ──
    encode() → "data:image/png;base64,iVBORw0KGgoAAAANSU..."
    Resolved vision model: "moondream:latest"
    Vision analysis keys: description, dominant_color
    description: "A yellow smiley face with a black eye"
    dominant_color: "#FF5733"
  
  ── Stage 2: Core.expandQuery (from vision description) ──
    Expanded 6 terms: A yellow smiley face with a black eye, yellow smiley face, beautiful smile, eyes in a yellow, expression...
  
  ── Stage 3: modelRouter.resolve (chat / thinking / json) ──
    chat → "orca-mini:latest"  |  thinking → "qwen3:latest"  |  json → "llama3.2:latest"
  
  ── Stage 4: promptRouter.enhance (from vision description) ──
    Enhanced: "As you stand in the middle of the city, surrounded by tall buildings and bustlin..."
  
  ── Stage 5: InvokeLLM (thinking, model: "qwen3:latest") ──
    Thinking trace: (none — model may not support CoT)
    Think result: "The narrative you've described is rich with visual symbolism and metaphor, and a..."
  
  ── Stage 6: InvokeLLMBatched (3 parallel: caption / haiku / tags) ──
    batch[0] (model: "orca-mini:latest") →  "The irony of the black eyeball is not lost on me."
    batch[1] (model: "orca-mini:latest") →  Two dots on high,
A smile with a slant,
Yellow and black ey...
    batch[2] (model: "llama3.2:latest") → Based on the image you described, I would create a JSON obje...
  
  ── Stage 7: InvokeLLM (streaming final summary) ──
    Streamed 30 tokens → " The yellow smiley face with a black eye conveys a sense of confusion or discomf..."
  
  ✅ C19 pipeline complete — 7 stages chained: vision.encode → vision.send(schema) → expandQuery → modelRouter → promptRouter → InvokeLLM(thinking) → InvokeLLMBatched → InvokeLLM(stream)
  Ollama endpoint: http://127.0.0.1:11434
  Endpoint reachable
[2026-06-27T18:38:09.681Z] [INFO] promptRouter.enhance start | {"key":"test-promptRouter.enhance-8"}
[2026-06-27T18:38:11.412Z] [INFO] promptRouter.enhance (1731ms) | {"key":"test-promptRouter.enhance-8"}
[2026-06-27T18:38:11.412Z] [INFO] Core.solution start | {"key":"test-Core.solution-9"}
[
  'How can we reduce plastic waste in the ocean, such as through recycling programs, pollution control strategies, and individual actions like reducing single-use plastics and promoting sustainable practices? Additionally, how can we address the broader environmental impact of plastic pollution, considering the vast scale of the ocean and the need for international cooperation and policy interventions to mitigate this crisis?',
  'recycling',
  'pollution control strategies',
  'sustainable practices',
  'global climate impact',
  'sustainable seafood production',
  'climate change adaptation'
]
[2026-06-27T18:38:17.402Z] [INFO] Core.solution (5990ms) | {"key":"test-Core.solution-9"}
  Result structure: manifest=true | personas=2 | debate=3
  Selected personas:
    [1] Waste Management Academic (Environmental scholar specializing in waste management syste)
    [2] Climate Scientist (Environmental researcher studying climate systems, global wa)
  Solutions manifest preview: "To refine the Waste Management Academic's argument, we can propose a comprehensive approach that integrates recycling with broader pollution systems a..."
  ✅ Core.solution() produced a solutions manifest using persona-matched debate

✅ C20 Core.solution (prompt → keywords → 2 personas → LLM debate → solutions manifest)
    Ollama endpoint: http://127.0.0.1:11434
    Endpoint reachable
    Result structure: manifest=true | personas=2 | debate=3
    Selected personas:
      [1] Waste Management Academic (Environmental scholar specializing in waste management syste)
      [2] Climate Scientist (Environmental researcher studying climate systems, global wa)
    Solutions manifest preview: "To refine the Waste Management Academic's argument, we can propose a comprehensive approach that integrates recycling with broader pollution systems a..."
    ✅ Core.solution() produced a solutions manifest using persona-matched debate
  Core.vision: send() with json_schema
  Ollama endpoint: http://127.0.0.1:11434
  Endpoint reachable
  Resolved vision model: "moondream:latest"
[2026-06-27T18:38:17.790Z] [INFO] vision.send start | {"key":"test-vision.send-10"}
[2026-06-27T18:38:21.079Z] [INFO] vision.send (3289ms) | {"key":"test-vision.send-10"}
  ── Vision send(schema) — parsed object returned ──
  Keys: description, dominant_color
  description: "A yellow smiley face with a black eye"
  dominant_color: "#FF5733"
  ✅ vision send(schema) returned structured JSON matching the schema

✅ C21 Core.vision (send with json_schema — structured image analysis)
    Core.vision: send() with json_schema
    Ollama endpoint: http://127.0.0.1:11434
    Endpoint reachable
    Resolved vision model: "moondream:latest"
    ── Vision send(schema) — parsed object returned ──
    Keys: description, dominant_color
    description: "A yellow smiley face with a black eye"
    dominant_color: "#FF5733"
    ✅ vision send(schema) returned structured JSON matching the schema
  ✅ abortManager: create → cancel → signal.aborted === true
  modelRouter(chat, speed=80)  → "orca-mini:latest"
  modelRouter(json,  speed=50)  → "llama3.1:latest"
  ✅ modelRouter: resolve returns non-empty model strings for chat + json
  promptRouter.enhance is a function — invoking (network call)
  promptRouter.enhance: "write about coral reefs" → "**Enhanced Prompt:**  
"Write a detailed, structured overview of coral reefs, co…"
  ✅ promptRouter: enhanced text differs from raw input
  ✅ C22 passed — client object exposes working abortManager, modelRouter, promptRouter

✅ C22 Client object — abortManager, modelRouter, promptRouter wiring
    ✅ abortManager: create → cancel → signal.aborted === true
    modelRouter(chat, speed=80)  → "orca-mini:latest"
    modelRouter(json,  speed=50)  → "llama3.1:latest"
    ✅ modelRouter: resolve returns non-empty model strings for chat + json
    promptRouter.enhance is a function — invoking (network call)
    promptRouter.enhance: "write about coral reefs" → "**Enhanced Prompt:**  
"Write a detailed, structured overview of coral reefs, co…"
    ✅ promptRouter: enhanced text differs from raw input
    ✅ C22 passed — client object exposes working abortManager, modelRouter, promptRouter

  22/22 passed

══════════════════════════════════════════════════
TOTAL: 37/37 tests passed

```
