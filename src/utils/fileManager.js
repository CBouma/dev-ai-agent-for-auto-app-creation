import fs from 'fs';
import path from 'path';

export function processResponse(response, projectDir) {
  return new Promise((resolve, reject) => {
    try {
      console.log("Creating files...");
      const lines = response.split("\n");

      let currentFile = "";
      let fileContent = [];
      let insideCodeBlock = false;

      lines.forEach((line) => {
        line = line.replace(/\*/g, '').trim();

        if (line.startsWith("FILE:")) {
          if (currentFile && fileContent.length > 0) {
            writeFile(`${projectDir}/${currentFile}`, fileContent.join("\n"));
          }
          currentFile = line.split("FILE: ")[1].trim();
          fileContent = [];
          return;
        }

        if (line.startsWith("```")) {
          insideCodeBlock = !insideCodeBlock;
          return;
        }

        if (insideCodeBlock && currentFile) {
          fileContent.push(line);
        }
      });

      if (currentFile && fileContent.length > 0) {
        writeFile(`${projectDir}/${currentFile}`, fileContent.join("\n"));
        console.log("file created")
      }

      console.log("file created")

      resolve();
    } catch (error) {
      console.log("error creating file")
      reject(error);
    }
  });
}

function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.error(`Error writing to file ${filePath}:`, err);
    } else {
      console.log(`File '${filePath}' created successfully.`);
    }
  });
}
