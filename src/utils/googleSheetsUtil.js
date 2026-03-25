const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const logger = require('./logger');

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

const serviceAccountAuth = new JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function appendToGoogleSheet(rows) {
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    logger.warn('Google Sheets configuration is incomplete. Skipping cloud sync.');
    return;
  }

  try {
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    // Group rows by repository name since the user wants repo-based tracking
    const repoName = rows.length > 0 && rows[0].repo ? rows[0].repo : 'unknown-repo';
    const date = new Date();
    const sheetTitle = `${repoName.substring(0, 50)}_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    let sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: sheetTitle,
        headerValues: [
          'Repository', 'Date', 'Author', 'Email', 'Branch', 'Commit SHA', 
          'Commit Message', 'Module Name', 'Task Type', 'Problem Statement', 
          'Ticket ID', 'File Paths', 'Change Type', 'Total Additions', 
          'Total Deletions', 'Full Code Changes'
        ],
      });
      logger.info(`Created new Google Sheet: ${sheetTitle}`);
    }

    const formattedRows = rows.map(r => ({
      'Repository': r.repo,
      'Date': new Date(r.date).toLocaleString(),
      'Author': r.author,
      'Email': r.email,
      'Branch': r.branch,
      'Commit SHA': r.sha,
      'Commit Message': r.message,
      'Module Name': r.moduleName,
      'Task Type': r.taskType,
      'Problem Statement': r.problemStatement,
      'Ticket ID': r.ticketId,
      'File Paths': r.filename,
      'Change Type': r.changeType,
      'Total Additions': r.additions,
      'Total Deletions': r.deletions,
      'Full Code Changes': r.patch
    }));

    await sheet.addRows(formattedRows);
    logger.info(`Successfully added ${formattedRows.length} rows to Google Sheet: ${sheetTitle}`);

  } catch (error) {
    logger.error('Error writing to Google Sheets:', error);
  }
}

module.exports = {
  appendToGoogleSheet
};
