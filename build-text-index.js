const fs = require('fs');
const vm = require('vm');
const path = require('path');

const base = __dirname;

function load(file, key) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), sandbox, { filename: file });
  return sandbox.window[key];
}

const sources = load('data/sources.js', 'RU_ZH_SOURCES') || {};
const sourceTexts = load('data/sources.js', 'RU_ZH_SOURCE_TEXTS') || {};
const baseSections = load('data/sources.js', 'RU_ZH_SOURCE_SECTIONS') || [];
const extra = load('data/extra-texts.js', 'RU_ZH_EXTRA_TEXTS') || { sections: [], texts: {} };
const lemmas = load('data/lemmas.js', 'RU_ZH_LEMMAS') || {};

const LESSONS = ['data/lesson1.js', 'data/lesson2.js', 'data/lesson3.js', 'data/deck.js', 'data/lesson5.js', 'data/lesson6.js'];
const KEYS = ['RU_ZH_LESSON1', 'RU_ZH_LESSON2', 'RU_ZH_LESSON3', 'RU_ZH_DECK', 'RU_ZH_LESSON5', 'RU_ZH_LESSON6'];

const SUFFIX = ['иями','ями','ами','ией','иях','ях','ах','ов','ев','ий','ый','ой','ая','яя','ое','ее','ые','ие','ую','юю','ем','ом','ам','ям','ия','ию','ии','ей','а','я','о','е','ы','и','у','ю'];
function stem(word) {
  const w = String(word || '').toLowerCase();
  for (const suffix of SUFFIX) {
    if (w.length - suffix.length >= 3 && w.slice(-suffix.length) === suffix) return w.slice(0, -suffix.length);
  }
  return w;
}
function lemmaOf(word) {
  const lower = String(word || '').toLowerCase();
  return stem(lemmas[lower] || lower);
}
function lemmasOf(text) {
  const out = [];
  const seen = {};
  (String(text || '').match(/[А-Яа-яЁё-]+/g) || []).forEach(function (word) {
    const l = lemmaOf(word);
    if (l && !seen[l]) { seen[l] = true; out.push(l); }
  });
  return out;
}
function cleanRu(value) {
  return String(value || '').replace(/\[([А-Яа-яЁё])\]/g, '$1');
}

// 卡片中文 -> 文本区块
const zhMap = {};
for (let i = 0; i < LESSONS.length; i++) {
  const deck = load(LESSONS[i], KEYS[i]);
  if (!deck || !Array.isArray(deck.cards)) continue;
  const tagMap = { '对话 1': 'd1', '对话 2': 'd2', '课文 1': 't1' };
  const lessonNo = (String(deck.title || '').match(/第\s*(\d+)\s*课/) || [])[1];
  deck.cards.forEach(function (card) {
    const key = cleanRu(card.ru).toLowerCase();
    const list = sources[key] || [];
    const targets = [];
    list.forEach(function (item) { if (item.textKey) targets.push(item.textKey); });
    if (!targets.length && lessonNo && tagMap[card.tag]) targets.push('l' + lessonNo + tagMap[card.tag]);
    targets.forEach(function (id) {
      (zhMap[id] = zhMap[id] || []).push({ zh: String(card.zh || ''), ru: cleanRu(card.ru) });
    });
  });
}

const sections = baseSections.concat(extra.sections || []).map(function (section) {
  const text = sourceTexts[section.id] || (extra.texts || {})[section.id] || '';
  return {
    id: section.id,
    unit: section.unit,
    kind: section.kind,
    number: section.number,
    title: section.title,
    page: section.page,
    lemmas: lemmasOf(text),
    zh: zhMap[section.id] || []
  };
});

const UNIT_TITLES = {
  '第 1 课': '外貌与性格', '第 2 课': '性格与生活', '第 3 课': '运动与爱好', '第 4 课': '旅游与城市',
  '第 5 课': '图书馆与阅读', '第 6 课': '居住', '第 7 课': '俄语学习', '第 8 课': '传媒',
  '第 9 课': '节日', '第 10 课': '民族饮食', '第 11 课': '博物馆与展览', '第 12 课': '戏剧与电影'
};

const payload = { sections: sections, unitTitles: UNIT_TITLES };
const out = 'window.RU_ZH_TEXT_SEARCH = ' + JSON.stringify(payload) + ';\n';
fs.writeFileSync(path.join(base, 'data', 'text-search.js'), out, 'utf8');
console.log('sections', sections.length, 'zh entries', sections.reduce(function (n, s) { return n + s.zh.length; }, 0), 'bytes', out.length);
