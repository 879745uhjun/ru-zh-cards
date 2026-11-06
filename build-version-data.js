const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'changelog.html'), 'utf8');
const blocks = [...html.matchAll(/<section class="log-entry">([\s\S]*?)<\/section>/g)].map(m => m[1]);
const versions = [];
for (const block of blocks) {
  const label = block.match(/<span class="log-version">([^<]+)<\/span>/);
  const date = block.match(/<span class="log-date">([^<]+)<\/span>/);
  if (!label || !/^Beta\s+v/i.test(label[1])) continue;
  const versionMatch = label[1].match(/v([\d.]+)/i);
  if (!versionMatch) continue;
  const list = block.match(/<ul>([\s\S]*?)<\/ul>/);
  const items = list ? [...list[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(item =>
    item[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
  ) : [];
  versions.push({
    version: versionMatch[1],
    label: label[1].replace(/\s+/g, ' ').trim(),
    date: date ? date[1].trim() : '',
    items
  });
}
if (!versions.length) throw new Error('No Beta versions found in changelog.html');
const data = { current: versions[0].version, versions };
fs.writeFileSync(path.join(__dirname, 'data', 'versions.js'),
  'window.RU_ZH_VERSIONS = ' + JSON.stringify(data, null, 2) + ';\n', 'utf8');
console.log('versions', versions.length, 'current', data.current);
