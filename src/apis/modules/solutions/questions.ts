

import { config } from "../../client";




// Simulated localStorage for backend usage
const localStorage = {
  getItem: (key) => {
    return JSON.parse(process.env[key] || 'null');
  },
  setItem: (key, value) => {
    process.env[key] = JSON.stringify(value);
  }
};

// Function to fetch available model IDs
export async function fetchModelIds(): Promise<string[]> {
  const response = await fetch('http://localhost:11434/v1/models');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data.data.map((model: { id: string }) => model.id);
}

// Function to fetch capabilities for a specific model
async function fetchModelCapabilities(modelId) {
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

// Function to gather and store pre-pipeline data
export async function capabel() {
  const modelIds = await fetchModelIds();

  let allTools = {};

  for (const model of modelIds) {
    try {
      const info = await fetchModelCapabilities(model);

      for (const tool of info.capabilities) {
        if (info.modified) {
          if (!allTools[tool]) {
            allTools[tool] = {};
          }
          allTools[tool][model] = info.model_info['general.parameter_count'];
        }
      }
    } catch (error) {
      console.error(`Error fetching capabilities for model ${model}: ${error.message}`);
    }
  }

  // Store the gathered data in localStorage
  localStorage.setItem('prePipelineData', allTools);

  return allTools;
}

// Function to check system environment for available processing power
async function probeSystemEnvironment() {
  const response = await fetch('http://localhost:11434/v1/system-info');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  localStorage.setItem('systemInfo', data);
  return data;
}

// Client class to manage the Problem Solution Process
export class ProblemSolutionClient {
  constructor(config) {
    this.config = config;
    this.solutionPipeline = null;
  }

  async executeStep(stepPrompt, stepNumber) {
    const response = await callOpenAI(stepPrompt);
    localStorage.setItem(`step-${stepNumber}-prompt`, stepPrompt);
    localStorage.setItem(`step-${stepNumber}-response`, response);
    return response;
  }

  async createSolutionPipeline() {
    // Probe system environment for available processing power
    await probeSystemEnvironment();

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
      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED
    `;
    const step2Response = await this.executeStep(step2Prompt, 2);

    // Extract domains from Step 2 response
    const domains = step2Response.split('\n').map(domain => domain.trim());

    // Query personas per domain
    const personasPerDomain = {};
    for (const [index, domain] of domains.entries()) {
      const personaPrompt = `
        For the domain "${domain}", identify a pair of the most relevant personas.
      `;
      const personaResponse = await this.executeStep(personaPrompt, 2.1 + index);
      personasPerDomain[domain] = personaResponse;
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

// Function to make OpenAI API requests
async function callOpenAI(prompt) {
  const response = await fetch("https://api.openai.com/v1/engines/davinci-codex/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      prompt,
      max_tokens: 500
    })
  });

  const data = await response.json();
  return data.choices[0].text.trim();
}

// Create an instance of the ProblemSolutionClient
const problemSolutionClient = new ProblemSolutionClient(config);

// Execute the Problem Solution Process
problemSolutionClient.createSolutionPipeline().then(() => {
  console.log("\nSolution Pipeline Creation Completed.");
});

// Get and log the solution pipeline
console.log("Current Solution Pipeline:\n", JSON.stringify(problemSolutionClient.getSolutionPipeline(), null, 2));
