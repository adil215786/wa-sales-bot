require('dotenv').config();
const { initWhatsApp } = require('./poster');
const { startScheduler } = require('./scheduler');

async function main() {
  console.log('=== WhatsApp Sales Bot Starting ===');
  await initWhatsApp();
  startScheduler();
  console.log('\n=== Bot is running. Press Ctrl+C to stop. ===\n');
}

main().catch(console.error);
