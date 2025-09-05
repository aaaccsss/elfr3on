const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteerExtra.use(StealthPlugin());

const cache = new Map();

async function getTikTokData(username) {
  let browser;
  try {
    console.log(`🔍 البحث عن: ${username}`);
    browser = await puppeteerExtra.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      timeout: 60000
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    console.log(`📡 الاتصال بـ TikTok...`);
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    console.log(`⏳ انتظار تحميل المحتوى...`);
    let attempts = 0;
    let dataFound = false;
    while (attempts < 5 && !dataFound) {
      try {
        await page.waitForSelector('h1, h2, [data-e2e="user-title"]', { timeout: 8000 });
        dataFound = true;
      } catch (e) {
        attempts++;
        console.log(`محاولة ${attempts}/5...`);
        await page.waitForTimeout(2000);
      }
    }

    console.log(`📊 استخراج البيانات...`);
    const data = await page.evaluate(() => {
      function getImage(selectors) {
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element && element.src) return element.src;
          } catch (e) {
            continue;
          }
        }
        return null;
      }

      const avatar = getImage([
        'img[data-e2e="user-avatar"]',
        '.tiktok-1zpj2q-ImgAvatar',
        'img[alt*="avatar"]',
        'span[data-e2e="user-avatar"] img',
        'img[src*="tiktokcdn"]'
      ]);

      return { avatar, success: !!avatar };
    });

    console.log(`✅ تم استخراج الصورة:`, data);
    if (!data.success) throw new Error('لم يتم العثور على صورة المستخدم');
    return data;
  } catch (error) {
    console.error(`❌ خطأ في جلب صورة ${username}:`, error.message);
    return {
      avatar: `https://ui-avatars.com/api/?name=${username}&size=200&background=random`,
      success: false,
      error: error.message
    };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = async (req, res) => {
  const { username } = req.params || req.query;
  if (!username || username.length < 1) {
    return res.status(400).json({ success: false, error: 'اسم المستخدم مطلوب' });
  }

  const cleanUsername = username.replace('@', '').toLowerCase();
  const cacheKey = `user_${cleanUsername}`;

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < 300000) {
      return res.json({ success: true, avatar: cached.data.avatar, cached: true });
    }
  }

  try {
    const userData = await getTikTokData(cleanUsername);
    cache.set(cacheKey, { data: userData, timestamp: Date.now() });
    res.json({ success: true, avatar: userData.avatar, cached: false });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `فشل في جلب صورة ${cleanUsername}: ${error.message}`
    });
  }
};