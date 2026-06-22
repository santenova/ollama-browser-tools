import axios from 'axios'; // Import axios directly

import ollama, { Ollama } from 'ollama'
import type { Message } from 'ollama'
import axios from 'axios'; // Import axios directly
import { appParams, appId,token,functionsVersion,appBaseUrl,getAppParams,localStorage } from "../apis/lib/app-params.ts";

import { useElasticsearchDataSource , getElasticsearchConfig, getPersonas } from "../apis/lib/elasticsearch.ts";


import { thinkingEnabled } from "../apis/modules/thinking/thinking-enabled.ts";
import { thinkingLevels } from "../apis/modules/thinking/thinking-levels.ts";
import { thinkingStreaming } from "../apis/modules/thinking/thinking-streaming.ts";
import { calculator } from "../apis/modules/tools/calculator.ts";
import { flightTracker } from "../apis/modules/tools/flight-tracker.ts";
import { multiTool } from "../apis/modules/tools/multi-tool.ts";
import { gptOssBrowserTools } from "../apis/modules/websearch/gpt-oss-browser-tools.ts";
import { websearchTools } from "../apis/modules/websearch/websearch-tools.ts";
import { ProblemSolutionClient } from "../apis/modules/solutions/solution.ts";

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
export const getOllamaEndpoint = () => {
  // Get the current hostname from environment variables or default to 'localhost'
  const host = process.env.HOSTNAME || 'localhost';

  // Check if the host is a local IP address or 'localhost'
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) {
    // If it's a local network, return '/proxy'
    return  config.ollamaEndpoints[1];
  } else {
    // Otherwise, select the appropriate endpoint from client.config.ollamaEndpoints
    const ollamaEndpoints = client.config.ollamaEndpoints;
    
    if (ollamaEndpoints && ollamaEndpoints.length > 0) {
      // Return the first available endpoint
      return ollamaEndpoints[0];
    } else {
      // Fallback to a default ngrok URL
      return 'https://christy-ramentaceous-verbatim.ngrok-free.dev';
    }
  }
};



export const createOllamaClient = (apiKey?: string): Ollama => {
  return new Ollama({
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  });
}



/**
 * Streams thoughts and responses from the LLM using vanilla fetch.
 */
export async function thinkingStreaming() {
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
          content: 'What is 10 + 23',
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
          const message = JSON.parse(line);

          if (message.message.thinking && !startedThinking) {
            startedThinking = true;
            process.stdout.write('\nthinkingStreaming\tThinking:\n========\n\n');
          } else if (message.message.content && startedThinking && !finishedThinking) {
            finishedThinking = true;
            process.stdout.write('\nthinkingStreaming\tResponse:\n========\n\n');
          }

          if (message.message.thinking) {
            process.stdout.write(message.message.thinking);
          } else if (message.message.content) {
            process.stdout.write(message.message.content);
          }
        } catch (parseError) {
          console.error('Failed to parse chunk:', line, parseError);
        }
      }
    }
  } catch (error) {
    console.error('Error invoking LLM:', error.message);
  }
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
  const { serverUrl, appId, functionsVersion, headers, model, ollamaEndpoints, messages } = config;

  let modelName = model;
  let lastUserMessagePromptText = '';
    
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
    setConfig: async (config) => {  
      config = config;
    },
    config:config,
    integrations: {
        Core: {          
          vision:gptOssBrowserTools,
          thinking:thinkingStreaming,
          websearch:websearchTools,
          toolbox:multiTool,
          InvokeLLM: async () => {return new ProblemSolutionClient();   },
          UploadFile: async () => {  },
          SendEmail: async () => {},
          GenerateImage: async () => {},
          ExtractDataFromUploadedFile: async () => {},
        }
    }
  };
  return client;
}






export const config = {
  serverUrl: 'http://localhost:5174',
  appId:appParams.appId,
  functionsVersion: functionsVersion !== null && functionsVersion !== undefined ? functionsVersion : undefined,
  model: 'defaultModelName', // Replace with actual model name
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




const db = useElasticsearchDataSource();



export const baseClient = _local ? defaultClient : createclientWithFallback(defaultClient);

baseClient.entities = db;

export const client = createclientWithFallback(baseClient);
