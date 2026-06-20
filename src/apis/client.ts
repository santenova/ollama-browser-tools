// src/apis/client.ts


import axios from 'axios'; // Import axios directly

import ollama, { Ollama } from 'ollama'
import type { Message } from 'ollama'

import { appParams, appId,token,functionsVersion,appBaseUrl,getAppParams,localStorage } from "../apis/lib/app-params.ts";
import { capabel } from "../apis/lib/resources.ts"

import { capabel } from "../apis/lib/resurces.ts"
import { createEntitiesModule } from "../apis/lib/entities.ts"
import { createFunctionsModule } from "../apis/lib/functions.ts"

import { thinkingEnabled } from "../apis/modules/thinking/thinking-enabled.ts";
import { thinkingLevels } from "../apis/modules/thinking/thinking-levels.ts";
import { thinkingStreaming } from "../apis/modules/thinking/thinking-streaming.ts";
import { calculator } from "../apis/modules/tools/calculator.ts";
import { flightTracker } from "../apis/modules/tools/flight-tracker.ts";
import { multiTool } from "../apis/modules/tools/multi-tool.ts";
import { gptOssBrowserTools } from "../apis/modules/websearch/gpt-oss-browser-tools.ts";
import { websearchTools } from "../apis/modules/websearch/websearch-tools.ts";

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

  const client = {
    capabilities:{},
    setConfig: async (config) => {  
      config = config;
    },
    config:config,
    setCapebilities: async (capabilities) => {  
      capabilities = capabilities;
    },
    serverUrl,
    appId,
    functionsVersion,
    headers,
    ollamaEndpoints,
    messages,
    axiosInstance: createAxiosClient({ baseURL: serverUrl, headers, token }),
    integrations: {
        Core: {          
          capabilities:  async() => { return capabel();},
          vision:gptOssBrowserTools,
          thinking:thinkingStreaming,
          websearch:websearchTools,
          toolbox:multiTool,
          elasticSearchProxy:functionsAxiosClient,
          ollamaProxy:createOllamaClient(),
          InvokeLLM: async () => { console.log(["capabilities",[1,2,3]]); return "" },
          UploadFile: async () => {  },
          SendEmail: async () => {},
          GenerateImage: async () => {},
          ExtractDataFromUploadedFile: async () => {},
        }
    }
  };
  return client;
}


export function createClient2(config) {
  var _a, _b;
  const { serverUrl = "http://localhost", appId, token, serviceToken, requiresAuth = false, appBaseUrl, options, functionsVersion, headers: optionalHeaders, } = config;
  // Normalize appBaseUrl to always be a string (empty if not provided or invalid)
  const normalizedAppBaseUrl = typeof appBaseUrl === "string" ? appBaseUrl : "";
  const socketConfig = {
    serverUrl,
    mountPath: "/ws-user-apps/socket.io/",
    transports: ["websocket"],
    appId,
    token,
  };
  let socket = null;
  const getSocket = () => {
    if (!socket) {
      socket = RoomsSocket({
        config: socketConfig,
      });
    }
    return socket;
  };
  const headers = {
    ...optionalHeaders,
    "X-App-Id": String(appId),
  };
  const functionHeaders = functionsVersion
    ? {
      ...headers,
      "prompthub-Functions-Version": functionsVersion,
    }
    : headers;
  const axiosClient = createAxiosClient({
    baseURL: `${serverUrl}/api`,
    headers,
    token,
    onError: options === null || options === void 0 ? void 0 : options.onError,
  });
  const functionsAxiosClient = createAxiosClient({
    baseURL: `${serverUrl}/api`,
    headers: functionHeaders,
    token,
    interceptResponses: false,
    onError: options === null || options === void 0 ? void 0 : options.onError,
  });
  const serviceRoleHeaders = {
    ...headers,
    ...(token ? { "on-behalf-of": `Bearer ${token}` } : {}),
  };
  const serviceRoleAxiosClient = createAxiosClient({
    baseURL: `${serverUrl}/api`,
    headers: serviceRoleHeaders,
    token: serviceToken,
    onError: options === null || options === void 0 ? void 0 : options.onError,
  });
  const serviceRoleFunctionsAxiosClient = createAxiosClient({
    baseURL: `${serverUrl}/api`,
    headers: functionHeaders,
    token: serviceToken,
    interceptResponses: false,
  });

const userModules = {
    entities: createEntitiesModule({
      axios: axiosClient,
      appId,
      getSocket,
    }),
    setConfig: async (config) => {  
      config = config;
    },
    config:config,
    setCapebilities: async (capabilities) => {  
      capabilities = capabilities;
    },
    capabilities:{},
    serverUrl,
    appId,
    functionsVersion,
    headers,
    ollamaEndpoints:config.ollamaEndpoints,
    messages:config.messages,
    axiosInstance: createAxiosClient({ baseURL: serverUrl, headers, token }),
    integrations: {
        Core: {          
          capabilities:  async() => { return capabel();},
          vision:gptOssBrowserTools,
          thinking:thinkingStreaming,
          websearch:websearchTools,
          toolbox:multiTool,
          elasticSearchProxy:functionsAxiosClient,
          ollamaProxy:createOllamaClient(),
          InvokeLLM: async () => { console.log(["capabilities",[1,2,3]]); return "" },
          UploadFile: async () => {  },
          SendEmail: async () => {},
          GenerateImage: async () => {},
          ExtractDataFromUploadedFile: async () => {},
        }
    },
    functions: createFunctionsModule(functionsAxiosClient, appId, {
      getAuthHeaders: () => {
        const headers = {};
        // Get current token from storage or initial config
        const currentToken = token || getAccessToken();
        if (currentToken) {
          headers["Authorization"] = `Bearer ${currentToken}`;
        }
        return headers;
      },
      baseURL: (_a = functionsAxiosClient.defaults) === null || _a === void 0 ? void 0 : _a.baseURL,
    })
  };

  const serviceRoleModules = {
    entities: createEntitiesModule({
      axios: serviceRoleAxiosClient,
      appId,
      getSocket,
    }),
    integrations: localStub.integrations,
    functions: createFunctionsModule(serviceRoleFunctionsAxiosClient, appId, {
      getAuthHeaders: () => {
        const headers = {};
        // Use service token for authorization
        if (serviceToken) {
          headers["Authorization"] = `Bearer ${serviceToken}`;
        }
        return headers;
      },
      baseURL: (_b = serviceRoleFunctionsAxiosClient.defaults) === null || _b === void 0 ? void 0 : _b.baseURL,
    }),
    cleanup: () => {
      if (socket) {
        socket.disconnect();
      }
    }
  };

  // Assemble the client with all modules
  const assembledClient = {
    ...userModules,
    asServiceRole: () => serviceRoleModules
  };


    
  console.log(assembledClient);
  return assembledClient;


}



export const createOllamaClient = (apiKey?: string): Ollama => {
  return new Ollama({
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  });
}



export const functionsAxiosClient = createAxiosClient({
    baseURL: `${serverUrl}/api`
  });

export const localStub = {
    entities: createEntitiesModule({
        axios: axiosClient,
        appId,
        getSocket,
    }),
    params:getAppParams(),
    integrations:{
    Core: {
      capabilities: async () => { console.log(["capabilities",[1,2,3]]); return  capabel()},
      vision:gptOssBrowserTools,
      thinking:thinkingStreaming,
      websearch:websearchTools,
      toolbox:multiTool,
      elasticSearchProxy:functionsAxiosClient,
      ollamaProxy:createOllamaClient(),
      InvokeLLM: async () => { console.log(["capabilities",[1,2,3]]); return "" },
      UploadFile: async () => {  },
      SendEmail: async () => {},
      GenerateImage: async () => {},
      ExtractDataFromUploadedFile: async () => {},
    },
  },
  functions: createFunctionsModule(functionsAxiosClient, appId, {
      getAuthHeaders: () => {
        const headers = {};
        // Get current token from storage or initial config
        const currentToken = token || getAccessToken();
        if (currentToken) {
          headers["Authorization"] = `Bearer ${currentToken}`;
        }
        return headers;
      },
      baseURL: serverUrl
    })

};


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
  ollamaEndpoints: ["http://localhost:11434","https://christy-ramentaceous-verbatim.ngrok-free.de"],
  model: "qwen3:0.6b",
  query:"why is the sky blue"
};


export const defaultClient = createClient(config);

export const client = _local ? defaultClient : defaultClient;




