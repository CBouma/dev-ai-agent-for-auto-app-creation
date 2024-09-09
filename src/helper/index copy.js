#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import ora from "ora";
import inquirer from "inquirer";
import chalk from 'chalk'

// CONST
const model = "llama3.1";

const messages = [
  {
    role: "system",
    content: `You are a developer agent tasked with generating code for a Next.js app or component based on user request on creating app or component or feature.

    Components should be placed under the src/components folder.
    Use TypeScript (.tsx) for React components, as this is a Next.js app. Ensure each component includes "use client" where needed.
    The page files must not contain state-related logic since they are Next.js pages.
    Use Tailwind CSS for styling in all components.

    Please follow these specific guidelines to structure the app:
  
    1. File Declaration:
       - For each file, start the line with \`FILE: <file-path>\`, where \`<file-path>\` is the full relative path, including the file name and extension
       
    2. File Content:
       - After specifying the file path, include the content of that file inside triple backticks (\`\`\`) with the correct language identifier (e.g., \`typescript\`, \`python\`, \`yaml\`, \`css\`, etc.).
       - Make sure the code is valid and functional for its respective language and use case.

    3. No Extra Information:
       - Only provide the file paths and their respective content. Do not include any extra explanations, comments, or instructions.
       - your job only to write tsx code and related component for modularity under component folder make sure this component use tailwind css
       - Do not provide any summary to user at end you start development plan then code that't it
       - Do exta information as you are developer and you know only coding 

    4. You should create a plan before start providing code:
        Code Outline: Development plan 
        \`\`\`json
        {
            "title":" i will follow this steps for creating this code",
            "Steps": ["step 1: creating component required for this features", "Step 2: Page component if required for this feature"] 
        }

    4. Code Output Example: Ensure the output follows this format for any app:
        - i want entire logic end to end
        - you should be implement state logic and other intraction logic
        - Do not leave logic implementation as empty
        - High imp rule: i am using "FILE: " so all file name shuld be in this format "FILE: [file name]" 
        - High imp rule: iam using  \`\`\` to extact code so maintain that 
        

       Correct Example output: 

        FILE: src/pages/weather.tsx
        \`\`\`typescript
        import WeatherInfo from "../components/WeatherInfo";
        import WeatherForecast from "../components/WeatherForecast";
        
        export default function Weather() {
          return (
            <div className="container mx-auto p-4">
              <WeatherInfo />
              <WeatherForecast />
            </div>
          );
        }
        \`\`\`
        
        FILE: src/components/WeatherForecast.tsx
        \`\`\`typescript
        "use client";
        import axios from "axios";
        import { useState, useEffect } from "react";
        import style from "./WeatherForecast.module.css";
        
        export default function WeatherForecast() {
          const [forecastData, setForecastData] = useState(null);
          const [error, setError] = useState(null);
        
          useEffect(() => {
            // Fetching weather data here
          }, []);
        
          return (
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-bold">5-Day Forecast:</h2>
              <ul className={style.container}>{/* render forecast items here */}</ul>
            </div>
          );
        }
        \`\`\`
        
        FILE: src/components/WeatherForecast.module.css
        \`\`\`css
        .container {
          max-width: 300px;
          margin: 40px auto;
        }
        \`\`\`

        FILE: src/pages/api/data.ts
        \`\`\`typescript

        let todos: any[] = [{
          id:'123',
            text:'some data'
        }];  // In-memory storage for TODO items
        
        export default function handler(req, res) {
          const { method } = req;
        
          switch (method) {
            case 'GET':
              // Return the current list of todos
              res.status(200).json(todos);
              break;
        
            case 'POST':
              // Add a new todo item
              const newTodo = req.body;
              if (!newTodo || !newTodo.text) {
                res.status(400).json({ error: 'text is required' });
              } else {
                const todo = { id: Date.now(), ...newTodo, completed: false };
                todos.push(todo);
                res.status(201).json(todo);
              }
              break;

              default:
                res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                res.status(405).end(\`Method Not Allowed\`);
            }
          }
          

        \`\`\`

        6. New module depedecy list
          - example if axios is new depedency then list them in NEW_MODULES array like this
          example output:
          
          NEW_MODULES:
          \`\`\`json
            {list:["axios"]}
          \`\`\`

    `,
  },
];

// Function to handle user interaction
function askQuestion(args) {
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
      const user_input = answers.user_input.trim();
      if (user_input === "") {
        console.log("Thank you. Goodbye.");
        process.exit(0);
      }

      // Push user input to the messages array
      messages.push({ role: "user", content: user_input });

      let appDetails = {
        appName: "",
      };

      try {
        if (user_input.toLowerCase().includes("create a")) {
          appDetails = await askAppDetails();
          await createNextAppWithProgress(appDetails.appName); // Create app with progress tracking
        }

        const aiResponse = await chat(messages);
        // Process the AI's response and create the necessary files and directories
        await processResponse(aiResponse.content, appDetails.appName);

        // Trigger the process
        installModulesFromResponse(aiResponse.content);
      } catch (error) {
        console.log(error);
      }

      askQuestion();
    });
}

// Function to get missing app details like app name
function askAppDetails() {
  return inquirer.prompt([
    {
      type: "input",
      name: "appName",
      message: "What is the app name?",
      validate: function (input) {
        if (input.trim() === "") {
          return "App name is required!";
        }
        return true;
      },
    },
  ]);
}

// Function to simulate a chat with the AI and return a response
async function chat(messages) {
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

// Function to run the Next.js app creation command with progress tracking
function createNextAppWithProgress(appName) {
  return new Promise((resolve, reject) => {
    try {
      const command = `npx`;
      const args = [
        "create-next-app@latest",
        appName,
        "--ts",
        "--tailwind",
        "--eslint",
        "--app",
        "--src-dir",
        "--use-npm",
        "--import-alias",
        "@/*",
      ];

      const spinner = ora(`Creating Next.js app '${appName}'...`).start(); // Start the loader

      const process = spawn(command, args);

      // Capture stdout data and display it while the spinner runs
      process.stdout.on("data", (data) => {
        spinner.text = data.toString(); // Update spinner text with real-time output
      });

      // Capture stderr data and display it while the spinner runs (for errors or warnings)
      process.stderr.on("data", (data) => {
        spinner.text = data.toString(); // Show errors or warnings in the spinner
      });

      // When the process is finished
      process.on("close", (code) => {
        if (code === 0) {
          spinner.succeed(`Next.js app '${appName}' created successfully.`); // Success message
          resolve();
        } else {
          spinner.fail(`Process exited with code ${code}`); // Fail message
          reject(`Process exited with code ${code}`);
        }
      });
    } catch (error) {
      spinner.fail(`Process exited with code ${code}`); // Fail message
      reject(error);
    }
  });
}

// Function to process the AI's response and create directories and files
function processResponse(response, projectDir) {
  return new Promise((resolve, reject) => {
    try {
      console.log("creating files");
      const lines = response.split("\n");

      let currentFile = "";
      let fileContent = [];
      let insideCodeBlock = false;

      lines.forEach((line) => {
        line = line.trim();

        // Detect the start of a file path in the form of "FILE: <file-path>"
        if (line.startsWith("FILE:")) {
          // If we're processing a file, write its content to disk
          if (currentFile && fileContent.length > 0) {
            // Write file under projectDir
            if (projectDir) {
              writeFile(`${projectDir}/${currentFile}`, fileContent.join("\n"));
            } else {
              writeFile(`${currentFile}`, fileContent.join("\n"));
            }
          }

          // Set the new file path by extracting the path
          currentFile = line.split("FILE: ")[1].trim();
          fileContent = [];
          return;
        }

        // Detect the start or end of a code block using triple backticks (```), and toggle the insideCodeBlock flag
        if (line.startsWith("```")) {
          insideCodeBlock = !insideCodeBlock;
          return;
        }

        // If we're inside a code block, accumulate the lines for the current file
        if (insideCodeBlock && currentFile) {
          fileContent.push(line);
        }
      });

      // Write the last file to disk if applicable
      if (currentFile && fileContent.length > 0) {
        if (projectDir) {
          writeFile(`${projectDir}/${currentFile}`, fileContent.join("\n"));
        } else {
          writeFile(`${currentFile}`, fileContent.join("\n"));
        }
      }

      resolve();
    } catch (error) {
      console.error(`Process exited with code ${error}`); // Fail message
      reject(error);
    }
  });
}

// Helper function to write content to a file
function writeFile(filePath, content) {
  const dir = path.dirname(filePath);

  // Ensure the directory exists
  fs.mkdirSync(dir, { recursive: true });

  // Write the file content
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.error(`Error writing to file ${filePath}:`, err);
    } else {
      console.log(`File '${filePath}' created successfully.`);
    }
  });
}

function extractModules(rawResponse) {
  // Step 1: Extract the JSON content inside the backticks using a regular expression
  const match = rawResponse.match(/```json\s*({.*})\s*```/);

  // Step 2: Check if the match was successful and parse the JSON
  if (match && match[1]) {
    try {
      const jsonString = match[1];
      const parsedData = JSON.parse(jsonString);

      // Step 3: Return the 'list' of modules
      return parsedData.list || [];
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return [];
    }
  } else {
    console.error("No JSON block found or incorrect format");
    return [];
  }
}

function installModulesWithProgress(modulesList) {
  return new Promise((resolve, reject) => {
    try {
      const command = `npm`;
      const args = ["install", ...modulesList];

      const spinner = ora(
        `Installing modules: ${modulesList.join(", ")}...`
      ).start(); // Start the loader

      const process = spawn(command, args);

      // Capture stdout data and display it while the spinner runs
      process.stdout.on("data", (data) => {
        spinner.text = data.toString(); // Update spinner text with real-time output
      });

      // Capture stderr data and display it while the spinner runs (for errors or warnings)
      process.stderr.on("data", (data) => {
        spinner.text = data.toString(); // Show errors or warnings in the spinner
      });

      // When the process is finished
      process.on("close", (code) => {
        if (code === 0) {
          spinner.succeed(
            `Modules '${modulesList.join(", ")}' installed successfully.`
          ); // Success message
          resolve();
        } else {
          spinner.fail(`Process exited with code ${code}`); // Fail message
          reject(`Process exited with code ${code}`);
        }
      });
    } catch (error) {
      spinner.fail(`Error occurred: ${error.message}`); // Fail message
      reject(error);
    }
  });
}

// Main function to extract and install modules
function installModulesFromResponse(rawResponse) {
  const modules = extractModules(rawResponse);
  if (modules.length > 0) {
    installModulesWithProgress(modules)
      .then(() => console.log("Modules installed successfully!"))
      .catch((error) => console.error("Installation failed:", error));
  } else {
    console.error("No modules found to install.");
  }
}

// Start the CLI
askQuestion("create app");
