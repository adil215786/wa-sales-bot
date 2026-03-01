const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const config = require('./config');
const { sendDisconnectEmail } = require('./notify');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'sales-bot' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

let isReady = false;
let wasEverReady = false; // tracks if we were previously connected (vs first-time setup)
let lastCaptionIndex = -1;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCaption() {
  const captions = config.CAPTIONS;
  let idx;
  do { idx = Math.floor(Math.random() * captions.length); }
  while (idx === lastCaptionIndex);
  lastCaptionIndex = idx;
  return captions[idx];
}

async function simulateTyping(chat, text) {
  await sleep(randomBetween(1000, 3000));
  await chat.sendStateTyping();
  const typingMs = text.length * randomBetween(180, 300);
  if (text.length > 15 && Math.random() > 0.4) {
    await sleep(typingMs * 0.5);
    await chat.clearState();
    await sleep(randomBetween(600, 1800));
    await chat.sendStateTyping();
    await sleep(typingMs * 0.5);
  } else {
    await sleep(typingMs);
  }
  await chat.clearState();
}

async function postImage(imagePath, captionOverride = null) {
  if (!isReady) throw new Error('WhatsApp client not ready yet');
  const chat = await client.getChatById(config.GROUP_CHAT_ID);
  const caption = captionOverride || getCaption();
  await simulateTyping(chat, caption);
  const media = MessageMedia.fromFilePath(imagePath);
  await client.sendMessage(config.GROUP_CHAT_ID, media, { caption });
  console.log(`[poster] Sent: "${caption}"`);
}

function initWhatsApp() {
  return new Promise((resolve) => {
    client.on('qr', qr => {
      console.log('\n[whatsapp] Scan this QR code with your phone:\n');
      qrcode.generate(qr, { small: true });

      const qrImagePath = path.join(__dirname, 'qr.png');
      QRCode.toFile(qrImagePath, qr, { width: 400 }, async (err) => {
        if (err) return;
        console.log(`\n[whatsapp] QR code saved: ${qrImagePath}\n`);

        // Only email the QR if this is a re-auth (was previously connected)
        // so we don't spam on first-time setup
        if (wasEverReady && process.env.SMTP_USER && process.env.SMTP_PASS) {
          console.log('[whatsapp] Previously connected — sending disconnect email...');
          await sendDisconnectEmail(qrImagePath);
        }
      });
    });

    client.on('ready', () => {
      console.log('[whatsapp] Client is ready!');
      isReady = true;
      wasEverReady = true;

      client.getChats().then(chats => {
        const groups = chats.filter(c => c.isGroup);
        console.log('\n[whatsapp] YOUR GROUP CHATS:');
        groups.forEach(g => console.log(`  "${g.name}" => ${g.id._serialized}`));
        console.log('\nCopy your target group ID into .env as GROUP_CHAT_ID\n');
      });

      resolve();
    });

    client.on('disconnected', reason => {
      console.log('[whatsapp] Disconnected:', reason);
      isReady = false;
    });

    client.initialize();
  });
}

module.exports = { initWhatsApp, postImage, isReady: () => isReady };
