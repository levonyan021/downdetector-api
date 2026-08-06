const fs = require('fs');
const puppeteer = require('puppeteer-core');

/**
 * Locate a Chrome/Chromium executable installed on the system.
 * puppeteer-core does not download its own browser, so we point it at an
 * existing Chrome install. An explicit path can be forced with the
 * PUPPETEER_EXECUTABLE_PATH or CHROME_PATH environment variables.
 * @return {string} Path to the browser executable
 */
function findChrome() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (fromEnv) {
    return fromEnv;
  }
  const candidatesByPlatform = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
    ],
  };
  const candidates = candidatesByPlatform[process.platform] || [];
  const found = candidates.find((path) => fs.existsSync(path));
  if (!found) {
    // eslint-disable-next-line max-len
    throw Error('No Chrome/Chromium executable found. Install Chrome or set the PUPPETEER_EXECUTABLE_PATH environment variable.');
  }
  return found;
}

/**
 * Open a Downdetector URL in a headless browser and return the page HTML.
 * A real browser is used because the site is protected by Cloudflare.
 * @param {string} url The URL to fetch
 * @return {Promise<string>} The page content
 */
async function getPageContent(url) {
  const options = {
    executablePath: findChrome(),
    headless: true,
    args: process.env.NODE_ENV === 'test' ? ['--no-sandbox'] : [],
  };
  const browser = await puppeteer.launch(options);
  try {
    const page = await browser.newPage();
    // eslint-disable-next-line max-len
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const content = await page.content();
    return content;
  } finally {
    await browser.close();
  }
}

/**
 * Call Downdetector website and get the status page content for a company
 * @param {string} company Company to get the data for
 * @param {string} domain Domain suffix of downdetector website (eg: com)
 * @return {Promise<string>} The page content
 */
function callDowndetector(company, domain) {
  return getPageContent(`https://downdetector.${domain}/status/${company}/`);
}

/**
 * Extract the chart data points from the Downdetector page content.
 * Since 2025 the site is a Next.js app and embeds the chart series as RSC
 * flight data, where each point carries both reports and baseline values:
 *   {"timestampUtc":"2026-...","reportsValue":25,"baselineValue":19}
 * The regex tolerates the escaped quotes used inside the flight payload.
 * @param {string} data Page content
 * @return {Object} Object with reports and baseline properties
 */
function getChartPointsObject(data) {
  // eslint-disable-next-line max-len
  const re = /timestampUtc[\\":]*([0-9T:+-]+)[\\",]*reportsValue[\\":]*(-?\d+)[\\",]*baselineValue[\\":]*(-?\d+)/g;
  const reports = [];
  const baseline = [];
  let match;
  while ((match = re.exec(data)) !== null) {
    reports.push({ date: match[1], value: +match[2] });
    baseline.push({ date: match[1], value: +match[3] });
  }
  return { reports, baseline };
}

/**
 * Get data from Downdetector
 * @param {string} company Company name in Downdetector (see URL)
 * @param {string} [domain] Downdetector domain to use (default is 'com')
 * @return {Promise<Object>} Object with reports and baseline properties
 */
async function downdetector(company, domain = 'com') {
  try {
    if (!company || (typeof company) !== 'string') {
      throw Error('Invalid input');
    }
    const data = await callDowndetector(company, domain);
    const { reports, baseline } = getChartPointsObject(data);
    return { reports, baseline };
  } catch (err) {
    console.error(err.message);
  }
}

/**
 * Get the list of all company slugs available on a Downdetector domain.
 * Slugs are the identifiers used by downdetector() and in the /status/ URLs.
 * @param {string} [domain] Downdetector domain to use (default is 'com')
 * @return {Promise<Array<string>>} Sorted array of unique company slugs
 */
async function getCompanies(domain = 'com') {
  try {
    const data = await getPageContent(`https://downdetector.${domain}/companies/`);
    const re = /\/status\/([^/"'\\]+)/g;
    const slugs = new Set();
    let match;
    while ((match = re.exec(data)) !== null) {
      slugs.add(match[1]);
    }
    return [...slugs].sort();
  } catch (err) {
    console.error(err.message);
  }
}

exports.downdetector = downdetector;
exports.getCompanies = getCompanies;
