#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('Custom Git Commit Tool');
  console.log('------------------------');

  const commitMsg = await askQuestion('1. Enter commit message (Required): ');
  if (!commitMsg.trim()) {
    console.error('Error: Commit message is compulsory.');
    process.exit(1);
  }

  const moduleName = await askQuestion('2. Enter Module Name (Required): ');
  if (!moduleName.trim()) {
    console.error('Error: Module Name is compulsory.');
    process.exit(1);
  }

  const taskType = await askQuestion('3. Enter Task Type (e.g. Feature, Bug, Refactor) (Required): ');
  if (!taskType.trim()) {
    console.error('Error: Task Type is compulsory.');
    process.exit(1);
  }

  const hasProblem = await askQuestion('4. Do you have a Problem Statement? (y/n): ');
  let problemStmt = 'N/A';
  if (hasProblem.toLowerCase() === 'y' || hasProblem.toLowerCase() === 'yes') {
    problemStmt = await askQuestion('   Enter Problem Statement (Required): ');
    if (!problemStmt.trim()) {
      console.error('Error: Problem Statement is compulsory if you said yes.');
      process.exit(1);
    }
  } else {
    console.error('Error: Problem Statement is compulsory.');
    process.exit(1);
  }

  const ticketId = await askQuestion('5. Enter Ticket ID (Optional, press Enter to skip): ');

  const formattedMessage = `${commitMsg}

[Module: ${moduleName}]
[TaskType: ${taskType}]
[Problem Statement: ${problemStmt}]
[TicketID: ${ticketId.trim() || 'N/A'}]`;

  try {
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "${formattedMessage}"`, { stdio: 'inherit' });
    console.log('\nSuccessfully committed!');

    const pushAns = await askQuestion('6. Do you want to push now? (y/n): ');
    if (pushAns.toLowerCase() === 'y' || pushAns.toLowerCase() === 'yes') {
      execSync('git push', { stdio: 'inherit' });
      console.log('Successfully pushed to remote!');
    } else {
      console.log('Skipped push.');
    }
  } catch (error) {
    console.error('\nGit command failed.');
  } finally {
    rl.close();
  }
}

main();
