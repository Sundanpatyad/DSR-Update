#!/usr/bin/env node

const { execSync } = require("child_process");
const readline = require("readline");

const crypto = require("crypto");

const SECRET = "5bskIQHmkkip7SEh924oYmdFjeSlLta41AVgtOBodC8a5Hfgj9xIcxoHv56LTdIIlZSKJWXyIZxs1EGRXvS4OBcMwyMl6UW8H5YL3BSIpv6My8OQm2ZVE1wmZas3pkSGQkoRdDYu5QWsDmBTcDhe7F32IAtLfp3kG6vwKLWkdoSVBXzOwgEfxFXzJ9Attj5KhTK0hoxc4lZpwExPIS3WcwDeJ0eiKm5XOxCuQdaJ1IeaCUYAdR10K5TaywfmWyjA";

function generateSignature(data) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex");
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log("Custom Git Commit Tool");
  console.log("------------------------");

  const commitMsg = await askQuestion("1. Enter commit message (Required): ");
  if (!commitMsg.trim()) {
    console.error("Error: Commit message is compulsory.");
    process.exit(1);
  }

  const moduleName = await askQuestion("2. Enter Module Name (Required): ");
  if (!moduleName.trim()) {
    console.error("Error: Module Name is compulsory.");
    process.exit(1);
  }

  const taskType = await askQuestion(
    "3. Enter Task Type (Required): (F/f = Feature, B/b = Bug, R/r = Refactor)",
  );
  if (!taskType.trim()) {
    console.error("Error: Task Type is compulsory.");
    process.exit(1);
  }
  let tasktype = taskType.toLowerCase();
  tasktype = tasktype === "f" ? "feature" : tasktype === "b" ? "bug" : tasktype === "r" ? "refactor" : tasktype;
  if (!["feature", "bug", "refactor"].includes(tasktype)) {
    console.error("Error: Please enter valid input");
    process.exit(1);
  }
  
  let problemStmt = "N/A";
  if (["bug", "refactor"].includes(tasktype)) {
    problemStmt = await askQuestion(
      "4. Problem Statement (e.g., API null issue, UI padding issue, App crash on click etc.): (Required) ",
    );
    if (!problemStmt.trim()) {
      console.error(
        "Error: Problem Statement is compulsory if you select bug/refactor.",
      );
      process.exit(1);
    }
  }
  // if (hasProblem.toLowerCase() === 'y' || hasProblem.toLowerCase() === 'yes') {
  // problemStmt = await askQuestion('   Enter Problem Statement (Required): ');
  // if (!problemStmt.trim()) {
  //   console.error('Error: Problem Statement is compulsory if you said yes.');
  //   process.exit(1);
  // }
  // } else {
  //   console.error('Error: Problem Statement is compulsory.');
  //   process.exit(1);
  // }

  const ticketId = await askQuestion(
    "5. Enter Ticket ID (Optional – recommended for Bug/Refactor, press Enter to skip): ",
  );
  const dataToSign = `${commitMsg}|${moduleName}|${tasktype}|${problemStmt}|${ticketId}`;
  const signature = generateSignature(dataToSign);
  const formattedMessage = `${commitMsg}
    [Module: ${moduleName}]
    [TaskType: ${taskType}]
    [Problem Statement: ${problemStmt}]
    [TicketID: ${ticketId.trim() || "N/A"}]
    [Signature: ${signature}]`;

  console.log("\nFormatted Commit Message:\n", formattedMessage);
  try {
    execSync("git add .", { stdio: "inherit" });
    execSync(`git commit -m "${formattedMessage}"`, { stdio: "inherit" });
    console.log("\nSuccessfully committed!");

    const pushAns = await askQuestion("6. Do you want to push now? (y/n): ");
    if (pushAns.toLowerCase() === "y" || pushAns.toLowerCase() === "yes") {
      execSync("git push", { stdio: "inherit" });
      console.log("Successfully pushed to remote!");
    } else {
      console.log("Skipped push.");
    }
  } catch (error) {
    console.error("\nGit command failed.");
  } finally {
    rl.close();
  }
}

main();
