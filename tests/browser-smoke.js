'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (err) { ({ chromium } = require('playwright-core')); }

const root = path.resolve(__dirname, '..');
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json'
};

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let rel;
      try { rel = decodeURIComponent(req.url.split('?')[0]); } catch (err) { rel = '/'; }
      if (rel === '/') rel = '/index.html';
      const file = path.resolve(root, '.' + rel);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      fs.stat(file, (err, stat) => {
        if (err || !stat.isFile()) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const launchOptions = { headless: true };
  if (process.env.PW_EXECUTABLE) launchOptions.executablePath = process.env.PW_EXECUTABLE;
  const browser = await chromium.launch(launchOptions);
  const results = [];
  const check = (name, ok) => results.push((ok ? 'PASS ' : 'FAIL ') + name);

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.goto(base + 'index.html?deck=lesson1', { waitUntil: 'load' });
    await page.waitForTimeout(400);

    check('页面标题', (await page.title()).includes('俄汉记忆卡'));
    check('卡片已渲染', await page.locator('.card .word').count() > 0);

    if (await page.locator('#versionUpdateModal').count()) {
      check('版本弹窗出现', true);
      await page.click('#versionOk');
      check('版本弹窗可关闭', await page.locator('#versionUpdateModal').count() === 0);
    } else {
      check('版本弹窗出现', false);
    }

    await page.fill('#searchInput', 'длинная');
    await page.waitForTimeout(500);
    const searchWords = (await page.locator('.card .word').allTextContents()).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    check('搜索过滤（俄语词形还原）', searchWords.includes('длинные'));
    check('俄语搜索高亮', await page.locator('.search-hl').count() > 0);

    await page.fill('#searchInput', '长发');
    await page.waitForTimeout(500);
    check('中文释义搜索', (await page.locator('.zh-text').textContent()).includes('长发'));
    check('中文搜索高亮', await page.locator('.zh-text .search-hl').count() > 0);

    await page.fill('#searchInput', '');
    await page.waitForTimeout(400);
    await page.click('[data-mode="ru"]');
    check('俄→汉模式', await page.locator('.zh-wrap').count() === 0 || await page.locator('.zh-wrap').first().isHidden());
    await page.click('[data-mode="both"]');
    await page.waitForTimeout(300);

    const before = await page.textContent('#currentNum');
    await page.click('#nextBtn');
    await page.waitForTimeout(200);
    const after = await page.textContent('#currentNum');
    check('下一页', Number(after) === Number(before) + 1);
    await page.click('#prevBtn');
    await page.waitForTimeout(200);
    check('上一页', (await page.textContent('#currentNum')) === before);

    await page.waitForTimeout(1000);
    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return -1;
      const timeout = new Promise(resolve => setTimeout(() => resolve(null), 5000));
      const reg = await Promise.race([navigator.serviceWorker.ready, timeout]);
      return reg ? 1 : 0;
    });
    check('Service Worker 注册', sw === 1);

    const texts = await context.newPage();
    await texts.goto(base + 'texts.html', { waitUntil: 'load' });
    await texts.waitForTimeout(300);
    check('文本库 15 篇', await texts.locator('.text-item').count() === 15);

    const single = await context.newPage();
    await single.goto(base + 'single.html', { waitUntil: 'load' });
    await single.waitForTimeout(300);
    check('单文件版可打开', await single.locator('.card .word').count() > 0);

    const account = await context.newPage();
    await account.goto(base + 'account-demo.html', { waitUntil: 'load' });
    await account.fill('#email', 'ci@example.com');
    await account.click('#submitAuth');
    check('账号测试版登录态', await account.locator('#profileView').evaluate(el => el.classList.contains('show')));

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mp = await mobile.newPage();
    await mp.goto(base + 'index.html?deck=lesson1', { waitUntil: 'load' });
    await mp.waitForTimeout(300);
    const overflow = await mp.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    check('390px 无横向溢出', overflow.scroll <= overflow.inner + 1);
    await mobile.close();
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(results.join('\n'));
  if (results.some(line => line.startsWith('FAIL'))) process.exit(1);
})().catch(err => { console.error(err); process.exit(1); });
