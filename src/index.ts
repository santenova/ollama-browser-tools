// Import necessary modules
import { appParams, functionsVersion } from "./apis/lib/app-params.ts";
import { config,client,createClient2,createClient,updateConfig, localStorage, dumpObject, setup } from "./apis/client";

// Update the model name

client.integrations.Core.capabilities(client);

config.model = "qwen3:latest";
client.setConfig(config);
console.log(client);
