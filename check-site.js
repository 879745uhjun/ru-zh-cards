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

const lesson1 = load('data/lesson1.js', 'RU_ZH_LESSON1');
const lesson2 = load('data/lesson2.js', 'RU_ZH_LESSON2');
const lesson3 = load('data/lesson3.js', 'RU_ZH_LESSON3');
const lesson4 = load('data/deck.js', 'RU_ZH_DECK');
const lesson5 = load('data/lesson5.js', 'RU_ZH_LESSON5');
const decks = [lesson1, lesson2, lesson3, lesson4, lesson5];
const total = decks.reduce((sum, deck) => sum + deck.cards.length, 0);

check('5 个单元', decks.length === 5, String(decks.length));
check('总卡数 226', total === 226, String(total));
check('第 1 课 57 张', lesson1.cards.length === 57, String(lesson1.cards.length));
check('第 2 课 27 张', lesson2.cards.length === 27, String(lesson2.cards.length));
check('第 3 课 51 张', lesson3.cards.length === 51, String(lesson3.cards.length));
check('第 4 课 50 张', lesson4.cards.length === 50, String(lesson4.cards.length));
check('第 5 课 41 张', lesson5.cards.length === 41, String(lesson5.cards.length));
check('没有 plan 课程', decks.every(deck => deck.id !== 'plan'));
check('同义卡已合并', decks.reduce((n, deck) => n + deck.cards.filter(card => Array.isArray(card.ruVariants) && card.ruVariants.length).length, 0) >= 4);

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
Object.values(sources).forEach(list => (list || []).forEach(source => {
  sections[[source.unit, source.kind, source.number].join('|')] = source;
}));
check('15 篇对话/课文（至少 14 篇有卡片来源）', Object.keys(sections).length >= 14, String(Object.keys(sections).length));

check('文本页存在', fs.existsSync(path.join(base, 'texts.html')));
check('书首页链接文本页', fs.readFileSync(path.join(base, 'book.html'), 'utf8').includes('texts.html'));
check('不在书首页链接来源查询作为文本入口', !fs.readFileSync(path.join(base, 'book.html'), 'utf8').includes('text-module" href="sources.html"'));
check('删除状态键存在', fs.readFileSync(path.join(base, 'app.js'), 'utf8').includes('ru-zh-cards-deleted-v1'));
check('备份包含 deleted', fs.readFileSync(path.join(base, 'app.js'), 'utf8').includes('deleted: loadDeleted()'));

console.log(failures ? ('FAILED: ' + failures) : 'ALL PASS');
process.exit(failures ? 1 : 0);
