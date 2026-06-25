
/**
 * Streams thoughts and responses from the LLM using vanilla fetch.
 */
export async function generateQuestions(userPrompt) {
  
    
      const formData =  {"name": "Marine Biologist",
  "creator_name": null,
  "description": "Scientist studying ocean life and marine ecosystems",
  "icon": "🐠",
  "color": "from-blue-500 to-teal-600",
  "category": "Science",
  "status": "draft",
  "project": null,
  "instructions": "Explain marine life, ocean ecosystems, and conservation with scientific expertise.",
  "tone": "Enthusiastic",
  "expertise_areas": [
    "Marine Biology",
    "Ocean Ecology",
    "Conservation",
    "Research"
  ]};
      const expertiseAreas = [
    "Marine Biology",
    "Ocean Ecology",
    "Conservation",
    "Research"
  ];

  const endpoint = "http://localhost:11434"
  const model = 'qwen3:0.6b';

    const response = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'OPTIMIZE :'+userPrompt }], stream: true })
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
          const message = line;
          process.stdout.write( message);
        } catch (parseError) {
          console.error('Failed to parse chunk:', line, parseError);
        }
      }
    }
    
    
  };

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
      stream: false,
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




export async function capabel() {
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

   // Process solution flower
export  const domains = ["Whales and Sharks", "Moons and Planets +", "Domain 3", "Domain 4", "Domain 5", "Domain 6", "Domain 7"];
export  const personasPerDomain = {
    "Domain 1": ["Persona A", "Persona B"],
    "Domain 2": ["Persona C", "Persona D"],
    // Add more domains and personas as needed
  };

export async function optimizePrompt(prompt) {
      
        // Get the appropriate endpoint based on your configuration
        const endpoint = 'http://localhost:11434/v1/chat/completions';
        //'https://your-ollama-endpoint.';

        // Prepare the request payload
        const requestBody = JSON.stringify({
          model: 'qwen3:0.6b',
          messages: [
            {
              role: 'user',
              content:prompt,
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
              const message = line;
              process.stdout.write( message);
            } catch (parseError) {
              console.error('Failed to parse chunk:', line, parseError);
            }
          }
        }
        
    }

// Simulated localStorage for backend usage
const localStorage = {
  getItem: (key) => {
    return JSON.parse(process.env[key] || 'null');
  },
  setItem: (key, value) => {
    process.env[key] = JSON.stringify(value);
  }
};

// Function to check system environment for available processing power

// Client class to manage the Problem Solution Process
export class ProblemSolutionClient {
  constructor(config) {
    this.config = config;
    this.solutionPipeline = null;
  }

  async executeStep(stepPrompt, stepNumber) {
    const response = await optimizePrompt(stepPrompt);
    localStorage.setItem(`step-${stepNumber}-prompt`, stepPrompt);
    localStorage.setItem(`step-${stepNumber}-response`, response);
    return response;
  }

  async processSolutionPipeline() {
  const steps = solutionPipeline.ProblemSolution[0].steps;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    if (step.subSteps) {
      console.log(`Step ID: ${step.id} - Prompt: ${step.prompt}`);
      
      for (let j = 0; j < step.subSteps.length; j++) {
        const subStep = step.subSteps[j];
        
        if (!subStep.response) {
          // Simulate response from the AI model
          subStep.response = `Response to sub-step ${j + 1}: ${subStep.prompt}`;
        }
        
        console.log(`Sub-Step ID: ${subStep.id} - Prompt: ${subStep.prompt}`);
        console.log(`Sub-Step ID: ${subStep.id} - Response: ${subStep.response}\n`);
      }
    } else {
      if (!step.response) {
        // Simulate response from the AI model
        step.response = `Response to step ${i + 1}: ${step.prompt}`;
      }
      
      console.log(`Step ID: ${step.id} - Prompt: ${step.prompt}`);
      console.log(`Step ID: ${step.id} - Response: ${step.response}\n`);
    }
    
    // Determine capabilities for each step
    if (step.id === "step008") {
      const capabilities = await capabel(step.prompt);
      console.log(`Capabilities for Step ID: ${step.id} - Capabilities:`, capabilities);
    }
  }


  solutionPipeline.ProblemSolution[0].solutionFlower.domains = domains;
  solutionPipeline.ProblemSolution[0].solutionFlower.personasPerDomain = personasPerDomain;

  console.log("Solution Flower - Domains:", domains);
  console.log("Solution Flower - Personas per Domain:", personasPerDomain);

  // Process assessment
  const assessmentSubSteps = solutionPipeline.ProblemSolution[0].assessment.subSteps;
  
    for (let i = 0; i < assessmentSubSteps.length; i++) {
        let subStep = assessmentSubSteps[i];
        
        // Optimize the sub-step prompt
        // q    subStep.prompt = await optimizePrompt(subStep.prompt);
        subStep.prompt = fetchModelIds(subStep.prompt);

        if (!subStep.response) {
            // Simulate response from the AI model
            subStep.response = `Response to sub-step ${i + 1}: ${subStep.prompt}`;
        }
        
        console.log(`Assessment Sub-Step ID: ${subStep.id} - Optimized Prompt: ${subStep.prompt}`);
        console.log(`Assessment Sub-Step ID: ${subStep.id} - Response: ${subStep.response}\n`);
    }
    
  const assessmentResponse = "Assessment Response: Detailed planning and resource estimation completed.";
  solutionPipeline.ProblemSolution[0].assessment.response = assessmentResponse;
  console.log(`Assessment Step ID: ${solutionPipeline.ProblemSolution[0].assessment.id} - Response: ${assessmentResponse}`);
}

  async createSolutionPipeline() {
   
    // Gather pre-pipeline data and store it in localStorage
    await capabel();
    const step1Prompt = `
      Analyse and re-word the task to reflect the true scope. Create a Task manifest, continue with giving an extensive Introduction Point by Point, conclude with the summary of the Task manifest.
      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED
    `;
    const step1Response = await this.executeStep(step1Prompt, 1);

    
    // Step 2: Define 7 core components (domains) of the Solution Flower and query personas per domain
    const step2Prompt = `
      Define 7 core components (domains) of the Solution Flower to achieve the Task solution.
      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED {}
      return only structured JSON only like: ["Domain 1", "Domain 2", "Domain 3", "Domain 4", "Domain 5", "Domain 6", "Domain 7"]`;

        
        //await generateQuestions(step2Prompt);
        const step2Response = await this.executeStep(step2Prompt, 2);
        console.log(step2Response);
        // Extract domains from Step 2 response
         try {
              const message = line;
              process.stdout.write( message);
            } catch (parseError) {
              console.error('Failed to parse chunk:');
            }

            
        

        for (const [index, domain] of domains.entries()) {
          const personaPrompt = `
            For the domain "${domain}", identify a pair of the most relevant personas.
          `;
          const personaResponse = await this.executeStep(personaPrompt, 2.1 + index);
          personasPerDomain[domain] = personaResponse;
          console.log(domains);
        }

    
   
      
      
    // Step 3: Declare SMART Goals & KPIs across 7 domains of the Task solution flower
    const step3Prompt = `
      Declaration of SMART Goals & KPIs across 7 domains of the Task solution flower.
      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED
    `;
    const step3Response = await this.executeStep(step3Prompt, 3);

    // Step 4: Understanding Your Target
    const step4Prompt = `
      Understanding Your Target.
      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED
    `;
    const step4Response = await this.executeStep(step4Prompt, 4);

    // Assessment Step: Planning and Resource estimation
    const assessmentPrompt = `
      Assessment Time: Planning and resource estimation.
      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED
    `;
    const assessmentResponse = await this.executeStep(assessmentPrompt, 5);

    // Combine all responses into a single solution pipeline
    this.solutionPipeline = {
      ProblemSolution: [
        {
          sytemPromptDefaultIdentity: "Dr Know",
          userPrompt: "as solution to achieve OCEAN CLEANUP THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED",
          details: "4 Steps | 1 Assessment",
          description: "Master the fundamentals of strategy, planning, and understanding scope and dynamics of the Task.",
          steps: [
            {
              prompt: step1Prompt,
              response: step1Response
            },
            {
              prompt: step2Prompt,
              response: step2Response
            },
            {
              prompt: step3Prompt,
              response: step3Response
            },
            {
              prompt: step4Prompt,
              response: step4Response
            }
        ],
          solutionFlower: {
            domains: domains,
            personasPerDomain: personasPerDomain
          },
          assessment: {
            prompt: assessmentPrompt,
            response: assessmentResponse
          }
        }
      ]
    };

    console.log("Solution Pipeline:\n", JSON.stringify(this.solutionPipeline, null, 2));
    return this.solutionPipeline;
  }
  




  getSolutionPipeline() {
    return this.solutionPipeline;
  }
}
// Sample solution pipeline
const solutionPipeline = {
  "ProblemSolution": [
    {
      "systemPromptDefaultIdentity": "Dr Know",
      "userPrompt": "as solution to achieve OCEAN CLEANUP THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED",
      "details": "4 Steps | 1 Assessment",
      "description": "Master the fundamentals of strategy, planning, and understanding scope and dynamics of the Task.",
      "steps": [
        {
          "id": "step001",
          "prompt": "systemPromptDefaultIdentity"
        },
        {
          "id": "step002",
          "prompt": "userPrompt"
        },
        {
          "id": "step003",
          "prompt": "improvedUserPrompt"
        },
        {
          "id": "step004",
          "prompt": "\n      Analyse and re-word the task to reflect the true scope. Create a Task manifest, continue with giving an extensive Introduction Point by Point, conclude with the summary of the Task manifest.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    "
        },
        {
          "id": "step005",
          "prompt": "\n      Define 7 core components (domains) of the Solution Flower to achieve the Task solution based on improvedUserPrompt.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    ",
          "subSteps": [
            {
              "id": "step005-1",
              "prompt": "\n        Identify the key domains for Ocean Cleanup.\n      "
            },
            {
              "id": "step005-2",
              "prompt": "\n        Define the scope and objectives of each domain.\n      "
            },
            {
              "id": "step005-3",
              "prompt": "\n        Determine the resources required for each domain.\n      "
            },
            {
              "id": "step005-4",
              "prompt": "\n        Establish timelines and milestones for each domain.\n      "
            },
            {
              "id": "step005-5",
              "prompt": "\n        Assign responsibilities to team members for each domain.\n      "
            }
          ]
        },
        {
          "id": "step006",
          "prompt": "\n      Select a domain based on improvedUserPrompt.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    ",
          "response": "Selected Domain: Domain 1"
        },
        {
          "id": "step007",
          "prompt": "\n      Perform persona entity search based on the selected domain.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    ",
          "response": {
            "Domain 1": ["Persona A", "Persona B"]
          }
        },
        {
          "id": "step008",
          "prompt": "\n      Analyze capabilities based on improvedUserPrompt.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    "
        },
        {
         "id": "step009",
          "prompt": "\n      Declaration of SMART Goals & KPIs across 7 domains of the Task solution flower.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    ",
          "subSteps": [
            {
              "id": "step009-1",
              "prompt": "\n        Define SMART Goals for each domain.\n      "
            },
            {
              "id": "step009-2",
              "prompt": "\n        Identify Key Performance Indicators (KPIs) for each domain.\n      "
            }
          ]
        },
        {
          "id": "step010",
          "prompt": "\n      Understanding Your Target.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    ",
          "subSteps": [
            {
              "id": "step010-1",
              "prompt": "\n        Identify the target audience for the Ocean Cleanup project.\n      "
            },
            {
              "id": "step010-2",
              "prompt": "\n        Understand the needs and expectations of the target audience.\n      "
            }
          ]
        }
      ],
      "solutionFlower": {
        "domains": [],
        "personasPerDomain": {}
      },
      "assessment": {
        "id": "step011",
        "prompt": "\n      Assessment Time: Planning and resource estimation.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    ",
        "subSteps": [
          {
            "id": "step011-1",
            "prompt": "\n        Evaluate the resources required for each domain.\n      "
          },
          {
            "id": "step011-2",
            "prompt": "\n        Estimate the time and budget needed for the project.\n      "
          }
        ]
      }
    }
  ]
};

// Import the capabel function
// Function to simulate chat session


// Execute the pipeline
/*
 *
 *
            setTimeout(() => {
                resolve([`Analyse Incomming prompt: ${prompt} based on known data elect an expert persona for steps ahead also list domains the prompt can be assosiated with`,
                         `Use elected Persona for optimzing Incomming prompt: ${prompt} `,
                         `Process Optimized: ${prompt`]);
            },1100);
 *
 * */
