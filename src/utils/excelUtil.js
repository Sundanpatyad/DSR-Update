const fs = require('fs');
const ExcelJS = require('exceljs');
const path = require('path');
const logger = require('./logger');

const EXCEL_FILE_PATH = process.env.EXCEL_FILE_PATH || 'commits.xlsx';
const SHEET_NAME = 'Commits';

const seenCommitsFiles = new Set();

let isWriting = false;
const writeQueue = [];

async function processWriteQueue() {
  if (isWriting || writeQueue.length === 0) return;
  isWriting = true;

  const { rows, resolve, reject } = writeQueue.shift();

  try {
    const repoName = rows.length > 0 && rows[0].repo ? rows[0].repo : 'unknown-repo';
    const developerEmail = rows.length > 0 && rows[0].email ? rows[0].email : 'unknown-developer';
    
    const { workbook, worksheet, filePath } = await initializeExcel(repoName, developerEmail);
    let addedCount = 0;

    for (const rowData of rows) {
      const uniqueKey = `${rowData.sha}-${rowData.filename}-${rowData.changeType}`;
      
      if (!seenCommitsFiles.has(uniqueKey)) {
        if (rowData.date) {
          rowData.date = new Date(rowData.date).toLocaleString();
        }

        worksheet.addRow({
          repo: rowData.repo || 'Unknown',
          date: rowData.date || 'N/A',
          author: rowData.author || 'Unknown',
          email: rowData.email || 'N/A',
          branch: rowData.branch || 'Unknown',
          sha: rowData.sha || 'N/A',
          message: rowData.message || '',
          filename: rowData.filename || 'Unknown',
          changeType: rowData.changeType || 'Unknown',
          additions: rowData.additions !== undefined ? rowData.additions : '',
          deletions: rowData.deletions !== undefined ? rowData.deletions : '',
          patch: rowData.patch || '',
        });
        
        seenCommitsFiles.add(uniqueKey);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      await workbook.xlsx.writeFile(filePath);
      logger.info(`Successfully wrote ${addedCount} new rows to ${path.basename(filePath)}`);
    } else {
      logger.info(`No new rows to add (all were duplicates) for ${path.basename(filePath)}.`);
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

function getExcelFilePath(repoName, developerEmail) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const safeRepoName = repoName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const safeEmail = developerEmail.replace(/[^a-zA-Z0-9-_@.]/g, '_');
  
  return `${safeEmail}_${safeRepoName}_${year}-${month}.xlsx`;
}

async function initializeExcel(repoName, developerEmail) {
  const dynamicFileName = getExcelFilePath(repoName, developerEmail);
  const filePath = path.resolve(process.cwd(), dynamicFileName);
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
    { header: 'Repository', key: 'repo', width: 25 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Author', key: 'author', width: 20 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Branch', key: 'branch', width: 20 },
    { header: 'Commit SHA', key: 'sha', width: 45 },
    { header: 'Commit Message', key: 'message', width: 40 },
    { header: 'File Name', key: 'filename', width: 35 },
    { header: 'Change Type', key: 'changeType', width: 15 },
    { header: 'Additions', key: 'additions', width: 10 },
    { header: 'Deletions', key: 'deletions', width: 10 },
    { header: 'Code Changes (Patch)', key: 'patch', width: 80 },
  ];
  
  worksheet.getRow(1).font = { bold: true };
}

function loadExistingData(worksheet) {
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const sha = row.getCell(6).value || '';
      const filename = row.getCell(8).value || '';
      const changeType = row.getCell(9).value || '';
      if (sha && filename) {
        seenCommitsFiles.add(`${sha}-${filename}-${changeType}`);
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
