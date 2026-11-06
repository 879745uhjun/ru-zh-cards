const fs = require('fs');
const path = require('path');
const base = __dirname;
let html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');

// Remove the book-home redirect so the single file opens the card page.
const redirectStart = html.indexOf("<script>\ntry {");
if (redirectStart !== -1) {
  const redirectEnd = html.indexOf('</script>', redirectStart);
  if (redirectEnd !== -1) html = html.slice(0, redirectStart) + html.slice(redirectEnd + 9);
}

// Inline stylesheets.
for (const file of ['styles.css', 'global-search.css', 'sidebar.css', 'version-update.css']) {
  const start = html.indexOf('<link rel="stylesheet" href="' + file);
  if (start === -1) continue;
  const end = html.indexOf('>', start) + 1;
  html = html.slice(0, start) + '<style>\n' + fs.readFileSync(path.join(base, file), 'utf8') + '\n</style>' + html.slice(end);
}

// Remove web-app metadata, not useful inside a single file.
for (const marker of ['<link rel="icon"', '<link rel="apple-touch-icon"', '<link rel="manifest"']) {
  let at = html.indexOf(marker);
  while (at !== -1) {
    const end = html.indexOf('>', at) + 1;
    html = html.slice(0, at) + html.slice(end);
    at = html.indexOf(marker);
  }
}

// Inline scripts in document order.
const scripts = [
  'data/deck.js', 'data/lesson1.js', 'data/lesson2.js', 'data/lesson3.js', 'data/lesson5.js',
  'data/decks-source.js', 'data/sources.js', 'data/lemmas.js', 'app.js', 'global-search.js', 'sidebar.js',
  'data/versions.js', 'version-update.js'
];
for (const file of scripts) {
  const marker = '<script src="' + file;
  const start = html.indexOf(marker);
  if (start === -1) { console.log('missing', file); continue; }
  const end = html.indexOf('</script>', start) + 9;
  const content = fs.readFileSync(path.join(base, file), 'utf8');
  html = html.slice(0, start) + '<script>\n' + content + '\n</script>' + html.slice(end);
}
// Service worker is only for the hosted version.
let pwaAt = html.indexOf('<script src="pwa.js');
while (pwaAt !== -1) {
  const end = html.indexOf('</script>', pwaAt) + 9;
  html = html.slice(0, pwaAt) + html.slice(end);
  pwaAt = html.indexOf('<script src="pwa.js');
}
html = html.replace('<title>俄汉记忆卡 · Beta v1.4</title>', '<title>俄汉记忆卡 · Beta v1.4 · 单文件版</title>');
html = html.replace('<body>', '<body>\n<!-- 单文件离线版：卡片学习可用；书首页、整课、计划、来源、文本等跨页链接需要完整包。 -->');
fs.writeFileSync(path.join(base, 'single.html'), html, 'utf8');
console.log('single file', html.length);
