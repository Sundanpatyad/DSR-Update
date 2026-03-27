const fs = require('fs');
const ExcelJS = require('exceljs');
const path = require('path');
const logger = require('./logger');

const SHEET_NAME = 'Commits';
const seenCommits = new Set();
let isWriting = false;
const writeQueue = [];

async function processWriteQueue() {
  if (isWriting || writeQueue.length === 0) return;
  isWriting = true;

  const { rows, resolve, reject } = writeQueue.shift();

  try {
    const repoName = rows.length > 0 && rows[0].repo ? rows[0].repo : 'unknown-repo';
    const { workbook, worksheet, filePath } = await initializeExcel(repoName);
    
    const commitsMap = new Map();
    for (const row of rows) {
      if (!commitsMap.has(row.sha)) {
        commitsMap.set(row.sha, []);
      }
      commitsMap.get(row.sha).push(row);
    }

    let addedCount = 0;

    for (const [sha, fileRows] of commitsMap.entries()) {
      if (seenCommits.has(sha)) continue;

      const firstRow = fileRows[0];
      const combinedFileNames = fileRows.map(r => `[${r.changeType}] ${r.filename}`).join('\n');
      const combinedPatches = fileRows.map(r => {
        if (!r.patch) return `--- No patch data for ${r.filename} ---`;
        return `File: ${r.filename}\n------------------\n${r.patch}\n`;
      }).join('\n\n====================\n\n');

      const totalAdditions = fileRows.reduce((sum, r) => sum + (r.additions || 0), 0);
      const totalDeletions = fileRows.reduce((sum, r) => sum + (r.deletions || 0), 0);

      const commitRow = worksheet.addRow({
        repo: firstRow.repo,
        date: new Date(firstRow.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        author: firstRow.author,
        email: firstRow.email,
        branch: firstRow.branch,
        sha: firstRow.sha,
        message: firstRow.message,
        moduleName: firstRow.moduleName,
        taskType: firstRow.taskType,
        problemStatement: firstRow.problemStatement,
        ticketId: firstRow.ticketId,
        filename: combinedFileNames,
        changeType: fileRows.length > 1 ? 'Multiple' : firstRow.changeType,
        additions: totalAdditions,
        deletions: totalDeletions,
        patch: combinedPatches
      });

      commitRow.eachCell((cell) => {
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      seenCommits.add(sha);
      addedCount++;
    }

    if (addedCount > 0) {
      await workbook.xlsx.writeFile(filePath);
      logger.info(`Successfully wrote ${addedCount} new commit rows to ${path.basename(filePath)}`);
    } else {
      logger.info(`No new commit rows to add for ${path.basename(filePath)}.`);
    }
    
    resolve();
  } catch (error) {
    logger.error('Error during Excel write operation:', error);
    reject(error);
  } finally {
    isWriting = false;
    processWriteQueue();
  }
}

function getExcelFilePath(repoName) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const safeRepoName = repoName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${safeRepoName}_${year}-${month}.xlsx`;
}

async function initializeExcel(repoName) {
  const dynamicFileName = getExcelFilePath(repoName);
  const backupDir = path.resolve(process.cwd(), 'backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filePath = path.resolve(backupDir, dynamicFileName);
  const workbook = new ExcelJS.Workbook();
  let worksheet;

  if (fs.existsSync(filePath)) {
    try {
      await workbook.xlsx.readFile(filePath);
      worksheet = workbook.getWorksheet(SHEET_NAME);
      if (!worksheet) {
        worksheet = workbook.addWorksheet(SHEET_NAME);
        setupColumns(worksheet);
      } else {
        setupColumns(worksheet);
        loadExistingData(worksheet);
      }
    } catch (error) {
      logger.error('Error reading existing Excel file:', error);
      if (workbook.getWorksheet(SHEET_NAME)) {
        workbook.removeWorksheet(SHEET_NAME);
      }
      worksheet = workbook.addWorksheet(SHEET_NAME);
      setupColumns(worksheet);
    }
  } else {
    worksheet = workbook.addWorksheet(SHEET_NAME);
    setupColumns(worksheet);
  }

  return { workbook, worksheet, filePath };
}

function setupColumns(worksheet) {
  worksheet.columns = [
    { header: 'Repository', key: 'repo', width: 20 },
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Author', key: 'author', width: 15 },
    { header: 'Email', key: 'email', width: 20 },
    { header: 'Branch', key: 'branch', width: 15 },
    { header: 'Commit SHA', key: 'sha', width: 20 },
    { header: 'Commit Message', key: 'message', width: 30 },
    { header: 'Module Name', key: 'moduleName', width: 20 },
    { header: 'Task Type', key: 'taskType', width: 12 },
    { header: 'Problem Statement', key: 'problemStatement', width: 30 },
    { header: 'Ticket ID', key: 'ticketId', width: 12 },
    { header: 'File Paths', key: 'filename', width: 40, outlineLevel: 1 },
    { header: 'Change Type', key: 'changeType', width: 12, outlineLevel: 1 },
    { header: 'Total Additions', key: 'additions', width: 15, outlineLevel: 1 },
    { header: 'Total Deletions', key: 'deletions', width: 15, outlineLevel: 1 },
    { header: 'Full Code Changes (Combined Patches)', key: 'patch', width: 80, outlineLevel: 1 },
  ];
  
  worksheet.properties.outlineLevelCol = 1;

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' } 
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' }
    };
  });
}

function loadExistingData(worksheet) {
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const shaValue = row.getCell(6).value;
      if (shaValue && shaValue !== 'Commit SHA') {
         seenCommits.add(shaValue);
      }
    }
  });
}

function appendCommitData(rows) {
  if (!rows || rows.length === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    writeQueue.push({ rows, resolve, reject });
    processWriteQueue();
  });
}

module.exports = {
  appendCommitData
};
