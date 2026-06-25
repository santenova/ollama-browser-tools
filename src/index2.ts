// Import necessary modules
import { appParams, functionsVersion } from "./apis/lib/app-params.ts";

import { config,client,baseClient,createClient2,createClient, localStorage, dumpObject, setup } from "./apis/client";

import { capabel } from "./apis/lib/resurces.ts";


// Usage example
(async () => {
  try {
    
    config.model = "qwen3:latest";
    client.setConfig(config);
    // sync

    client.capabilities = await capabel();
    // asyncc
    console.log({thinking:client.integrations.Core.thinking(),
                                   tools: client.integrations.Core.toolbox(),
                                   websearch: client.integrations.Core.websearch(model=confg.model)});


    } catch (error) {
    console.error('Error setting capabilities:', error.message);
  }
})();


    console.log(client);
