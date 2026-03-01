const cron = require('node-cron');
const config = require('./config');
const { hasSheetUpdated, downloadImage } = require('./sheet');
const { postImage, isReady } = require('./poster');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getEasternTime() {
  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return {
    h: eastern.getHours(),
    m: eastern.getMinutes(),
    dateStr: eastern.toDateString()
  };
}

// Active check windows around each GAS run (1:05, 4:05, 7:05 ET)
// Bot starts checking 10 min before, stops 30 min after
const CHECK_WINDOWS = [
  { start: { h: 12, m: 55 }, end: { h: 13, m: 35 }, isEvening: false, label: '1pm' },
  { start: { h: 15, m: 55 }, end: { h: 16, m: 35 }, isEvening: false, label: '4pm' },
  { start: { h: 18, m: 55 }, end: { h: 19, m: 35 }, isEvening: true,  label: '7pm' },
];

function getActiveWindow() {
  const { h, m } = getEasternTime();
  const nowMins = h * 60 + m;
  for (let i = 0; i < CHECK_WINDOWS.length; i++) {
    const w = CHECK_WINDOWS[i];
    const startMins = w.start.h * 60 + w.start.m;
    const endMins = w.end.h * 60 + w.end.m;
    if (nowMins >= startMins && nowMins <= endMins) return i;
  }
  return -1;
}

// Track state to prevent double-posts
let postScheduled = false;
const postedThisWindow = {};  // e.g. { '1pm_Mon Mar 01 2026': true }

function getWindowKey(label) {
  return label + '_' + getEasternTime().dateStr;
}

async function runPost(isEvening) {
  try {
    const dailyPath = await downloadImage('daily');
    await postImage(dailyPath);
    console.log('[scheduler] Daily post sent.');

    if (isEvening) {
      // Random pause between daily and monthly (4–12 minutes)
      const pauseMin = randomBetween(4, 12);
      console.log(`[scheduler] Evening: waiting ${pauseMin} min before monthly post...`);
      await sleep(pauseMin * 60 * 1000);

      const monthlyPath = await downloadImage('monthly');
      await postImage(monthlyPath, 'Monthly update MTD');
      console.log('[scheduler] Monthly post sent.');
    }
  } catch (err) {
    console.error('[scheduler] Post error:', err.message);
  } finally {
    postScheduled = false;
  }
}

async function checkForUpdate() {
  if (!isReady()) {
    console.log('[scheduler] WhatsApp not ready, skipping check.');
    return;
  }

  if (postScheduled) {
    console.log('[scheduler] Post already scheduled, skipping check.');
    return;
  }

  const windowIdx = getActiveWindow();
  if (windowIdx === -1) return; // Outside all active windows

  const window = CHECK_WINDOWS[windowIdx];
  const windowKey = getWindowKey(window.label);

  if (postedThisWindow[windowKey]) {
    console.log(`[scheduler] Already posted for ${window.label} window today, skipping.`);
    return;
  }

  const { h, m } = getEasternTime();
  console.log(`[scheduler] [${window.label} window] Checking DSR at ${h}:${String(m).padStart(2, '0')} ET...`);

  const updated = await hasSheetUpdated();
  if (!updated) return;

  // DSR change detected — wait a human-like random delay before posting
  const delayMin = randomBetween(4, 19);
  console.log(`[scheduler] DSR update detected! Posting in ~${delayMin} minutes to appear natural.`);
  postScheduled = true;
  postedThisWindow[windowKey] = true;

  setTimeout(() => runPost(window.isEvening), delayMin * 60 * 1000);
}

function startScheduler() {
  if (config.TEST_MODE) {
    console.log('[scheduler] TEST MODE: posting every 2 minutes with no delay');
    cron.schedule('*/2 * * * *', async () => {
      if (!isReady()) return;
      const updated = await hasSheetUpdated();
      if (!updated) return;
      try {
        const dailyPath = await downloadImage('daily');
        await postImage(dailyPath);
        console.log('[scheduler] Test post complete.');
      } catch (err) {
        console.error('[scheduler] Error:', err.message);
      }
    });
    return;
  }

  // Production: check every 5 minutes with random ±90s jitter
  // so the bot never fires at exactly the same second each time
  cron.schedule('*/5 * * * *', () => {
    const jitterMs = randomBetween(0, 90) * 1000;
    setTimeout(checkForUpdate, jitterMs);
  });

  console.log('[scheduler] Production mode active.');
  console.log('[scheduler] Checking every ~5 min (with jitter) during windows:');
  console.log('[scheduler]   12:55–1:35 PM ET  |  3:55–4:35 PM ET  |  6:55–7:35 PM ET');
  console.log('[scheduler] Posts sent 4–19 min after detecting a DSR update.');
}

module.exports = { startScheduler };
