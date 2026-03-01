const nodemailer = require('nodemailer');
const fs = require('fs');

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'adil215@gmail.com';
const ALERT_PHONE = process.env.ALERT_PHONE || '267-529-5899';

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendDisconnectEmail(qrImagePath) {
  try {
    const transporter = createTransporter();
    const imageBuffer = fs.readFileSync(qrImagePath);
    const timeStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: ALERT_EMAIL,
      subject: `WhatsApp DSR Automation Disconnected - Scan QR Code with phone ${ALERT_PHONE}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;">
          <h2 style="color:#d32f2f;">⚠️ WhatsApp Automation Disconnected</h2>
          <p>The WhatsApp DSR bot on the server has been disconnected and needs to be re-linked.</p>
          <p><strong>Scan the QR code below using WhatsApp on phone ${ALERT_PHONE}:</strong></p>
          <ol>
            <li>Open WhatsApp on <strong>${ALERT_PHONE}</strong></li>
            <li>Tap <strong>Settings → Linked Devices → Link a Device</strong></li>
            <li>Scan the QR code image below</li>
          </ol>
          <img src="cid:qrcode@dsrbot" style="width:280px;height:280px;border:1px solid #ccc;display:block;margin:16px 0;" alt="QR Code" />
          <p style="color:#888;font-size:12px;">Sent at ${timeStr} ET</p>
        </div>
      `,
      attachments: [{
        filename: 'qr.png',
        content: imageBuffer,
        cid: 'qrcode@dsrbot'
      }]
    });

    console.log('[notify] Disconnect email sent to ' + ALERT_EMAIL);
  } catch (err) {
    console.error('[notify] Failed to send disconnect email:', err.message);
  }
}

async function sendDSRMissingEmail() {
  try {
    const transporter = createTransporter();
    const timeStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: ALERT_EMAIL,
      subject: 'WhatsApp Automation - Not detected Update on DSR report for over 2 hours',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;">
          <h2 style="color:#f57c00;">⚠️ DSR Report Not Updating</h2>
          <p>The WhatsApp automation has <strong>not detected a DSR update</strong> on Google Sheets for over 2 hours.</p>
          <p><strong>Current time:</strong> ${timeStr} ET</p>
          <p><strong>Please check:</strong></p>
          <ul>
            <li>Google Apps Script execution log (did it run at 1:05 / 4:05 / 7:05 PM?)</li>
            <li>DSR Google Sheet — has row 2 been updated today?</li>
            <li>myrtpos.com portal availability</li>
          </ul>
          <p>No WhatsApp post has been sent for this window.</p>
        </div>
      `
    });

    console.log('[notify] DSR missing alert sent to ' + ALERT_EMAIL);
  } catch (err) {
    console.error('[notify] Failed to send DSR alert:', err.message);
  }
}

module.exports = { sendDisconnectEmail, sendDSRMissingEmail };
