const fs = require('fs');
const vm = require('vm');
const path = require('path');

const base = __dirname;
let failures = 0;
function check(name, condition, detail) {
  if (condition) { console.log('PASS ' + name); }
  else { failures++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
function load(file, name) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), sandbox, { filename: file });
  return sandbox.window[name];
}

// 课程清单：新增课程时只改这张表
const LESSONS = [
  { id: 'lesson1', file: 'data/lesson1.js', key: 'RU_ZH_LESSON1', cards: 57 },
  { id: 'lesson2', file: 'data/lesson2.js', key: 'RU_ZH_LESSON2', cards: 27 },
  { id: 'lesson3', file: 'data/lesson3.js', key: 'RU_ZH_LESSON3', cards: 51 },
  { id: 'lesson4', file: 'data/deck.js', key: 'RU_ZH_DECK', cards: 50 },
  { id: 'lesson5', file: 'data/lesson5.js', key: 'RU_ZH_LESSON5', cards: 41 },
  { id: 'lesson6', file: 'data/lesson6.js', key: 'RU_ZH_LESSON6', cards: 45 }
];

const decks = [];
LESSONS.forEach(function (item) {
  const data = load(item.file, item.key);
  check(item.id + ' 可加载', !!data && Array.isArray(data.cards), item.file);
  if (data && Array.isArray(data.cards)) {
    data.id = item.id;
    decks.push(data);
    check(item.id + ' ' + item.cards + ' 张', data.cards.length === item.cards, String(data.cards.length));
    check(item.id + ' 有标题', !!String(data.title || '').trim(), item.file);
  }
});

const expectedTotal = LESSONS.reduce(function (n, item) { return n + item.cards; }, 0);
const total = decks.reduce(function (sum, deck) { return sum + deck.cards.length; }, 0);
check('课程数 ' + LESSONS.length, decks.length === LESSONS.length, String(decks.length));
check('总卡数 ' + expectedTotal, total === expectedTotal, String(total));
check('没有 plan 课程', decks.every(function (deck) { return deck.id !== 'plan'; }));
check('课程 id 不重复', new Set(decks.map(function (d) { return d.id; })).size === decks.length);
check('每张卡有 ru 和 zh', decks.every(function (deck) {
  return deck.cards.every(function (card) { return String(card.ru || '').trim() && String(card.zh || '').trim(); });
}));
check('同义卡已合并', decks.reduce(function (n, deck) {
  return n + deck.cards.filter(function (card) { return Array.isArray(card.ruVariants) && card.ruVariants.length; }).length;
}, 0) >= 4);

// 脏写守卫：任何源码文件被写成极小内容都直接失败
const GUARD_JS = ['app.js', 'unit.js', 'plan.js', 'sources.js', 'texts.js', 'sidebar.js', 'global-search.js',
  'version-update.js', 'pwa.js', 'sw.js', 'check-site.js', 'build-sources.js', 'build-single.js', 'build-version-data.js'];
GUARD_JS.forEach(function (file) {
  const size = fs.statSync(path.join(base, file)).size;
  check(file + ' 未被写坏', size > 200, size + 'B');
});
const GUARD_HTML = ['index.html', 'book.html', 'unit.html', 'plan.html', 'sources.html', 'texts.html',
  'changelog.html', 'account-demo.html', 'single.html'];
GUARD_HTML.forEach(function (file) {
  const source = fs.readFileSync(path.join(base, file), 'utf8');
  check(file + ' 未被写坏', source.length > 400 && /<!doctype html>/i.test(source), source.length + 'B');
});
const GUARD_DATA = ['data/deck.js', 'data/lesson1.js', 'data/lesson2.js', 'data/lesson3.js', 'data/lesson5.js',
  'data/lesson6.js', 'data/sources.js', 'data/lemmas.js', 'data/versions.js', 'data/extra-texts.js', 'data/text-search.js', 'data/decks-source.js'];
GUARD_DATA.forEach(function (file) {
  const source = fs.readFileSync(path.join(base, file), 'utf8');
  check(file + ' 未被写坏', source.length > 200 && source.indexOf('window.') !== -1, source.length + 'B');
});

const sourceSandbox = { window: {} };
vm.createContext(sourceSandbox);
vm.runInContext(fs.readFileSync(path.join(base, 'data/sources.js'), 'utf8'), sourceSandbox, { filename: 'data/sources.js' });
const sources = sourceSandbox.window.RU_ZH_SOURCES || {};
const sourceTexts = sourceSandbox.window.RU_ZH_SOURCE_TEXTS || {};
const sourceKeys = Object.keys(sources);
check('来源至少 150 个键', sourceKeys.length >= 150, String(sourceKeys.length));
check('15 篇全文各存一份', Object.keys(sourceTexts).length === 15, String(Object.keys(sourceTexts).length));
check('来源全文无 Привёт', !JSON.stringify(sourceTexts).includes('Привёт'));
check('来源全文无 хотёл', !JSON.stringify(sourceTexts).includes('хотёл'));
check('来源全文无 °®©™• 等符号', !/[°®©™•|]/.test(JSON.stringify(sourceTexts)));
check('来源引文无 °®©™• 等符号', !/[°®©™•|]/.test(JSON.stringify(sources)));

const sections = {};
Object.values(sources).forEach(function (list) {
  (list || []).forEach(function (source) {
    sections[[source.unit, source.kind, source.number].join('|')] = source;
  });
});
check('15 篇对话/课文（至少 14 篇有卡片来源）', Object.keys(sections).length >= 14, String(Object.keys(sections).length));

const extraSandbox = { window: {} };
vm.createContext(extraSandbox);
vm.runInContext(fs.readFileSync(path.join(base, 'data/extra-texts.js'), 'utf8'), extraSandbox, { filename: 'data/extra-texts.js' });
const extra = extraSandbox.window.RU_ZH_EXTRA_TEXTS || {};
const extraSections = Array.isArray(extra.sections) ? extra.sections : [];
const extraTexts = extra.texts || {};
check('第 6–12 课文本 21 篇', extraSections.length === 21, String(extraSections.length));
check('新增文本都有正文', extraSections.every(function (s) {
  return String(extraTexts[s.id] || '').trim().length > 100;
}));
check('对话文本每行以 — 开头', extraSections.filter(function (s) { return s.kind === '对话'; }).every(function (s) {
  return String(extraTexts[s.id] || '').split('\n').filter(Boolean).every(function (line) {
    return line.trim().indexOf('—') === 0;
  });
}));
const baseSections = Array.isArray(sourceSandbox.window.RU_ZH_SOURCE_SECTIONS) ? sourceSandbox.window.RU_ZH_SOURCE_SECTIONS : [];
check('原文区块 15 篇', baseSections.length === 15, String(baseSections.length));
check('文本库总篇数 36', baseSections.length + extraSections.length === 36,
  String(baseSections.length + extraSections.length));

const searchSandbox = { window: {} };
vm.createContext(searchSandbox);
vm.runInContext(fs.readFileSync(path.join(base, 'data/text-search.js'), 'utf8'), searchSandbox, { filename: 'data/text-search.js' });
const searchIndex = searchSandbox.window.RU_ZH_TEXT_SEARCH || {};
check('搜索索引 36 篇', (searchIndex.sections || []).length === 36, String((searchIndex.sections || []).length));
check('搜索索引含中文条目', (searchIndex.sections || []).some(function (s) { return (s.zh || []).length > 0; }));
check('搜索索引含词元', (searchIndex.sections || []).every(function (s) { return Array.isArray(s.lemmas); }));
check('文本页有搜索框', fs.readFileSync(path.join(base, 'texts.html'), 'utf8').includes('id="textSearch"'));

const versionsSandbox = { window: {} };
vm.createContext(versionsSandbox);
vm.runInContext(fs.readFileSync(path.join(base, 'data/versions.js'), 'utf8'), versionsSandbox, { filename: 'data/versions.js' });
const versions = versionsSandbox.window.RU_ZH_VERSIONS || {};
check('版本数据有 current', !!versions.current, String(versions.current));
check('版本数据至少 3 个版本', Array.isArray(versions.versions) && versions.versions.length >= 3);
check('版本条目都有 items', (versions.versions || []).every(function (v) {
  return Array.isArray(v.items) && v.items.length > 0;
}));

check('文本页存在', fs.existsSync(path.join(base, 'texts.html')));
check('书首页链接文本页', fs.readFileSync(path.join(base, 'book.html'), 'utf8').includes('texts.html'));
check('不在书首页链接来源查询作为文本入口', !fs.readFileSync(path.join(base, 'book.html'), 'utf8').includes('text-module" href="sources.html"'));
check('删除状态键存在', fs.readFileSync(path.join(base, 'app.js'), 'utf8').includes('ru-zh-cards-deleted-v1'));
check('备份包含 deleted', fs.readFileSync(path.join(base, 'app.js'), 'utf8').includes('deleted: loadDeleted()'));
check('每课数据都挂在页面上', GUARD_HTML.filter(function (f) { return f !== 'single.html' && f !== 'account-demo.html'; }).every(function (f) {
  if (f === 'texts.html' || f === 'changelog.html') return true;
  const source = fs.readFileSync(path.join(base, f), 'utf8');
  return source.includes('data/lesson6.js');
}));

console.log(failures ? ('FAILED: ' + failures) : 'ALL PASS');
process.exit(failures ? 1 : 0);
