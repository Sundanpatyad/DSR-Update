

# Google Sheets + GitHub Webhook Integration (Simple Setup Guide)


## 1. What You Are Building

This setup will:

* Capture GitHub commits using a webhook
* Save data locally in Excel (`/backups` folder)
* Sync the same data to Google Sheets automatically


## 2. What You Need

* Google account
* Node.js backend (your webhook service)
* GitHub repository


## 3. Step-by-Step Setup


## Step 1: Create Google Cloud Project

1. Open Google Cloud Console
2. Click **Select Project → New Project**
3. Enter any name
4. Click **Create**

## Step 2: Enable Required APIs

1. Go to **APIs & Services → Library**
2. Enable:

   * Google Sheets API
   * Google Drive API


## Step 3: Create Service Account

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → Service Account**
3. Enter name (example: `sheet-sync`)
4. Click **Create → Done**


## Step 4: Generate JSON Key

1. Open the service account
2. Go to **Keys tab**
3. Click **Add Key → Create New Key → JSON**
4. Download the file

From this file, you need:

* `client_email`
* `private_key`

---

## Step 5: Create Google Sheet

1. Open Google Sheets
2. Create a new sheet
3. Copy the URL:

https://docs.google.com/spreadsheets/d/SHEET_ID/edit

Your:
GOOGLE_SHEET_ID = SHEET_ID


## Step 6: Give Permission (Most Important Step)

1. Open your Google Sheet
2. Click **Share**
3. Add this email:

your-service-account-email@project-id.iam.gserviceaccount.com

4. Give **Editor access**

Without this step, nothing will work.

## Step 7: Setup `.env` File

Create `.env` in your project:

```env
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
```

Important:

* Replace line breaks with `\n`
* Keep quotes `" "` around the key

---

## Step 8: How the System Works

1. Developer pushes code to GitHub
2. GitHub sends webhook to your backend
3. Your backend:

   * Reads commit data
   * Saves Excel file in `/backups`
   * Sends same data to Google Sheets

---

## Step 9: File Storage

### Local Excel

Folder:

```
/backups
```

File name:

```
repo-name_YYYY-MM.xlsx
```

---

### Google Sheets

Auto-created tabs like:

```
repo-name_2026-03
```

Each row contains:

* Date
* Author
* Branch
* Commit message
* Files changed

---

## Step 10: Run the Project

```bash
npm run dev
```

---

## Step 11: Test

1. Push code to GitHub
2. Check:

   * `/backups` folder updated
   * Google Sheet updated

---

## 12. Common Errors

### Permission Error

* Cause: Sheet not shared
* Fix: Share with service account

---

### Invalid Private Key

* Cause: Wrong format
* Fix:

  * Use `\n`
  * Wrap in quotes

---

### API Not Enabled

* Cause: Missing API
* Fix: Enable both APIs

---

### Webhook Not Working

* Check:

  * URL
  * Server running
  * Logs

---

## 13. Important Notes

* Google Sheet can be from ANY account
* Only requirement: share with service account
* Never upload `.env` to GitHub
* Never expose private key

---

## 14. Final Result

After setup:

* Every commit is tracked automatically
* Data is saved locally and in cloud
* No manual work required

