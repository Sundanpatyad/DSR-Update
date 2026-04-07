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

// async function appendToGoogleSheet(rows) {
//   if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
//     logger.warn('Google Sheets configuration is incomplete. Skipping cloud sync.');
//     return;
//   }

//   try {
//     const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
//     await doc.loadInfo();

//     // Group rows by repository name since the user wants repo-based tracking
//     const repoName = rows.length > 0 && rows[0].repo ? rows[0].repo : 'unknown-repo';
//     const date = new Date();
//     const sheetTitle = `${repoName.substring(0, 50)}_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

//     let sheet = doc.sheetsByTitle[sheetTitle];
//     let isNewSheet = false;

//     if (!sheet) {
//       sheet = await doc.addSheet({
//         title: sheetTitle,
//         headerValues: [
//           'Repository', 'Date', 'Author', 'Email','Commit Time', 'Branch', 'Commit SHA', 'Commit Link',
//           'Commit Message', 'Module Name', 'Task Type', 'Problem Statement', 
//           'Ticket ID', 'File Paths', 'Change Type', 'Total Additions', 
//           'Total Deletions'
//         ],
//       });
//       isNewSheet = true;
//       logger.info(`Created new Google Sheet: ${sheetTitle}`);
//     }
//     const fullDate = new Date(r.date);
//     const dateOnly = fullDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
//     const timeOnly = fullDate.toLocaleTimeString('en-IN', { 
//       timeZone: 'Asia/Kolkata', 
//       hour: '2-digit', 
//       minute: '2-digit', 
//       second: '2-digit', 
//       hour12: true 
//     });

//     const formattedRows = rows.map(r => ({
//       'Repository': r.repo,
//       'Date': dateOnly,
//       'Author': r.author,
//       'Email': r.email,
//       'Commit Time': timeOnly,
//       'Branch': r.branch,
//       'Commit SHA': r.sha,
//       'Commit Link': r.commitUrl,
//       'Commit Message': r.message,
//       'Module Name': r.moduleName,
//       'Task Type': r.taskType,
//       'Problem Statement': r.problemStatement,
//       'Ticket ID': r.ticketId,
//       'File Paths': r.filename,
//       'Change Type': r.changeType,
//       'Total Additions': r.additions,
//       'Total Deletions': r.deletions
//     }));

//     await sheet.addRows(formattedRows);
//     logger.info(`Successfully added ${formattedRows.length} rows to Google Sheet: ${sheetTitle}`);

//     // If it's a new sheet, apply formatting and grouping (collapsible columns)
//     if (isNewSheet) {
//       try {
//         await doc.loadInfo(); // Ensure we have the latest sheet ID
//         const sheetId = sheet.sheetId;

//         const requests = [
//           // 1. Group columns M to P (indices 12 to 15) to make them collapsible
//           {
//             addDimensionGroup: {
//               dimensionRange: {
//                 sheetId: sheetId,
//                 dimension: 'COLUMNS',
//                 startIndex: 12, // Column M (File Paths)
//                 endIndex: 16    // Column P (Total Deletions) + 1
//               }
//             }
//           },
//           // 2. Format the Header Row (Blue background, White bold text)
//           {
//             repeatCell: {
//               range: {
//                 sheetId: sheetId,
//                 startRowIndex: 0,
//                 endRowIndex: 1
//               },
//               cell: {
//                 userEnteredFormat: {
//                   backgroundColor: { red: 0.1, green: 0.46, blue: 0.82 }, // #1976D2
//                   textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
//                   horizontalAlignment: 'CENTER',
//                   verticalAlignment: 'MIDDLE'
//                 }
//               },
//               fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
//             }
//           },
//           // 3. Format all cells to top-align and wrap text
//           {
//             repeatCell: {
//               range: {
//                 sheetId: sheetId,
//                 startRowIndex: 1
//               },
//               cell: {
//                 userEnteredFormat: {
//                   wrapStrategy: 'WRAP',
//                   verticalAlignment: 'TOP'
//                 }
//               },
//               fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
//             }
//           }
//         ];

//         // @ts-ignore - The internal axios client used by google-spreadsheet
//         await doc.axios.post(`:batchUpdate`, { requests });
//         logger.info(`Successfully applied styling and collapsible columns to ${sheetTitle}`);

//       } catch (formatError) {
//         logger.error('Failed to apply Google Sheets formatting:', formatError);
//       }
//     }

//   } catch (error) {
//     logger.error('Error writing to Google Sheets:', error);
//   }
// }

async function appendToGoogleSheet(rows) {
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    logger.warn('Google Sheets configuration is incomplete. Skipping cloud sync.');
    return;
  }

  if (!rows?.length) return;

  try {
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    /** -------------------------
     * Sheet Name
     --------------------------*/
    const repoName = rows[0]?.repo || 'unknown-repo';
    const date = new Date();
    const sheetTitle = `${repoName.substring(0, 50)}_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    let sheet = doc.sheetsByTitle[sheetTitle];
    let isNewSheet = false;

    if (!sheet) {
      sheet = await doc.addSheet({
        title: sheetTitle,
        headerValues: [
          'Repository', 'Date', 'Author', 'Email','Commit Time', 'Branch',
          'Commit SHA', 'Commit Link','Commit Message', 'Module Name',
          'Task Type', 'Problem Statement','Ticket ID', 'File Paths',
          'Change Type', 'Total Additions','Total Deletions'
        ],
      });
      isNewSheet = true;
      logger.info(`Created new Google Sheet: ${sheetTitle}`);
    }

    /** -------------------------
     * Format rows (FIXED)
     --------------------------*/
    const formattedRows = rows.map(r => {
      const fullDate = new Date(r.date);

      return {
        'Repository': r.repo,
        'Date': fullDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        'Author': r.author,
        'Email': r.email,
        'Commit Time': fullDate.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }),
        'Branch': r.branch,
        'Commit SHA': r.sha,
        'Commit Link': r.commitUrl,
        'Commit Message': r.message,
        'Module Name': r.moduleName,
        'Task Type': r.taskType,
        'Problem Statement': r.problemStatement,
        'Ticket ID': r.ticketId,
        'File Paths': r.filename,
        'Change Type': r.changeType,
        'Total Additions': r.additions,
        'Total Deletions': r.deletions
      };
    });

    /** -------------------------
     * Batch insert (IMPORTANT)
     --------------------------*/
    const chunkSize = 500;

    for (let i = 0; i < formattedRows.length; i += chunkSize) {
      const chunk = formattedRows.slice(i, i + chunkSize);
      await sheet.addRows(chunk);
    }

    logger.info(`Added ${formattedRows.length} rows to ${sheetTitle}`);

    /** -------------------------
     * Formatting (ONLY ONCE)
     --------------------------*/
    if (isNewSheet) {
      try {
        const sheetId = sheet.sheetId;

        const requests = [
          {
            addDimensionGroup: {
              dimensionRange: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 12,
                endIndex: 16
              }
            }
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.1, green: 0.46, blue: 0.82 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true
                  },
                  horizontalAlignment: 'CENTER'
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
            }
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  wrapStrategy: 'WRAP',
                  verticalAlignment: 'TOP'
                }
              },
              fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
            }
          }
        ];

        await doc.axios.post(':batchUpdate', { requests });

      } catch (err) {
        logger.error('Formatting failed:', err);
      }
    }

  } catch (error) {
    logger.error('Error writing to Google Sheets:', error);
  }
}

module.exports = {
  appendToGoogleSheet
};
