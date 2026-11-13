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

// 轮询直到条件成立，避免固定等待造成偶发失败
async function poll(fn, timeoutMs) {
  const limit = timeoutMs || 10000;
  const started = Date.now();
  let last;
  while (Date.now() - started < limit) {
    last = await fn();
    if (last) return last;
    await new Promise(r => setTimeout(r, 200));
  }
  return last;
}

const diagnostics = [];
function watch(target, label) {
  target.on('pageerror', err => diagnostics.push('[' + label + '] pageerror: ' + err.message));
  target.on('console', msg => {
    if (msg.type() === 'error') diagnostics.push('[' + label + '] console: ' + msg.text());
  });
}

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const launchOptions = { headless: true };
  if (process.env.PW_EXECUTABLE) launchOptions.executablePath = process.env.PW_EXECUTABLE;
  const browser = await chromium.launch(launchOptions);
  const results = [];
  const check = (name, ok, detail) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (!ok && detail ? ' — ' + detail : ''));

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    watch(page, 'card');
    await page.goto(base + 'index.html?deck=lesson1', { waitUntil: 'load' });
    await page.waitForSelector('.card .word', { timeout: 15000 });

    check('页面标题', (await page.title()).includes('俄汉记忆卡'));
    check('卡片已渲染', await page.locator('.card .word').count() > 0);

    if (await page.locator('#versionUpdateModal').count()) {
      check('版本弹窗出现', true);
      await page.click('#versionOk');
      check('版本弹窗可关闭', await page.locator('#versionUpdateModal').count() === 0);
    } else {
      check('版本弹窗出现', false, '首次访问未弹出版本说明');
    }

    // 课程数量从页面数据推导
    const deckInfo = await page.evaluate(() => {
      const select = document.getElementById('deckSelect');
      return { options: select ? Array.from(select.options).length : 0 };
    });
    check('课程选择器有 6 课', deckInfo.options === 6, String(deckInfo.options));

    // 第 6 课卡片
    await page.goto(base + 'index.html?deck=lesson6', { waitUntil: 'load' });
    if (await page.locator('#versionOk').count()) await page.click('#versionOk');
    await page.waitForSelector('.card .word', { timeout: 15000 });
    const lesson6 = await page.evaluate(() => ({
      total: (document.getElementById('totalNum') || {}).textContent,
      words: Array.from(document.querySelectorAll('.card .word')).map(el => el.textContent).join(' | ')
    }));
    check('第 6 课共 45 张', Number(lesson6.total) === 45, lesson6.total);
    check('第 6 课首卡重音正确', lesson6.words.includes('одноко'), lesson6.words);

    await page.goto(base + 'index.html?deck=lesson1', { waitUntil: 'load' });
    if (await page.locator('#versionOk').count()) await page.click('#versionOk');
    await page.waitForSelector('.card .word', { timeout: 15000 });

    await page.fill('#searchInput', 'длинная');
    const ruSearch = await poll(async () => {
      const words = (await page.locator('.card .word').allTextContents()).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return words.includes('длинные') ? words : null;
    }, 8000);
    check('搜索过滤（俄语词形还原）', !!ruSearch, String(ruSearch));
    check('俄语搜索高亮', await poll(async () => (await page.locator('.search-hl').count()) > 0, 5000));

    await page.fill('#searchInput', '长发');
    const zhText = await poll(async () => {
      const text = await page.locator('.zh-text').textContent();
      return text && text.includes('长发') ? text : null;
    }, 8000);
    check('中文释义搜索', !!zhText, String(zhText));
    check('中文搜索高亮', await poll(async () => (await page.locator('.zh-text .search-hl').count()) > 0, 5000));

    await page.fill('#searchInput', '');
    await poll(async () => (await page.locator('.card .word').count()) > 0, 5000);
    // 等搜索防抖（约 300ms）落地，否则翻页会被后续 refreshVisible 覆盖
    await page.waitForTimeout(800);
    await page.click('[data-mode="ru"]');
    check('俄→汉模式', await poll(async () => {
      const count = await page.locator('.zh-wrap').count();
      return count === 0 || await page.locator('.zh-wrap').first().isHidden();
    }, 5000));
    await page.click('[data-mode="both"]');
    await page.waitForTimeout(500);

    const before = Number((await page.textContent('#currentNum')).trim());
    await page.click('#nextBtn');
    const afterNext = await poll(async () => {
      const value = Number((await page.textContent('#currentNum')).trim());
      return value === before + 1 ? value : null;
    }, 6000);
    check('下一页', !!afterNext, before + ' -> ' + (await page.textContent('#currentNum')));
    const beforePrev = Number((await page.textContent('#currentNum')).trim());
    await page.click('#prevBtn');
    const afterPrev = await poll(async () => {
      const value = Number((await page.textContent('#currentNum')).trim());
      return value === beforePrev - 1 ? value : null;
    }, 6000);
    check('上一页', !!afterPrev, beforePrev + ' -> ' + (await page.textContent('#currentNum')));

    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return -1;
      const states = [];
      for (let i = 0; i < 40; i++) {
        const reg = await navigator.serviceWorker.getRegistration();
        const state = reg ? (reg.active ? 'active' : reg.installing ? 'installing' : reg.waiting ? 'waiting' : 'idle') : 'none';
        if (states[states.length - 1] !== state) states.push(state);
        if (reg && (reg.active || reg.installing || reg.waiting)) return 1;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return states.join('>');
    });
    check('Service Worker 注册', sw === 1, String(sw));

    const texts = await context.newPage();
    watch(texts, 'texts');
    await texts.goto(base + 'texts.html', { waitUntil: 'load' });
    await texts.waitForSelector('.text-item', { timeout: 15000 });
    const expectedTexts = await texts.evaluate(() => {
      const base = Array.isArray(window.RU_ZH_SOURCE_SECTIONS) ? window.RU_ZH_SOURCE_SECTIONS.length : 0;
      const extra = ((window.RU_ZH_EXTRA_TEXTS || {}).sections || []).length;
      return { total: base + extra, units: 12 };
    });
    check('文本库篇数与数据一致', await texts.locator('.text-item').count() === expectedTexts.total,
      String(await texts.locator('.text-item').count()) + ' vs ' + expectedTexts.total);
    check('文本库 12 课', await texts.locator('.text-unit').count() === expectedTexts.units,
      String(await texts.locator('.text-unit').count()));

    if (await texts.locator('#versionOk').count()) await texts.click('#versionOk');
    await texts.fill('#textSearch', 'квартира');
    check('文本库搜索（俄语）', await poll(async () => (await texts.locator('.text-result').count()) > 0, 8000));
    await texts.fill('#textSearch', '一居室');
    check('文本库搜索（中文）', await poll(async () => (await texts.locator('.text-result').count()) > 0, 8000));
    await texts.locator('.text-result-toggle').first().click();
    check('搜索结果可展开全文', await texts.locator('.text-result-body:not([hidden])').count() > 0);
    await texts.fill('#textSearch', '');
    check('清空搜索恢复列表', await poll(async () => (await texts.locator('.text-item').count()) === expectedTexts.total, 8000));

    const sourcePage = await context.newPage();
    watch(sourcePage, 'sources');
    await sourcePage.goto(base + 'sources.html', { waitUntil: 'load' });
    if (await sourcePage.locator('#versionOk').count()) await sourcePage.click('#versionOk');
    await sourcePage.fill('#sourceSearch', 'длинная');
    check('来源页词形还原', await poll(async () => (await sourcePage.locator('.source-result').count()) > 0, 8000));
    await sourcePage.fill('#sourceSearch', '长发');
    check('来源页中文搜索高亮', await poll(async () => (await sourcePage.locator('.source-result-zh .source-hl').count()) > 0, 8000));

    const single = await context.newPage();
    watch(single, 'single');
    await single.goto(base + 'single.html', { waitUntil: 'load' });
    check('单文件版可打开', await poll(async () => (await single.locator('.card .word').count()) > 0, 10000));

    const account = await context.newPage();
    watch(account, 'account');
    await account.goto(base + 'account-demo.html', { waitUntil: 'load' });
    await account.fill('#email', 'ci@example.com');
    await account.click('#submitAuth');
    check('账号测试版登录态', await account.locator('#profileView').evaluate(el => el.classList.contains('show')));

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mp = await mobile.newPage();
    watch(mp, 'mobile');
    await mp.goto(base + 'index.html?deck=lesson1', { waitUntil: 'load' });
    await mp.waitForSelector('.card .word', { timeout: 15000 });
    const overflow = await mp.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    check('390px 无横向溢出', overflow.scroll <= overflow.inner + 1, overflow.scroll + '>' + overflow.inner);
    await mobile.close();
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(results.join('\n'));
  const failed = results.filter(line => line.startsWith('FAIL'));
  if (failed.length) {
    console.log('\n--- 失败诊断 ---');
    console.log(failed.join('\n'));
    if (diagnostics.length) console.log(diagnostics.slice(0, 40).join('\n'));
    process.exit(1);
  }
})().catch(err => { console.error(err); process.exit(1); });
