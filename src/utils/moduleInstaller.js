import { spawn } from 'child_process';
import ora from 'ora';

// Extract modules from the AI response
export function extractModules(rawResponse) {
  // Update the regex to properly handle multi-line JSON block
  const match = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    try {
      const jsonString = match[1].trim();  // Clean up any extra spaces or newlines
      const parsedData = JSON.parse(jsonString);  // Parse the JSON string

      // Now looking for "modules" and return the formatted module list
      return parsedData.modules.map(module => `${module.name} --save`) || [];
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return [];
    }
  } else {
    console.error("No JSON block found or incorrect format");
    return [];
  }
}

// Install the modules with progress tracking
export function installModulesWithProgress(modulesList) {
  return new Promise((resolve, reject) => {
    try {
      const command = 'npm';
      const args = ['install', ...modulesList];  // Pass both module names and versions

      const spinner = ora(
        `Installing modules: ${modulesList.join(", ")}...`
      ).start();

      const process = spawn(command, args);

      // Show progress in the spinner
      process.stdout.on('data', (data) => {
        spinner.text = data.toString();
      });

      // Show any errors or warnings
      process.stderr.on('data', (data) => {
        spinner.text = data.toString();
      });

      // Close process and resolve or reject based on exit code
      process.on('close', (code) => {
        if (code === 0) {
          spinner.succeed(`Modules '${modulesList.join(", ")}' installed successfully.`);
          resolve();
        } else {
          spinner.fail(`Process exited with code ${code}`);
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    } catch (error) {
      spinner.fail(`Failed to install modules: ${error.message}`);
      reject(error);
    }
  });
}

// Main function to extract and install modules from AI's response
export function installModulesFromResponse(rawResponse) {
  const modules = extractModules(rawResponse);
  if (modules.length > 0) {
    installModulesWithProgress(modules)
      .then(() => console.log("Modules installed successfully!"))
      .catch((error) => console.error("Installation failed:", error));
  } else {
    console.error("No modules found to install.");
  }
}
