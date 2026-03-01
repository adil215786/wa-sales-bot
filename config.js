require('dotenv').config();

module.exports = {
  GAS_URL: process.env.GAS_URL,
  GROUP_CHAT_ID: process.env.GROUP_CHAT_ID,
  TEST_MODE: false,
  CAPTIONS: [
    'Updates so far',
    'Update as of today',
    "Here's where we're at",
    'Numbers for today',
    'Current status',
    'Today\'s update',
    'Here\'s the latest',
    'Progress update for the team',
    'Sharing today\'s numbers',
    'Update for everyone'
  ]
};
