
import { config,client,baseClient,createClient2,createClient,updateConfig, localStorage, dumpObject, setup } from "./apis/client";


const conversationHistory = [
];

const nextMessage = 'I am Alice.';

// Usage example
(async () => {
    
    config.model = "qwen3:latest";
    client.setConfig(config);
    const data = client.integrations.Core.InvokeLLM('llama3:latest', nextMessage)
    console.log(data);

})();

