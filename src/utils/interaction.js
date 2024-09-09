import inquirer from 'inquirer';

export function askQuestion(args) {
  let message = "Dev AI: I am ready for the next task \nYou:";
  if (args === "create app") {
    message = "Dev AI: Hello, I am your AI agent. How can I help you with development? \nYou:";
  }

  return inquirer
    .prompt([
      {
        type: "input",
        name: "user_input",
        message: message,
        prefix: "",
      },
    ])
    .then((answers) => answers.user_input.trim());
}

export function askAppDetails() {
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
