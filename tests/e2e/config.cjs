/**
 * Shared settings for the browser suites. Override with environment variables:
 *   CHROME_PATH   path to a local Chrome/Chromium/Edge executable
 *   E2E_PROD_URL  production preview URL (default http://localhost:4173/)
 *   E2E_DEV_URL   Vite dev server URL   (default http://localhost:5174/)
 */
const fs = require('fs');
const path = require('path');

const CANDIDATES = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
};

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = (CANDIDATES[process.platform] || []).find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error('No Chrome/Chromium/Edge found. Set CHROME_PATH to a browser executable.');
  }
  return found;
}

const SHOTS = path.join(__dirname, '.shots');
fs.mkdirSync(SHOTS, { recursive: true });

module.exports = {
  chromePath,
  PROD_URL: process.env.E2E_PROD_URL || 'http://localhost:4173/',
  DEV_URL: process.env.E2E_DEV_URL || 'http://localhost:5174/',
  SHOTS,
};
