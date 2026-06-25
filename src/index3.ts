

export const config = {
  serverUrl: 'http://localhost:5174',
  entityEndpoint: ['http://localhost:9200',"https://eu-vector-cloud.ngrok.dev"],
  headers: {
    "Content-Type": "application/json",
  },
  capabilities: {},
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "why is the sky blue" }
  ],
  ollamaEndpoints: ["/proxy","http://localhost:11434","https://christy-ramentaceous-verbatim.ngrok-free.de"],
  model: "qwen3:8b",
  query:"why is the sky blue"
};

const SUMMARIES_INDEX="knowledge*";

const INDEX_PREFIX="_all";

const esEp = 'http://localhost:9200';


class QueryProcessor {
  constructor(esEp, ollamaEndpoint, ollamaModel) {
    this.esEp = esEp;
    this.ollamaEndpoint = ollamaEndpoint;
    this.ollamaModel = ollamaModel;
    this.activeIndex = null;
    this.selectedQuery = null;
    this.queries = [];
    this.summaries = [];
    this.loadingSummaries = false;
    this.summarizing = false;
    this.log = '';
    this.error = '';
  }

  // Getters
  getEsEp() {
    return this.esEp;
  }

  getOllamaEndpoint() {
    return this.ollamaEndpoint;
  }

  getOllamaModel() {
    return this.ollamaModel;
  }

  getActiveIndex() {
    return this.activeIndex;
  }

  getSelectedQuery() {
    return this.selectedQuery;
  }

  getQueries() {
    return this.queries;
  }

  getSummaries() {
    return this.summaries;
  }

  isLoadingSummaries() {
    return this.loadingSummaries;
  }

  isSummarizing() {
    return this.summarizing;
  }

  getLog() {
    return this.log;
  }

  getError() {
    return this.error;
  }

  // Setters
  setEsEp(esEp) {
    this.esEp = esEp;
  }

  setOllamaEndpoint(ollamaEndpoint) {
    this.ollamaEndpoint = ollamaEndpoint;
  }

  setOllamaModel(ollamaModel) {
    this.ollamaModel = ollamaModel;
  }

  setActiveIndex(activeIndex) {
    this.activeIndex = activeIndex;
  }

  setSelectedQuery(selectedQuery) {
    this.selectedQuery = selectedQuery;
  }

  setQueries(queries) {
    this.queries = queries;
  }

  setSummaries(summaries) {
    this.summaries = summaries;
  }

  setLoadingSummaries(loadingSummaries) {
    this.loadingSummaries = loadingSummaries;
  }

  setSummarizing(summarizing) {
    this.summarizing = summarizing;
  }

  setLog(log) {
    this.log = log;
  }

  setError(error) {
    this.error = error;
  }

  // Methods
  async loadIndices() {
    // Implement the logic to load indices here
    console.log('Loading indices...');
  }

  async loadQueries() {
    if (!this.esEp || !this.activeIndex) return;
    const res = await fetch(`${this.esEp}/${this.activeIndex}/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        size: 0,
        aggs: { unique_queries: { terms: { field: 'query', size: 50 } } }
      }),
    });
    if (!res.ok) return;
    const json = await res.json();
    const qs = (json.aggregations?.unique_queries?.buckets || []).map(b => b.key);
    this.setQueries(qs);
    if (qs.length > 0 && !this.selectedQuery) this.setSelectedQuery(qs[0]);
    return qs;
  }

  async loadSummaries() {
    if (!this.esEp) return;
    this.setLoadingSummaries(true);
    const res = await fetch(`${this.esEp.url}/${SUMMARIES_INDEX}/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 50, sort: [{ created_at: { order: 'desc' } }] }),
    });
    if (res.ok) {
      const json = await res.json();
      this.setSummaries((json.hits?.hits || []).map(h => h._source));
    }
    this.setLoadingSummaries(false);
  }

  async ensureSummariesIndex() {
    const res = await fetch(`${this.esEp.url}/${SUMMARIES_INDEX}`);
    if (res.status === 200) return true;
    const createRes = await fetch(`${this.esEp.url}/${SUMMARIES_INDEX}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mappings: {
          properties: {
            source_index: { type: 'keyword' },
            query: { type: 'keyword' },
            summary: { type: 'text' },
            doc_count: { type: 'integer' },
            created_at: { type: 'date' },
          }
        }
      }),
    });
    return createRes.ok;
  }

  async runSummarize() {
    if (!this.selectedQuery || !this.esEp || !this.activeIndex) return;
    this.setSummarizing(true);
    this.setLog('');
    this.setError('');

    const appendLog = (msg) => this.setLog(prev => prev + msg + '\n');

    try {
      appendLog(`► Fetching docs for query: "${this.selectedQuery}"...`);
      const res = await fetch(`${this.esEp.url}/${this.activeIndex}/_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size: 50,
          _source: ['title', 'snippet', 'url'],
          query: { term: { query: this.selectedQuery } },
        }),
      });
      if (!res.ok) throw new Error(`ES HTTP ${res.status}`);
      const json = await res.json();
      const docs = (json.hits?.hits || []).map(h => h._source);
      appendLog(`  → ${docs.length} documents retrieved`);
      if (docs.length === 0) throw new Error('No documents found for this query');

      const context = docs.map((d, i) => `[${i + 1}] ${d.title}\n${d.snippet || ''}`).join('\n\n');
      const promptText = `You are an intelligence analyst. Below are web search results for the query: "${this.selectedQuery}"\n\nAnalyze these results and produce a concise 3-5 sentence summary of the key findings, themes, and insights.\n\nRESULTS:\n${context}\n\nSUMMARY:`;

      appendLog(`► Calling LLM (${this.ollamaModel})...`);
      const llmRes = await fetch(`${this.ollamaEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          messages: [{ role: 'user', content: promptText }],
          stream: false,
        }),
      });
      if (!llmRes.ok) throw new Error(`LLM HTTP ${llmRes.status}`);
      const llmJson = await llmRes.json();
      const summary = llmJson.choices?.[0]?.message?.content?.trim() || '';
      if (!summary) throw new Error('LLM returned empty response');
      appendLog(`  → Summary generated (${summary.length} chars)`);

      appendLog(`► Storing in ${SUMMARIES_INDEX}...`);
      const ok = await this.ensureSummariesIndex();
      if (!ok) throw new Error(`Failed to create/access ${SUMMARIES_INDEX}`);

      const storeRes = await fetch(`${this.esEp.url}/${SUMMARIES_INDEX}/_doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_index: this.activeIndex,
          query: this.selectedQuery,
          summary,
          doc_count: docs.length,
          created_at: new Date().toISOString(),
        }),
      });
      if (!storeRes.ok) throw new Error(`Store HTTP ${storeRes.status}`);
      appendLog(`  ✓ Summary stored successfully`);
      appendLog(`\nDONE`);
      this.loadSummaries();
    } catch (e) {
      this.setError(e.message);
      appendLog(`  ✗ Error: ${e.message}`);
    } finally {
      this.setSummarizing(false);
    }
  }

  // Method to return JSON representation of the object
  toJSON() {
    return {
      esEp: this.esEp,
      ollamaEndpoint: this.ollamaEndpoint,
      ollamaModel: this.ollamaModel,
      activeIndex: this.activeIndex,
      selectedQuery: this.selectedQuery,
      queries: this.queries,
      summaries: this.summaries,
      loadingSummaries: this.loadingSummaries,
      summarizing: this.summarizing,
      log: this.log,
      error: this.error
    };
  }
}

// Example usage:
const processor = new QueryProcessor(config.entityEndpoint[0], config.ollamaEndpoints[1], config.model);
processor.setActiveIndex('_all');
processor.setSelectedQuery('in my bed room');


// Usage example
(async () => {
processor.loadQueries().then(() => {
    
console.log(processor.runSummarize());
console.log(processor.loadSummaries());
});
});
