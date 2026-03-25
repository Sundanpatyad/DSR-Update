"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const child_process_1 = require("child_process");
const util = require("util");
const execAsync = util.promisify(child_process_1.exec);
function activate(context) {
    console.log('Commit Tracker is now active!');
    // Command: Manually check commits
    const checkCommitCommand = vscode.commands.registerCommand('commit-tracker.checkCommit', async () => {
        await checkCommitsToday(context, true);
    });
    // Command: Show current streak
    const showStreakCommand = vscode.commands.registerCommand('commit-tracker.showStreak', () => {
        const streak = context.globalState.get('commitStreak') || 0;
        vscode.window.showInformationMessage(`Your current commit streak is ${streak} day(s)! 🚀`);
    });
    context.subscriptions.push(checkCommitCommand);
    context.subscriptions.push(showStreakCommand);
    // Initial check on startup (without being too annoying)
    checkCommitsToday(context, false);
    // Periodic check every 2 hours
    const intervalId = setInterval(() => checkCommitsToday(context, false), 2 * 60 * 60 * 1000);
    context.subscriptions.push({
        dispose: () => clearInterval(intervalId)
    });
}
async function checkCommitsToday(context, manualCheck) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        if (manualCheck) {
            vscode.window.showErrorMessage('No workspace folder open.');
        }
        return;
    }
    const cwd = workspaceFolders[0].uri.fsPath;
    try {
        // Run git log to see if there are commits today by the current author
        const { stdout: logOut } = await execAsync(`git log --since="midnight" --oneline`, { cwd });
        const hasCommittedToday = logOut.trim().length > 0;
        const today = new Date().toDateString();
        const lastCommitDate = context.globalState.get('lastCommitDate');
        let currentStreak = context.globalState.get('commitStreak') || 0;
        if (!hasCommittedToday) {
            // Check if streak is broken (last commit was before yesterday)
            if (lastCommitDate) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (lastCommitDate !== today && lastCommitDate !== yesterday.toDateString()) {
                    // Streak broken
                    currentStreak = 0;
                    await context.globalState.update('commitStreak', currentStreak);
                }
            }
            if (manualCheck) {
                vscode.window.showWarningMessage("You haven't committed anything today! 🚨 Commit to keep your streak.");
            }
            else {
                vscode.window.showWarningMessage("Friendly reminder: You haven't made any commits today! Don't break your streak.");
            }
        }
        else {
            // User has committed today
            if (lastCommitDate !== today) {
                // First commit of the day
                currentStreak += 1;
                await context.globalState.update('lastCommitDate', today);
                await context.globalState.update('commitStreak', currentStreak);
                vscode.window.showInformationMessage(`Awesome! First commit of the day. Streak updated to ${currentStreak} day(s)! 🔥`);
            }
            else if (manualCheck) {
                // Already counted today
                vscode.window.showInformationMessage(`You've already committed today. Current streak: ${currentStreak} day(s). Keep it up!`);
            }
        }
    }
    catch (error) {
        if (manualCheck) {
            vscode.window.showErrorMessage('Failed to run git command. Is this a git repository?');
        }
        console.error('Git commit tracker error:', error);
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map