
const express = require('express');
const app = express();
const port = 3000;

// Sample solution pipeline
const solutionPipeline = {
  "ProblemSolution": [
    {
      "sytemPromptDefaultIdentity": "Dr Know",
      "userPrompt": "as solution to achieve OCEAN CLEANUP THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED",
      "details": "4 Steps | 1 Assessment",
      "description": "Master the fundamentals of strategy, planning, and understanding scope and dynamics of the Task.",
      "steps": [
        {
          "prompt": "\n      Analyse and re-word the task to reflect the true scope. Create a Task manifest, continue with giving an extensive Introduction Point by Point, conclude with the summary of the Task manifest.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    "
        },
        {
          "prompt": "\n      Analyse and re-word the task to reflect the true scope. Create a Task manifest, continue with giving an extensive Introduction Point by Point, conclude with the summary of the Task manifest.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    "
        },
        {
          "prompt": "\n      Analyse and re-word the task to reflect the true scope. Create a Task manifest, continue with giving an extensive Introduction Point by Point, conclude with the summary of the Task manifest.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    "
        },
        {
          "prompt": "\n      Analyse and re-word the task to reflect the true scope. Create a Task manifest, continue with giving an extensive Introduction Point by Point, conclude with the summary of the Task manifest.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    "
        },
        {
          "prompt": "\n      Analyse and re-word the task to reflect the true scope. Create a Task manifest, continue with giving an extensive Introduction Point by Point, conclude with the summary of the Task manifest.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    "
        },
        {
          "prompt": "\n      Define 7 core components (domains) of the Solution Flower to achieve the Task solution.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n        ",
          "response": {}
        },
        {
          "prompt": "\n      Declaration of SMART Goals & KPIs across 7 domains of the Task solution flower.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    "
        },
        {
          "prompt": "\n      Understanding Your Target.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    "
        }
      ],
      "solutionFlower": {
        "domains": {},
        "personasPerDomain": {}
      },
      "assessment": {
        "prompt": "\n      Assessment Time: Planning and resource estimation.\n      Task: As a solution to achieve OCEAN CLEANUP, THE MOST LIFE SAVING IN SHORTEST TIME COST ORRIENTED\n    "
      }
    }
  ]
};

// Function to simulate chat session
async function processSolutionPipeline() {
  const steps = solutionPipeline.ProblemSolution[0].steps;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.response) {
      // Simulate response from the AI model
      step.response = `Response to step ${i + 1}: ${step.prompt}`;
    }
    console.log(`Step ${i + 1} - Prompt: ${step.prompt}`);
    console.log(`Step ${i + 1} - Response: ${step.response}\n`);
  }

  // Process solution flower
  const domains = ["Domain 1", "Domain 2", "Domain 3", "Domain 4", "Domain 5", "Domain 6", "Domain 7"];
  const personasPerDomain = {
    "Domain 1": ["Persona A", "Persona B"],
    "Domain 2": ["Persona C", "Persona D"],
    // Add more domains and personas as needed
  };

  solutionPipeline.ProblemSolution[0].solutionFlower.domains = domains;
  solutionPipeline.ProblemSolution[0].solutionFlower.personasPerDomain = personasPerDomain;

  console.log("Solution Flower - Domains:", domains);
  console.log("Solution Flower - Personas per Domain:", personasPerDomain);

  // Process assessment
  const assessmentResponse = "Assessment Response: Detailed planning and resource estimation completed.";
  solutionPipeline.ProblemSolution[0].assessment.response = assessmentResponse;
  console.log("Assessment Response:", assessmentResponse);
}

// Route to start chat session
app.get('/start-chat', async (req, res) => {
  await processSolutionPipeline();
  res.send('Chat session processed successfully!');
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/start-chat`);
});
