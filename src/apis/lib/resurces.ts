
export async function fetchModelIds(): Promise<string[]> {
  const response = await fetch('http://localhost:11434/v1/models');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data.data.map((model: { id: string }) => model.id);
}

async function fetchModelCapabilities(modelId){
  const response = await fetch('http://localhost:11434/api/show', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      stream: true,
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


export async function capabel(s) {
  const modelIds = await fetchModelIds();

  let allTools = {};

  for (const model of modelIds) {
    try {
      const info = await fetchModelCapabilities(model);


         for (const tool of info.capabilities) {
            if(info.modified) {       
            if (!allTools[tool]) {
              allTools[tool]=[];

             allTools[tool][model] = info.model_info['general.parameter_count'];

             
            } else {
              if(!allTools[tool][model]) {
                 
                     
                allTools[tool][model]= info.model_info['general.parameter_count'];
     
              }else{

                 
                 
               allTools[tool][model]= info.model_info['general.parameter_count'];


              }
            }
        }
      }
    } catch (error) {
      console.error(`Error fetching capabilities for model ${model}: ${error.message}`);
    }
  }
  return allTools;
}
