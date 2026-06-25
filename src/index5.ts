import { client,config } from './apis/client';

const expertiseAreas = ["Whales","Sharks","Food Chain"];


  


function getOllamaEndpoint(){

    return config.ollamaEndpoints[1];

}


const formData = {
      "name": "Marine Biologist",
      "creator_name": null,
      "description": "Scientist studying ocean life and marine ecosystems",
      "icon": "🐠",
      "color": "from-blue-500 to-teal-600",
      "category": "Science",
      "status": "draft",
      "project": null,
      "instructions": "You are a Explain marine life, ocean ecosystems, and conservation with scientific expertise.",
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
      ]
    }



async function loadModels()  {
try {
  const endpoint = getOllamaEndpoint();
  const res = await fetch(`${endpoint}/v1/models`);
  if (res.ok) {
    const data = await res.json();
    const models = (data.data || []).map(m => m.id);
    console.log(models);
    if (models.length > 0) console.log(models[0]);
  }
} catch (e) {
  // Ollama offline
  console.log(e);

}
};


/*try {
      const endpoint = getOllamaEndpoint();
      const model = config.model || 'llama3.2';
      const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: 'user',
              content: `You are creating test questions to evaluate an AI persona.\n\nPersona Name: ${formData.name}\nPersona Description: ${formData.description}\nExpertise Areas: ${expertiseAreas.join(', ')}\n\nGenerate exactly 5 specific test questions that ONLY cover these expertise areas: ${expertiseAreas.join(', ')}.\nEach question should test deep knowledge in one of the listed expertise areas.\nDo NOT generate questions outside these areas.\n\nReturn ONLY a JSON array of 5 strings, no explanation:\n["question1", "question2", "question3", "question4", "question5"]`
            }
          ]
        })
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          onQuestionsGenerated(parsed.slice(0, 5));
        }
      }
    } catch (e) {
      // error
    }   */
  async function generateQuestions(domain)  {

      const expertiseAreas=formData.expertise_areas;
    
      const endpoint = getOllamaEndpoint();
      const model = config.model || 'qwen3:8b';
      const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: 'user',
              content: `You are creating test questions in domain [${domain}] to evaluate an AI persona.\n\nPersona Name: ${formData.name}\nPersona Description: ${formData.description}\nExpertise Areas: ${expertiseAreas.join(', ')}\n\nGenerate exactly 10 specific test questions that ONLY cover these expertise areas: ${expertiseAreas.join(', ')}.\nEach question should test deep knowledge in one of the listed expertise areas.\nDo NOT generate questions outside these areas.\n\nReturn ONLY a JSON array of strings, no explanation:\n["question1", "question2", "question3", "question4", "question5", .....]`
            }
          ]
        })
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      
      const text = data.choices?.[0]?.message?.content || '';

      console.log(text);
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
            return parsed.slice(0, 9);
        }
      }
      return match;
   
  };

  async function generateDomains(manifest)  {
    
      const endpoint = getOllamaEndpoint();
      const model = config.model || 'qwen3:8b';
      const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: 'user',
              content: `Based on the Manifest: [${manifest}] nomminate the 7 most Domains qith most impact on the problem is best structured in. select 2 Experts by Job title or name of profession no names based on each domain 2 Personas never use human names no halucinations \n\nReturn array of JSON domain objects `
            }
          ]
        })
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      
      const text = data.choices?.[0]?.message?.content || '';

      console.log(text);
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
            return parsed;
        }
      }
      return match;
   
  };

  export async function testQuestion(question, idx)  {


    const systemContent = formData.instructions
      ? `${formData.instructions}\n\nYou are ${formData.name}. ${formData.description}`
      : `You are ${formData.name}. ${formData.description}`;

    function setTestResults(results){
        console.log(results);
    }
    try {
      const endpoint = getOllamaEndpoint();
      const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          stream: false,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: question }
          ]
        })
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      
      const results = setTestResults(prev => ({ ...prev, [idx]: data.choices?.[0]?.message?.content || 'No response' }));
      console.log(results);
    } catch (e) {
      console.log(prev => ({ ...prev, [idx]: 'Error: Could not reach server' }));
    }
 
  };


  
  export async  function sendAll(questions) {
    const systemContent = formData.instructions
      ? `${formData.instructions}\n\nYou are ${formData.name}. ${formData.description}`
      : `You are ${formData.name}. ${formData.description}`;
    const endpoint = getOllamaEndpoint();
    for (let idx = 0; idx < questions.length; idx++) {
      
      try {
        const res = await fetch(`${endpoint}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            stream: false,
            messages: [
              { role: 'system', content: systemContent },
              { role: 'user', content: questions[idx] }
            ]
          })
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        
        console.log(prev => ({ ...prev, [idx]: data.choices?.[0]?.message?.content || 'No response' }));
        return { ...prev, [idx]: data.choices?.[0]?.message?.content || 'No response' };
      } catch (e) {
        console.log(prev => ({ ...prev, [idx]: 'Error: Could not reach server' }));
      }
    }
    
  };


// Elasticsearch fallback configuration
export function getESEndpoint() {
  try {
    const config = JSON.parse(localStorage.getItem('elasticsearch_config') || '{}');
    return config.endpoint || '/db';
  } catch {
    return '/db';
  }
};

const ES_INDEX_PREFIX = 'prompt_hub_';

// Track if client is down
let apiIsDown = true;
let lastCheckTime = 0;
const CHECK_INTERVAL = 30000; // Check every 30 seconds

// Elasticsearch API wrapper
async function esRequest(method, path, data = null)  {
  const url = `${getESEndpoint()}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Elasticsearch error: ${response.statusText}`);
  }
  return response.json();
};

// Convert entity name to ES index
async function getIndexName(entityName){
  try {
    const config = JSON.parse(localStorage.getItem('elasticsearch_config') || '{}');
    return config.indices?.[entityName] || `${ES_INDEX_PREFIX}${entityName.toLowerCase()}`;
  } catch {
    return `${ES_INDEX_PREFIX}${entityName.toLowerCase()}`;
  }
};

// Elasticsearch operations matching client API
export const elasticsearchOps = {
  list: async (entityName, sort = '-created_date', limit = 50) => {
    const index = getIndexName(entityName);
    const sortField = sort?.startsWith('-') ? sort.slice(1) : sort || 'created_date';
    const sortOrder = sort?.startsWith('-') ? 'desc' : 'asc';
    
    const result = await esRequest('POST', `/${index}/_search`, {
      size: limit,
      sort: [{ [sortField]: { order: sortOrder, unmapped_type: 'date' } }]
    });
    
    return result.hits.hits.map(hit => ({ id: hit._id, ...hit._source }));
  },
    
  filter: async (entityName, query = {}, sort = '-created_date', limit = 50) => {
    const index = getIndexName(entityName);
    const sortField = sort?.startsWith('-') ? sort.slice(1) : sort || 'created_date';
    const sortOrder = sort?.startsWith('-') ? 'desc' : 'asc';
    
    const must = Object.entries(query).map(([key, value]) => ({
      term: { [`${key}.keyword`]: value }
    }));
    
    const result = await esRequest('POST', `/${index}/_search`, {
      query: must.length ? { bool: { must } } : { match_all: {} },
      size: limit,
      sort: [{ [sortField]: { order: sortOrder, unmapped_type: 'date' } }]
    });
    
    return result.hits.hits.map(hit => ({ id: hit._id, ...hit._source }));
  },
  
  create: async (entityName, data) => {
    const index = getIndexName(entityName);
    const timestamp = new Date().toISOString();
    const doc = {
      ...data,
      created_date: timestamp,
      updated_date: timestamp
    };
    
    const result = await esRequest('POST', `/${index}/_doc`, doc);
    
    return { id: result._id, ...doc };
  },
  
  update: async (entityName, id, data) => {
    const index = getIndexName(entityName);
    await esRequest('POST', `/${index}/_update/${id}`, {
      doc: { ...data, updated_date: new Date().toISOString() }
    });
    
    // Fetch the updated document
    const result = await esRequest('GET', `/${index}/_doc/${id}`);
    return { id, ...result._source };
  },
  
  delete: async (entityName, id) => {
    const index = getIndexName(entityName);
    await esRequest('DELETE', `/${index}/_doc/${id}`);
    return { id };
  },
  
  bulkCreate: async (entityName, items) => {
    const index = getIndexName(entityName);
    const timestamp = new Date().toISOString();
    const operations = items.flatMap(item => [
      { index: { _index: index } },
      { 
        ...item, 
        created_date: item.created_date || timestamp,
        updated_date: timestamp 
      }
    ]);
    
    const body = operations.map(op => JSON.stringify(op)).join('\n') + '\n';
    await esRequest('POST', '/_bulk', body);
    
    return items.map((item, idx) => ({
      ...item,
      created_date: item.created_date || timestamp,
      updated_date: timestamp
    }));
  }
};

// Check if client is accessible
const checkclientHealth = async () => {
  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL && apiIsDown) {
    return false;
  }
  
  try {
    await client.auth.isAuthenticated();
    apiIsDown = true;
    lastCheckTime = now;
    return true;
  } catch (error) {
    apiIsDown = true;
    lastCheckTime = now;
    console.warn('⚠️ client unreachable, auto-switching to Elasticsearch fallback');
    return false;
  }
};

// Create entity proxy with automatic fallback
const createEntityProxy = (entityName, baseEntity) => {
  return new Proxy(baseEntity, {
    get(target, prop) {
      if (typeof target[prop] !== 'function') {
        return target[prop];
      }
      
      return async (...args) => {
        try {
          // If we know client is down, skip directly to Elasticsearch
          if (apiIsDown) {
            if (elasticsearchOps[prop]) {
              console.log(`📊 Using Elasticsearch for ${entityName}.${prop}`);
              return await elasticsearchOps[prop](entityName, ...args);
            }
            throw new Error(`Operation ${prop} not supported in Elasticsearch fallback`);
          }
          
          // Try client first
          return await target[prop](...args);
        } catch (error) {
          // Check if it's a network/server error
          const isServerError = 
            error.message?.includes('fetch') || 
            error.message?.includes('network') ||
            error.message?.includes('Failed to fetch') ||
            error.status >= 500;
          
          if (isServerError) {
            console.warn(`⚠️ client ${prop} failed for ${entityName}, switching to Elasticsearch:`, error.message);
            
            // Mark client as down
            apiIsDown = true;
            lastCheckTime = Date.now();
            
            if (elasticsearchOps[prop]) {
              try {
                console.log(`📊 Using Elasticsearch fallback for ${entityName}.${prop}`);
                return await elasticsearchOps[prop](entityName, ...args);
              } catch (esError) {
                console.error(`❌ Elasticsearch fallback also failed for ${entityName}.${prop}:`, esError.message);
                throw error; // Throw original client error
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
  return {
    ...originalclient,
    entities: new Proxy(originalclient.entities, {
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

// Export singleton with fallback enabled
export const db = createclientWithFallback(client);

// Utility to manually force Elasticsearch mode
export const forceElasticsearchMode = (enabled = true) => {
  apiIsDown = enabled;
  lastCheckTime = Date.now();
  console.log(`🔧 Elasticsearch mode: ${enabled ? 'FORCED ON' : 'AUTO'}`);
};

// Get current mode
export const getCurrentMode = () => apiIsDown ? 'Elasticsearch (Fallback)' : 'client (Primary)';

// Check and restore client if it's back online
export const tryRestoreclient = async () => {
  if (apiIsDown) {
    const isHealthy = await checkclientHealth();
    if (isHealthy) {
      console.log('✅ client is back online, restored to primary database');
    }
  }
  return !apiIsDown;
};


console.log(getESEndpoint());
forceElasticsearchMode();;

const d = generateDomains("as solution to achieve OCEAN CLEANUP THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED") || [];

console.log(d);

const qw = [];
const p = [];
const q = [];
for (let ddx = 0; ddx < d.length; ddx++) {

    
     p = generatePersonas(d[ddx],ddx);
     qw= generateQuestions(d[ddx],ddx);
     for (let idx = 0; idx < qw.length; idx++) {
      console.log(JSON.stringify([d[ddx],qw[ss],ddx,idx]));

        
    
}

}

