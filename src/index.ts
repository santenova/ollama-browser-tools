
import { client, localStorage, dumpObject} from "./apis/client";



const ollamaProxy = client.integrations.Core.ollamaProxy;
const capabilities = client.integrations.Core.capabilities();



console.log({client:client, input:client.params,ollama:ollamaProxy,
    capabilities:capabilities,
                               run: undefined});


console.log({thinking:client.integrations.Core.thinking(),
                               tools: client.integrations.Core.toolbox(),
                               websearch: client.integrations.Core.websearch()});
