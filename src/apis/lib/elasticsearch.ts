
var data = {};
const localStorage = {
  setItem: function(key, value) {
    data[key] = value;
    return data[key];
  },
  getItem: function(key) {
    return (key in data) ? data[key] : undefined;
  },
  removeItem: function(key) {
    delete data[key];
    return undefined;
  },
  clear: function() {
    data = {};
    return data;
  }
};




const ES_CONFIG_KEY = 'elasticsearch_config';
const ES_CONFIG_VERSION = 8; // bump to force-reset stored config and pick up new auto-detected entities

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


// All available entities in the app (base set — new ones are auto-detected at runtime)
const BASE_ENTITIES = [
  { name: 'Persona', defaultIndex: 'prompt-hub-persona'},
  { name: 'Template', defaultIndex: 'prompt-hub-template'},
  { name: 'ChatSession', defaultIndex: 'prompt-hub-session'},
  { name: 'Scenario', defaultIndex: 'prompt-hub-scenario'},
  { name: 'DevilsAdvocateResult', defaultIndex: 'prompt-hub-devils'},
  { name: 'AnalogyBuilderResult', defaultIndex: 'prompt-hub-analogy'},
  { name: 'PersonaDebateResult', defaultIndex: 'prompt-hub-debate'},
  { name: 'ContentRepurposerResult', defaultIndex: 'prompt-hub-repurpose'},
  { name: 'StructureArchitectResult', defaultIndex: 'prompt-hub-outline'},
  { name: 'GeneratorList', defaultIndex: 'prompt-hub-generator-list'},
];

const BASE_ENTITY_NAMES = new Set(BASE_ENTITIES.map(e => e.name));

// Detect all entities registered in client SDK and merge with base set
const detectAllEntities = () => {
  const detected = [];
  try {
    const sdkEntityNames = Object.keys(client.entities || {});
    for (const name of sdkEntityNames) {
      if (!BASE_ENTITY_NAMES.has(name)) {
        detected.push({
          name,
          defaultIndex: `prompt-hub-${name.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`,
          icon: Database,
          autoDetected: true,
        });
      }
    }
  } catch {}
  return detected;
};

const ALL_ENTITIES = [...BASE_ENTITIES, ...detectAllEntities()];

const getDefaultIndices = () => {
  const indices = {};
  ALL_ENTITIES.forEach(entity => {
    indices[entity.name] = entity.defaultIndex;
  });
  return indices;
};

export const getElasticsearchConfig = () => {
  const allEntityNames = ALL_ENTITIES.map(e => e.name);
  const fresh = {
    endpoint: 'http://localhost:5174/db',
    enabled: true,
    indices: getDefaultIndices(),
    enabledEntities: allEntityNames,
    _v: ES_CONFIG_VERSION
  };
  try {
    const stored = localStorage.getItem(ES_CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Version mismatch → wipe stale config and use fresh defaults
      if (parsed._v !== ES_CONFIG_VERSION) {
        localStorage.setItem(ES_CONFIG_KEY, JSON.stringify(fresh));
        return fresh;
      }
      return {
        ...fresh,
        endpoint: parsed.endpoint || fresh.endpoint,
        indices: { ...fresh.indices, ...parsed.indices },
        // Always all entities enabled — never trust stored list
        enabledEntities: allEntityNames,
        enabled: true
      };
    }
  } catch (error) {
    console.error('Error reading ES config:', error);
  }
  localStorage.setItem(ES_CONFIG_KEY, JSON.stringify(fresh));
  return fresh;
};

const saveElasticsearchConfig = (config) => {
  try {
    localStorage.setItem(ES_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving ES config:', error);
  }
};

export const useElasticsearchDataSource = () => {
  const [config, setConfig] = useState(getElasticsearchConfig);

  const isEnabled = () => config.endpoint; // config.enabled && 

  const isEntityEnabled = (entityName) => {
    return isEnabled() && config.enabledEntities?.includes(entityName);
  };

  const ensureIndexExists = async (endpoint, index) => {
    try {
      const check = await fetch(`${endpoint}/${index}`, { method: 'HEAD' });
      if (check.status === 404) {
        await fetch(`${endpoint}/${index}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
      }
    } catch {}
  };

  const fetchFromElasticsearch = async (entityName) => {
    if (!isEntityEnabled(entityName)) return null;
    
    const index = config.indices?.[entityName];
    if (!index) return null;

    await ensureIndexExists(config.endpoint, index);

    try {
      const response = await fetch(`${config.endpoint}/${index}/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: { match_all: {} },
          size: 5000
        })
      });

      if (!response.ok) {
        throw new Error(`ES error: ${response.status}`);
      }

      const data = await response.json();
      return data.hits?.hits?.map(hit => ({
        id: hit._id,
        ...hit._source
      })) || [];
    } catch (error) {
      console.error(`Error fetching from ES index ${index}:`, error);
      return null;
    }
  };

  const createInElasticsearch = async (entityName, data) => {
    if (!isEntityEnabled(entityName)) return null;
    
    const index = config.indices?.[entityName];
    if (!index) return null;

    try {
      const response = await fetch(`${config.endpoint}/${index}/_doc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`ES create error: ${response.status}`);
      }

      const result = await response.json();
      return {
        id: result._id,
        ...data
      };
    } catch (error) {
      console.error(`Error creating in ES index ${index}:`, error);
      return null;
    }
  };

  const updateInElasticsearch = async (entityName, id, data) => {
    if (!isEntityEnabled(entityName)) return null;
    
    const index = config.indices?.[entityName];
    if (!index) return null;

    try {
      const response = await fetch(`${config.endpoint}/${index}/_update/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doc: data,
          doc_as_upsert: true
        })
      });

      if (!response.ok) {
        throw new Error(`ES update error: ${response.status}`);
      }

      const result = await response.json();
      return {
        id: result._id,
        ...data
      };
    } catch (error) {
      console.error(`Error updating in ES index ${index}:`, error);
      return null;
    }
  };

  const searchInElasticsearch = async (entityName, searchQuery, options = {}) => {
    if (!isEntityEnabled(entityName)) return null;
    
    const index = config.indices?.[entityName];
    if (!index) return null;

    const {
      filters = {},
      sort = '_score',
      sortOrder = 'desc',
      size = 100,
      from = 0
    } = options;

    try {
      // Build query
      const must = [];
      const filter = [];

      // Full-text search
      if (searchQuery && searchQuery.trim()) {
        must.push({
          multi_match: {
            query: searchQuery,
            fields: ['*'],
            type: 'best_fields',
            fuzziness: 'AUTO'
          }
        });
      }

      // Apply filters
      Object.entries(filters).forEach(([field, value]) => {
        if (Array.isArray(value) && value.length > 0) {
          filter.push({ terms: { [field]: value } });
        } else if (value !== null && value !== undefined && value !== '') {
          filter.push({ term: { [field]: value } });
        }
      });

      const query = must.length > 0 || filter.length > 0 ? {
        bool: {
          ...(must.length > 0 && { must }),
          ...(filter.length > 0 && { filter })
        }
      } : { match_all: {} };

      const body = {
        query,
        size,
        from,
        sort: sort === '_score' ? [{ _score: { order: sortOrder } }] : [{ [sort]: { order: sortOrder } }]
      };

      const response = await fetch(`${config.endpoint}/${index}/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`ES search error: ${response.status}`);
      }

      const data = await response.json();
      return {
        results: data.hits?.hits?.map(hit => ({
          id: hit._id,
          score: hit._score,
          ...hit._source
        })) || [],
        total: data.hits?.total?.value || 0
      };
    } catch (error) {
      console.error(`Error searching ES index ${index}:`, error);
      return null;
    }
  };

  const getFacets = async (entityName, field, searchQuery = '') => {
    if (!isEntityEnabled(entityName)) return null;
    
    const index = config.indices?.[entityName];
    if (!index) return null;

    try {
      const query = searchQuery.trim() ? {
        multi_match: {
          query: searchQuery,
          fields: ['*'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      } : { match_all: {} };

      const body = {
        query,
        size: 0,
        aggs: {
          facets: {
            terms: {
              field: `${field}.keyword`,
              size: 50
            }
          }
        }
      };

      const response = await fetch(`${config.endpoint}/${index}/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`ES facet error: ${response.status}`);
      }

      const data = await response.json();
      return data.aggregations?.facets?.buckets?.map(bucket => ({
        key: bucket.key,
        count: bucket.doc_count
      })) || [];
    } catch (error) {
      console.error(`Error getting facets from ES index ${index}:`, error);
      return null;
    }
  };

  // Generic method to get any entity
  const getEntity = async (entityName) => {
    return fetchFromElasticsearch(entityName);
  };

  // Legacy methods for backwards compatibility
  const getTemplates = async () => fetchFromElasticsearch('Template');
  const getPersonas = async () => fetchFromElasticsearch('Persona');

  return {
    config,
    setConfig: (newConfig) => {
      setConfig(newConfig);
      saveElasticsearchConfig(newConfig);
    },
    isEnabled: isEnabled(),
    isEntityEnabled,
    getEntity,
    createEntity: createInElasticsearch,
    updateEntity: updateInElasticsearch,
    searchEntity: searchInElasticsearch,
    getFacets,
    getTemplates,
    getPersonas,
    allEntities: ALL_ENTITIES
  };
};

export default function ElasticsearchDataSource() {
  const [config, setConfigState] = useState(() => getElasticsearchConfig());
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [indexStats, setIndexStats] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [syncInterval, setSyncInterval] = useState(() => parseInt(localStorage.getItem('es_sync_interval') || '60'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastSyncStats, setLastSyncStats] = useState(null);
  const syncTimerRef = React.useRef(null);
  const { toast } = useToast();



  const updateConfig = (updates) => {
    const newConfig = { ...config, ...updates };
    setConfigState(newConfig);
    saveElasticsearchConfig(newConfig);
  };

  const updateIndex = (entityName, indexName) => {
    updateConfig({
      indices: { ...config.indices, [entityName]: indexName }
    });
  };

  const toggleEntityEnabled = (entityName) => {
    const enabledEntities = config.enabledEntities || [];
    const newEnabled = enabledEntities.includes(entityName)
      ? enabledEntities.filter(e => e !== entityName)
      : [...enabledEntities, entityName];
    updateConfig({ enabledEntities: newEnabled });
  };

  const testConnection = async () => {

    setConnectionStatus('checking');
    setIsLoading(true);

    try {
      // Test basic connectivity
      const response = await fetch(`${config.endpoint}/_cluster/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const health = await response.json();
      
      // Check all configured indices
      const stats = {};
      for (const entity of ALL_ENTITIES) {
        const indexName = config.indices?.[entity.name] || entity.defaultIndex;
        stats[entity.name] = await getIndexCount(indexName);
      }
      setIndexStats(stats);

      setConnectionStatus('connected');
      toast({
        title: "Connected — syncing data…",
        description: `Cluster: ${health.status}. Pushing entity data to Elasticsearch.`,
      });

      // Sync all entity data to ES
      const syncResults = await syncEntitiesToElasticsearch(config.endpoint, config.indices);
      const totalSynced = Object.values(syncResults).reduce((s, r) => s + r.synced, 0);
      const totalErrors = Object.values(syncResults).reduce((s, r) => s + r.errors, 0);

      toast({
        title: "Sync Complete",
        description: `${totalSynced} records pushed to Elasticsearch${totalErrors > 0 ? ` (${totalErrors} errors)` : ''}.`,
      });
    } catch (error) {
      console.error('ES connection error:', error);
      setConnectionStatus('error');
      setIndexStats({});
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect to Elasticsearch",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getIndexCount = async (index) => {
    try {
      const response = await fetch(`${config.endpoint}/${index}/_count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data.count;
      }
      return null;
    } catch {
      return null;
    }
  };

  const ensureIndexExists = async (endpoint, index) => {
    try {
      const check = await fetch(`${endpoint}/${index}`, { method: 'HEAD' });
      if (check.status === 404) {
        // Index doesn't exist — create it empty
        await fetch(`${endpoint}/${index}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        console.log(`[ES] Created empty index: ${index}`);
      }
    } catch (err) {
      console.warn(`[ES] Could not ensure index ${index}:`, err.message);
    }
  };

  const syncEntitiesToElasticsearch = async (endpoint, indices, { force = false } = {}) => {
    const results = {};
    for (const entity of ALL_ENTITIES) {
      const index = indices?.[entity.name] || entity.defaultIndex;
      try {
        // Ensure index exists before any operation
        await ensureIndexExists(endpoint, index);

        // Fetch local count and ES count in parallel
        const [records, esCount] = await Promise.all([
          client.entities[entity.name].list(),
          (async () => {
            try {
              const r = await fetch(`${endpoint}/${index}/_count`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
              if (!r.ok) return null;
              const d = await r.json();
              return d.count ?? null;
            } catch { return null; }
          })()
        ]);

        const localCount = records?.length ?? 0;

        // Skip sync if counts match and not forced
        if (!force && esCount !== null && esCount === localCount) {
          results[entity.name] = { synced: 0, errors: 0, skipped: true, localCount, esCount };
          console.log(`[ES Sync] ${entity.name}: counts match (${localCount}) — skipped`);
          continue;
        }

        if (!records || records.length === 0) {
          results[entity.name] = { synced: 0, errors: 0, localCount: 0, esCount };
          continue;
        }

        let synced = 0, errors = 0;
        for (const record of records) {
          const { id, ...docData } = record;
          const res = await fetch(`${endpoint}/${index}/_doc/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(docData)
          });
          if (res.ok) synced++; else errors++;
        }
        results[entity.name] = { synced, errors, localCount, esCount };
        console.log(`[ES Sync] ${entity.name}: local=${localCount} es=${esCount} → synced ${synced}`);
      } catch (err) {
        console.error(`Sync error for ${entity.name}:`, err);
        results[entity.name] = { synced: 0, errors: 1 };
      }
    }
    return results;
  };

  const runSync = useCallback(async ({ force = false } = {}) => {
    if (!config.endpoint || isSyncing) return;
    setIsSyncing(true);
    try {
      const results = await syncEntitiesToElasticsearch(config.endpoint, config.indices, { force });
      const totalSynced = Object.values(results).reduce((s, r) => s + r.synced, 0);
      const totalSkipped = Object.values(results).filter(r => r.skipped).length;
      setLastSyncTime(new Date());
      setLastSyncStats(results);
      console.log(`[ES Sync] ${totalSynced} records synced, ${totalSkipped} entities skipped (no diff) at ${new Date().toLocaleTimeString()}`);
    } finally {
      setIsSyncing(false);
    }
  }, [config.endpoint, config.indices, isSyncing]);

  // Start/restart periodic sync whenever interval or connection changes
  useEffect(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    if (connectionStatus === 'connected' && config.endpoint && syncInterval > 0) {
      // Periodic sync is differential (force=false) — only syncs entities with count mismatch
      syncTimerRef.current = setInterval(() => runSync({ force: false }), syncInterval * 1000);
    }
    return () => { if (syncTimerRef.current) clearInterval(syncTimerRef.current); };
  }, [connectionStatus, syncInterval, config.endpoint]);

  // Auto-test connection on mount if endpoint is configured
  React.useEffect(() => {
    if (config.endpoint) {
      testConnection();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleEnabled = (enabled) => {
    updateConfig({ enabled });
    toast({
      title: enabled ? "Elasticsearch Enabled" : "Elasticsearch Disabled",
      description: enabled 
        ? "Selected entities will now load from Elasticsearch" 
        : "Data will load from the default Base44 database"
    });
  };

}

getElasticsearchConfig();
console.log([ALL_ENTITIES,ElasticsearchDataSource]);
