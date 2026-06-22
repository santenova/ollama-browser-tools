// Import necessary modules
import { appParams, functionsVersion } from "./apis/lib/app-params.ts";

import { config,client,baseClient,createClient2,createClient,updateConfig, localStorage, dumpObject, setup } from "./apis/client";

import { capabel } from "./apis/lib/resurces.ts";


// Usage example
(async () => {
    // capabilities object
    client.capabilities = await capabel();
    })();
    
    config.model = "qwen3:latest";
    client.setConfig(config);
    // entitys    
    console.log(client.entities.config);
    

    // asyncc
    //console.log({thinking:step1:step1.thinking(config.model,config.prompt)});

    console.log(client);


(async () => {
    
const nextMessage = 'I am Alice.';
client.integrations.Core.InvokeLLM('llama3:latest', nextMessage);

    console.log(client.entities);

})();

   
