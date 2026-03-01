const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { fromBuffer } = require('pdf2pic');
const config = require('./config');

let lastKnownUpdateText = null;

async function hasSheetUpdated() {
  try {
    const res = await axios.get(`${config.GAS_URL}?type=status`, { timeout: 15000 });
    const data = res.data;

    if (!data.ok) {
      console.log(`[sheets] Status check failed: ${data.reason}`);
      return false;
    }

    const currentText = data.lastUpdated;
    console.log(`[sheets] Last Updated: "${currentText}"`);

    if (lastKnownUpdateText === null) {
      lastKnownUpdateText = currentText;
      console.log('[sheets] First run, storing baseline.');
      return false;
    }

    if (currentText === lastKnownUpdateText) {
      console.log('[sheets] No change detected, skipping.');
      return false;
    }

    console.log('[sheets] Change detected, will post.');
    lastKnownUpdateText = currentText;
    return true;

  } catch (err) {
    console.error('[sheets] Error checking status:', err.message);
    return false;
  }
}

async function downloadImage(type) {
  const res = await axios.get(`${config.GAS_URL}?type=${type}`, { timeout: 30000 });
  const data = res.data;

  if (!data.ok) throw new Error(`PDF fetch failed: ${data.reason}`);

  const pdfBuffer = Buffer.from(data.pdf, 'base64');
  const outputPath = path.join(__dirname, `temp_${type}.png`);

  const converter = fromBuffer(pdfBuffer, {
    density: 200,
    saveFilename: `temp_${type}`,
    savePath: __dirname,
    format: 'png',
    width: 1400,
    height: 1800
  });

  const result = await converter(1);

  if (!result || !result.path) {
    throw new Error('PNG conversion failed');
  }

  console.log(`[sheets] Image ready: ${result.path}`);
  return result.path;
}

module.exports = { hasSheetUpdated, downloadImage };
