// Import necessary modules
import { appParams, functionsVersion } from "./apis/lib/app-params.ts";

import { config,client,baseClient,createClient2,createClient,updateConfig, localStorage, dumpObject, setup } from "./apis/client";

// import { ProblemSolutionClient,processSolutionPipeline } from "./apis/modules/solutions/solution.ts";

// capabilities object
// client.capabilities = await capabel();
config.prompt = 'who is alice';
config.model = "qwen3:latest";
client.setConfig(config);
const nextMessage = 'I am Alice.';

// Usage example
( () => {
    
    config.model = "qwen3:latest";
    client.setConfig(config);
    const data = client.integrations.Core.InvokeLLM('llama3:latest', nextMessage)
    


    console.log([config,data,client]);

})();
/*
const solution = new ProblemSolutionClient(config);

solution.createSolutionPipeline();



*/
