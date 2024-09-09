#!/usr/bin/env node

import { askAppDetails, askQuestion } from "./utils/interaction.js";
import inquirer from "inquirer";
import { createNextAppWithProgress } from "./utils/appCreation.js";
import { chat } from "./utils/aiHandler.js";
import { executePlan } from "./utils/planExecutor.js";
import { installModulesFromResponse } from "./utils/moduleInstaller.js";
import chalk from "chalk";
import { dependencyPrompt } from "./prompt/index.js";

const model = "llama3.1";
const messages = [
  {
    role: "system",
    content: `You are a developer agent tasked with generating code for a Next.js app or component based on user request on creating app or component or feature.
      - No special format required in output.
      - High imp rule: i am using "FILE: " so all file name shuld be in this format "FILE: [file name]" 
      - High imp rule: iam using  \`\`\` to extact code so maintain that 
      - Do not use ** any formating 
    `,
  },
];

function main(args) {
  let message = "Dev AI: I am ready for next task  \nYou:";

  if (args === "create app")
    message =
      "Dev AI: Hello i am your AI agent how can i help you with development \nYou:";

  return inquirer
    .prompt([
      {
        type: "input",
        name: "user_input",
        message: message,
        prefix: "",
      },
    ])
    .then(async (answers) => {
      try {
        // Step 1: Get user input
        const user_input = answers.user_input.trim();
        if (user_input === "") {
          console.log("Thank you. Goodbye.");
          process.exit(0);
        }

        if (user_input.toLowerCase().includes("create a")) {
          const appDetails = await askAppDetails();
          await createNextAppWithProgress(appDetails.appName);

          console.log("\nRequesting development plan from AI...\n");

          //Step 2: Ask the AI for a structured JSON plan
          messages.push({
            role: "user",
            content: `Please provide a detailed plan for creating a ${user_input}.
                      Ensure the response is in JSON format and includes components, pages, and APIs that need to be created.
                      - important: only provide plan for now no code for next response.
                      - Here is the plan structure:
                      - Create the entire outline of the project with folder stracture required components and page for the app
                      example response:

                      ##### PLAN example output:

                      \`\`\`json
                      {
                        "apis": [
                          { "name": "APIName", "description": "create the api desgin before start of the app" }
                        ],
                        "components": [
                          { "name": "ComponentName", "description": "create the component and consume the api if required for this building block" }
                        ],
                        "pages": [
                          { "name": "PageName", "description": "consume the compnent created before and build app" }
                        ],
                      }`,
          });

          let plan;

          try {
            // Push user input to the messages array

            const aiPlanResponse = await chat(messages);

            // Append the AI's plan response to the messages for context
            messages.push({
              role: "assistant",
              content: aiPlanResponse.content,
            });

            // Parse the AI's JSON response
            plan = extractJsonFromMarkdown(aiPlanResponse.content);
          } catch (error) {
            console.error("Error parsing AI response:", error);
            return;
          }

          console.log(
            "\nDevelopment Plan Received:\n",
            JSON.stringify(plan, null, 2)
          );

          // Step 3: Execute the plan based on the AI’s JSON response
          await executePlan(plan, appDetails.appName, messages);

          // Step 4: Install necessary modules based on AI response

          console.log(
            "\n Installing Modules \n",
            JSON.stringify(plan, null, 2)
          );

          // module executer
          messages.push({
            role: "user",
            content: `
            ${dependencyPrompt}`,
          });
          const aiResponse = await chat(messages);

          installModulesFromResponse(aiResponse.content);

          console.log("\nApp creation completed successfully!\n");
        }

        main(); // Rerun for next interaction
      } catch (error) {
        console.error(error);
      }
    });
}

main("create app");

async function chat2(messages) {
  const body = {
    model: model,
    messages: messages,
  };

  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to read response body");
  }
  let content = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const rawjson = new TextDecoder().decode(value);

    let json;
    try {
      const jsonObjects = rawjson.trim().split("\n");

      jsonObjects.forEach((jsonStr) => {
        try {
          json = JSON.parse(jsonStr);
        } catch (error) {
          console.error("Error parsing JSON:", error);
        }
      });
    } catch (e) {
      console.error("Error parsing JSON:", e.message);
      console.error("Raw response received:", rawjson); // Output raw response for debugging
      process.stdout.write(rawjson); // Output the raw non-JSON response directly
      //   content += json.message.content;  // Treat the raw response as plain text
      continue; // Skip the rest and proceed with the next chunk of data
    }

    if (json.done === false) {
      process.stdout.write(chalk.green(json.message.content));
      content += json.message.content;
    }
  }
  return { role: "assistant", content: content };
}

function extractJsonFromMarkdown(input) {
  // Step 1: Use a regular expression to extract the JSON content between the ```json block
  const jsonMatch = input.match(/```json([\s\S]*?)```/);

  // Step 2: Check if a match was found
  if (jsonMatch && jsonMatch[1]) {
    const jsonString = jsonMatch[1].trim(); // Clean up any extra spaces or newlines

    // Step 3: Parse the JSON content
    try {
      const parsedJson = JSON.parse(jsonString);
      return parsedJson;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return null; // Return null if parsing fails
    }
  } else {
    console.error("No JSON block found.");
    return null; // Return null if no JSON block is found
  }
}