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
      function getText(selectors) {
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element && element.textContent) return element.textContent.trim();
          } catch (e) {
            continue;
          }
        }
        return null;
      }

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

      const displayName = getText([
        'h1[data-e2e="user-title"]',
        'h2[data-e2e="user-title"]',
        '[data-e2e="user-title"]',
        'h1',
        'h2',
        '.tiktok-1d3w5wq-H1ShareTitle'
      ]) || 'غير محدد';

      const username = getText([
        '[data-e2e="user-subtitle"]',
        '.tiktok-1w9easu-SpanUniqueId'
      ]) || window.location.pathname.replace('/@', '');

      const bio = getText([
        '[data-e2e="user-bio"]',
        '.tiktok-1w9easu-SpanText'
      ]) || 'لا يوجد وصف';

      const avatar = getImage([
        'img[data-e2e="user-avatar"]',
        '.tiktok-1zpj2q-ImgAvatar',
        'img[alt*="avatar"]',
        'span[data-e2e="user-avatar"] img',
        'img[src*="tiktokcdn"]'
      ]);

      const followers = getText([
        '[data-e2e="followers-count"]',
        'strong[data-e2e="followers-count"]'
      ]) || '0';

      const following = getText([
        '[data-e2e="following-count"]',
        'strong[data-e2e="following-count"]'
      ]) || '0';

      const likes = getText([
        '[data-e2e="likes-count"]',
        'strong[data-e2e="likes-count"]'
      ]) || '0';

      const hasValidData = displayName !== 'غير محدد' || followers !== '0' || avatar !== null;

      return {
        displayName,
        username: username.replace('@', ''),
        bio,
        avatar,
        followers,
        following,
        likes,
        scrapedAt: new Date().toISOString(),
        success: hasValidData,
        pageTitle: document.title,
        url: window.location.href
      };
    });

    console.log(`✅ تم استخراج البيانات:`, data);
    if (!data.success) throw new Error('لم يتم العثور على بيانات صالحة في الصفحة');
    return data;
  } catch (error) {
    console.error(`❌ خطأ في جلب بيانات ${username}:`, error.message);
    return {
      displayName: username.charAt(0).toUpperCase() + username.slice(1),
      username: username,
      bio: `حساب ${username} على TikTok`,
      avatar: `https://ui-avatars.com/api/?name=${username}&size=200&background=random`,
      followers: 'غير متاح',
      following: 'غير متاح',
      likes: 'غير متاح',
      scrapedAt: new Date().toISOString(),
      success: false,
      error: error.message,
      fallback: true
    };
  } finally {
    if (browser) await browser.close();
  }
}

function renderUserPage(data, cached) {
  return `
    <html>
    <head>
      <title>بيانات مستخدم TikTok</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
        img { max-width: 200px; border-radius: 50%; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>🚀 بيانات مستخدم TikTok</h1>
      <p><strong>اسم العرض:</strong> ${data.displayName}</p>
      <p><strong>اسم المستخدم:</strong> @${data.username}</p>
      <p><strong>الوصف:</strong> ${data.bio}</p>
      <p><strong>المتابعون:</strong> ${data.followers}</p>
      <p><strong>يتابع:</strong> ${data.following}</p>
      <p><strong>الإعجابات:</strong> ${data.likes}</p>
      <img src="${data.avatar}" alt="صورة الملف الشخصي">
      <p><strong>تم الجلب في:</strong> ${data.scrapedAt}</p>
      <p><strong>من الـ Cache:</strong> ${cached ? 'نعم' : 'لا'}</p>
      <a href="/">البحث عن مستخدم آخر</a>
    </body>
    </html>
  `;
}

module.exports = async (req, res) => {
  const { username } = req.params || req.query;
  if (!username || username.length < 1) {
    return res.status(400).send(`
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
          a { color: #007bff; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>❌ خطأ</h1>
        <p>اسم المستخدم مطلوب</p>
        <a href="/">العودة</a>
      </body>
      </html>
    `);
  }

  const cleanUsername = username.replace('@', '').toLowerCase();
  const cacheKey = `user_${cleanUsername}`;

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < 300000) {
      console.log(`📦 إرجاع بيانات محفوظة لـ ${cleanUsername}`);
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.send(renderUserPage(cached.data, true));
      }
      return res.json({ success: true, data: cached.data, cached: true });
    }
  }

  try {
    const userData = await getTikTokData(cleanUsername);
    cache.set(cacheKey, { data: userData, timestamp: Date.now() });
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return res.send(renderUserPage(userData, false));
    }
    res.json({ success: true, data: userData, cached: false });
  } catch (error) {
    console.error(`❌ خطأ في API لـ ${cleanUsername}:`, error.message);
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return res.status(500).send(`
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
            a { color: #007bff; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>❌ خطأ</h1>
          <p>فشل في جلب بيانات ${cleanUsername}: ${error.message}</p>
          <a href="/">العودة</a>
        </body>
        </html>
      `);
    }
    res.status(500).json({
      success: false,
      error: `فشل في جلب بيانات ${cleanUsername}: ${error.message}`,
      username: cleanUsername,
      timestamp: new Date().toISOString()
    });
  }
};