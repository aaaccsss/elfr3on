const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 دقايق

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // لدعم InfinityFree أو أي دومين خارجي
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const username = req.url.split('/api/user/')[1]?.split('/avatar')[0];
  if (!username) {
    return res.status(400).json({ success: false, error: 'Username is required' });
  }

  const cacheKey = `avatar:${username}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return res.json({ success: true, avatar: cachedData.avatar, cached: true });
  }

  try {
    const browser = await puppeteerExtra.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0');
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(Math.random() * 2000 + 1000); // تأخير عشوائي عشان TikTok

    const avatar = await page.evaluate(() => {
      return document.querySelector('img')?.src || 'https://via.placeholder.com/150?text=User';
    });

    await browser.close();
    cache.set(cacheKey, { avatar, timestamp: Date.now() });
    res.json({ success: true, avatar, cached: false });
  } catch (error) {
    await browser?.close();
    res.status(500).json({ success: false, error: error.message });
  }
};
