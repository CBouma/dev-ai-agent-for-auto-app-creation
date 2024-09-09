import axios from 'axios';
import chalk from 'chalk';
import { TextDecoder } from 'util';

const model = "llama3.1";

function chat(messages) {
  const body = {
    model: model,
    messages: messages,
  };

  return axios({
    method: 'post',
    url: 'http://localhost:11434/api/chat',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    responseType: 'stream', // Set response type to stream
  })
    .then(response => {
      const decoder = new TextDecoder();
      let content = '';

      // Handle the streaming response by reading chunks of data
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const rawjson = decoder.decode(chunk, { stream: true }); // Decode chunk as text
          let json;

          try {
            const jsonObjects = rawjson.trim().split("\n");
            jsonObjects.forEach((jsonStr) => {
              try {
                json = JSON.parse(jsonStr);
                if (json.done === false) {
                  process.stdout.write(chalk.green(json.message.content));
                  content += json.message.content;
                }
              } catch (error) {
                console.error('Error parsing JSON:', error);
              }
            });
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        });

        response.data.on('end', () => {
          resolve({ role: 'assistant', content });
        });

        response.data.on('error', (error) => {
          console.error('Error in stream:', error);
          reject(error);
        });
      });
    })
    .catch(error => {
      console.error("Error from llama", error);
      throw error; // Pass the error up the chain
    });
}

export { chat };
