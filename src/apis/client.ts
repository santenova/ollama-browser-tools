// src/apis/client.ts

import axios from 'axios'; // Import axios directly

import ollama, { Ollama } from 'ollama'
import type { Message } from 'ollama'
import { localStorage } from "../apis/lib/localStore.ts"


export async function fetchModelIds(): Promise<string[]> {
  const response = await fetch('https://christy-ramentaceous-verbatim.ngrok-free.dev/v1/models');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data.data.map((model: { id: string }) => model.id);
}

async function fetchModelCapabilities(modelId: string): Promise<any> {
  const response = await fetch('http://localhost:11434/api/show', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
    }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return {
    model: modelId,
    capabilities: data.capabilities,
    modified: data.modified_at,
    model_info: data.model_info,
  };
}

import { appParams, appId,token,functionsVersion,appBaseUrl,getAppParams } from "../apis/lib/app-params.ts"
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

export function createClient(config) {
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
    integrations: {
      Core: {
        ollamaClient: async () => { }
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
    integrations: {
    Core: {
      capabilities:async () => { console.log(["capabilities",[1,2,3]]); return [1,2];  },
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




export const defaultClient = createClient({
        serverUrl: "http://localhost:5174",
        appId,
        functionsVersion: functionsVersion !== null && functionsVersion !== void 0 ? functionsVersion : undefined,
        headers: {},
    });
    
export const client = _local ? localStub : defaultClient;
