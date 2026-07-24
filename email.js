const nodemailer = require("nodemailer");

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function notifyNewLead(lead, cfg) {
  const to = process.env.NOTIFY_EMAIL || cfg.agentEmail;
  const subject = `New ${lead.lineType || ""} lead: ${lead.name || "(no name)"} — score ${lead.score}`;
  const lines = [
    `Name: ${lead.name || "—"}`,
    `Phone: ${lead.phone || "—"}`,
    `Email: ${lead.email || "—"}`,
    `Parish: ${lead.parish || "—"}`,
    `Line: ${lead.lineType || "—"}`,
    `Tags: ${(lead.tags || []).join(", ") || "—"}`,
    `Score: ${lead.score}`,
    `Note: ${lead.note || "—"}`,
    `Best time to reach: ${lead.bestTime || "—"}`,
  ];
  const text = lines.join("\n");

  if (!transporter) {
    console.log("--- [email disabled, SMTP not configured] New lead notification ---");
    console.log(`To: ${to}\nSubject: ${subject}\n${text}`);
    console.log("--------------------------------------------------------------------");
    return { sent: false, reason: "SMTP not configured" };
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"FALA Quote Agent" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (err) {
    console.error("Failed to send lead notification email:", err.message);
    return { sent: false, reason: err.message };
  }
}

async function pushToSheetsWebhook(lead) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
  } catch (err) {
    console.error("Failed to push lead to Sheets webhook:", err.message);
  }
}

module.exports = { notifyNewLead, pushToSheetsWebhook };
