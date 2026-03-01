const cron = require('node-cron');
const config = require('./config');
const { hasSheetUpdated, downloadImage } = require('./sheet');
const { postImage, isReady } = require('./poster');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function runDailyPost() {
  console.log(`\n[scheduler] Triggered at ${new Date().toLocaleTimeString()}`);
  if (!isReady()) { console.log('[scheduler] WhatsApp not ready, skipping.'); return; }
  const updated = config.TEST_MODE ? true : await hasSheetUpdated();
  if (!updated) return;
  try {
    const dailyPath = await downloadImage('daily');
    await postImage(dailyPath);
    console.log('[scheduler] Daily post complete.');
  } catch (err) {
    console.error('[scheduler] Error:', err.message);
  }
}

async function runEveningPost() {
  console.log(`\n[scheduler] Evening post triggered at ${new Date().toLocaleTimeString()}`);
  if (!isReady()) { console.log('[scheduler] WhatsApp not ready, skipping.'); return; }
  const updated = await hasSheetUpdated();
  if (!updated) return;
  try {
    const dailyPath = await downloadImage('daily');
    await postImage(dailyPath);
    console.log('[scheduler] Daily posted. Waiting before monthly...');
    const pause = randomBetween(30000, 90000);
    await sleep(pause);
    const monthlyPath = await downloadImage('monthly');
    await postImage(monthlyPath, 'Monthly update MTD');
    console.log('[scheduler] Evening run complete.');
  } catch (err) {
    console.error('[scheduler] Error:', err.message);
  }
}

function startScheduler() {
  if (config.TEST_MODE) {
    console.log('[scheduler] TEST MODE: posting every 2 minutes');
    cron.schedule('*/2 * * * *', async () => {
      await runDailyPost();
    });
    return;
  }

  cron.schedule('0 13 * * *', () => {
    setTimeout(runDailyPost, randomBetween(0, 30 * 60 * 1000));
  });
  cron.schedule('0 16 * * *', () => {
    setTimeout(runDailyPost, randomBetween(0, 30 * 60 * 1000));
  });
  cron.schedule('0 19 * * *', () => {
    setTimeout(runEveningPost, randomBetween(0, 30 * 60 * 1000));
  });

  console.log('[scheduler] Production schedule active: 1pm, 4pm, 7pm');
}

module.exports = { startScheduler };
