#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Custom Git Commit Tool');
console.log('------------------------');

rl.question('1. Enter your commit message: ', (commitMsg) => {
  if (!commitMsg.trim()) {
    console.error('❌ Commit message cannot be empty.');
    process.exit(1);
  }

  rl.question('2. Enter the Problem Statement / Ticket Issue: ', (problemStmt) => {
    if (!problemStmt.trim()) {
      console.error('❌ Problem statement cannot be empty.');
      process.exit(1);
    }

    const formattedMessage = `${commitMsg}\n\n[Problem Statement: ${problemStmt}]`;

    try {
      // Add all changes
      execSync('git add .', { stdio: 'inherit' });
      
      // Commit with the formatted message
      execSync(`git commit -m "${formattedMessage}"`, { stdio: 'inherit' });
      
      console.log('\n✅ Successfully committed!');
      
      rl.question('3. Do you want to push now? (y/n): ', (pushAns) => {
        if (pushAns.toLowerCase() === 'y' || pushAns.toLowerCase() === 'yes') {
          execSync('git push', { stdio: 'inherit' });
          console.log('✅ Successfully pushed to remote!');
        } else {
          console.log('⏭️  Skipped push. You can push manually later.');
        }
        rl.close();
      });

    } catch (error) {
      console.error('\n❌ Git command failed.');
      rl.close();
    }
  });
});
