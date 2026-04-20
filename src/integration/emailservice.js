const Toolurl = process.env.GIT_TOOL_URL || "N/A";
const SMTP2GO_USER = process.env.SMTP2GO_USER || "your_smtp2go_username";
const SMTP2GO_PASS = process.env.SMTP2GO_PASS || "your_smtp2go_api_key";

const nodemailer = require("nodemailer");

export async function sendUnauthorizedEmail(toEmail, commitMsg) {
  await transporter.sendMail({
    from: `"DSR System" <${process.env.GIT_EMAIL_USER}>`,
    to: toEmail,
    subject: "❌ Unauthorized Commit Detected",

    html: `
      <div style="font-family: Arial; line-height: 1.6;">
        <h2 style="color: red;">Unauthorized Commit</h2>

        <p>Your recent commit was <b>not authorized</b> and will not be counted in DSR.</p>

        <hr/>

        <p><b>Commit Message:</b></p>
        <pre>${commitMsg}</pre>

        <p><b>Reason:</b></p>
        <ul>
          <li>Missing or invalid signature</li>
          <li>Git-commit tool was not used</li>
        </ul>

        <p><b>What to do:</b></p>
        <ol>
          <li>Re-commit using the git-commit tool</li>
          <li>Push again</li>
        </ol>
        <p>Download the git-commit tool: <a href="${Toolurl}">${Toolurl}</a></p>

        <hr/>

        <p style="color: gray;">
          This is an automated message from DSR system.
        </p>
      </div>
    `,
  });
}
const transporter = nodemailer.createTransport({
  host: "mail.smtp2go.com",
  port: 587,
  auth: {
    user: SMTP2GO_USER || "your_smtp2go_username",
    pass: SMTP2GO_PASS || "your_smtp2go_api_key",
  },
});
