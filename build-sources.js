const fs = require('fs');
const path = require('path');
const vm = require('vm');

const base = 'D:/Deepseek work/workplace/ru-zh-cards';
const ocr = path.join(base, 'ocr');

function readPage(lesson, file) {
  return fs.readFileSync(path.join(ocr, lesson, file), 'utf8');
}

const sections = [
  { id:'l1d1', lesson:'第一课', unit:'第 1 课', kind:'对话', number:'对话 1', page:'2', title:'Урок 1 · Диалог 1', files:['11_Im0.txt'], start:'1 — — Валя', end:'двоюродный брат.' },
  { id:'l1d2', lesson:'第一课', unit:'第 1 课', kind:'对话', number:'对话 2', page:'2', title:'Урок 1 · Диалог 2', files:['11_Im0.txt'], start:'2 — — Вёра', end:'с ним познакомлю!' },
  { id:'l1t1', lesson:'第一课', unit:'第 1 课', kind:'课文', number:'课文 1', page:'6', title:'Мой папа', files:['15_Im0.txt','16_Im0.txt'], start:'Я всегда хотёл быть похожим', end:'равняться.' },
  { id:'l2d1', lesson:'第二课', unit:'第 2 课', kind:'对话', number:'对话 1', page:'24', title:'Урок 2 · Диалог 1', files:['33_Im0.txt'], start:'1 — — Знаешь, Наташа', end:'нам тоже не будет скучно.' },
  { id:'l2d2', lesson:'第二课', unit:'第 2 课', kind:'对话', number:'对话 2', page:'24', title:'Урок 2 · Диалог 2', files:['33_Im0.txt','34_Im0.txt'], start:'2 — — Ты уникальный', end:'друг друга понимаем.' },
  { id:'l2t1', lesson:'第二课', unit:'第 2 课', kind:'课文', number:'课文 1', page:'28', title:'Библиограф', files:['37_Im0.txt','38_Im0.txt'], start:'Матвёй Михайлович давно понял', end:'Запишите, пожалуйста...' },
  { id:'l3d1', lesson:'第三课', unit:'第 3 课', kind:'对话', number:'对话 1', page:'46', title:'Урок 3 · Диалог 1', files:['55_Im0.txt'], start:'1 — — Завтра по телевизору', end:'общее увлечение!' },
  { id:'l3d2', lesson:'第三课', unit:'第 3 课', kind:'对话', number:'对话 2', page:'46', title:'Урок 3 · Диалог 2', files:['55_Im0.txt','56_Im0.txt'], start:'2 — — Надя', end:'Договорились!' },
  { id:'l3t1', lesson:'第三课', unit:'第 3 课', kind:'课文', number:'课文 1', page:'50', title:'Моё хобби', files:['59_Im0.txt','60_Im0.txt'], start:'Любой человёк увлекается', end:'воли.' },
  { id:'l4d1', lesson:'第四课', unit:'第 4 课', kind:'对话', number:'对话 1', page:'68', title:'Урок 4 · Диалог 1', files:['77_Im0.txt'], start:'1 — Добрый день!', end:'Хорошо! Спасибо!' },
  { id:'l4d2', lesson:'第四课', unit:'第 4 课', kind:'对话', number:'对话 2', page:'68', title:'Урок 4 · Диалог 2', files:['77_Im0.txt','78_Im0.txt'], start:'2 — — Маша', end:'побывать на Волге!' },
  { id:'l4t1', lesson:'第四课', unit:'第 4 课', kind:'课文', number:'课文 1', page:'74', title:'Санкт-Петербург приглашает!', files:['83_Im0.txt','84_Im0.txt'], start:'Санкт-Петербург — одйн', end:'много интересного.' },
  { id:'l5d1', lesson:'第五课', unit:'第 5 课', kind:'对话', number:'对话 1', page:'94', title:'Урок 5 · Диалог 1', files:['103_Im0.txt'], start:'1 — — Чжан Хань', end:'раньше не замечал.' },
  { id:'l5d2', lesson:'第五课', unit:'第 5 课', kind:'对话', number:'对话 2', page:'94', title:'Урок 5 · Диалог 2', files:['103_Im0.txt','104_Im0.txt'], start:'2 — — Привёт, Настя', end:'Здорово!' },
  { id:'l5t1', lesson:'第五课', unit:'第 5 课', kind:'课文', number:'课文 1', page:'98', title:'Чтение спасёт мир!', files:['107_Im0.txt','108_Im0.txt'], start:'В одном из номербв', end:'мир литературы.' }
];

const MANUAL_TEXTS = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(base, 'data', 'manual-texts.json'), 'utf8'));
  } catch (err) { return {}; }
})();

const KEEP_WORDS = new Set('а и в во к ко о об от до по за из у с со не ни на но да нет то же ли бы мы вы он она они оно я ты это как что кто где когда там тут уже ещё дом год раз всё так чем кем кого чего нас вас им их ему ей ею нам вам ими нами вами мной тобой себя свой своя своё свои'.split(' '));

const CORRECTIONS = {
  'Привёт': 'Привет', 'привёт': 'привет', 'Онй': 'Они', 'онй': 'они',
  'Огб': 'Ого', 'Вообщё': 'Вообще', 'вообщё': 'вообще', 'застёнчивости': 'застенчивости',
  'совершённо': 'совершенно', 'тепёрь': 'теперь', 'сёкции': 'секции', 'врёмени': 'времени',
  'трёнером': 'тренером', 'тённис': 'теннис', 'нёкоторые': 'некоторые', 'номербв': 'номеров',
  'Недёли': 'Недели', 'егб': 'его', 'библиотёка': 'библиотека', 'имёть': 'иметь',
  'турйстов': 'туристов', 'всегб': 'всего', 'атмосфёра': 'атмосфера', 'путёшёствие': 'путешествие',

  'хотёл': 'хотел', 'хотёла': 'хотела', 'хотёлось': 'хотелось', 'Хотёл': 'Хотел',
  'семй': 'семи', 'семьё': 'семье', 'Худбй': 'Худой', 'худбй': 'худой',
  'Скорёе': 'Скорее', 'скорёе': 'скорее', 'смотрёл': 'смотрел', 'смотрёла': 'смотрела',
  'какбе': 'какое', 'впечатлёние': 'впечатление', 'раббтал': 'работал', 'конёчно': 'конечно',
  'человёк': 'человек', 'человёка': 'человека', 'человёку': 'человеку', 'человёком': 'человеком',
  'сёверо': 'северо', 'рекё': 'реке', 'Невё': 'Неве', 'одйн': 'один', 'однйм': 'одним',
  'котбрая': 'которая', 'истбрию': 'историю', 'цвётение': 'цветение', 'лётом': 'летом',
  'бёлые': 'белые', 'снёгом': 'снегом', 'предложёниями': 'предложениями', 'пёрвой': 'первой',
  'посмотрёть': 'посмотреть', 'навёрное': 'наверное', 'интерёснее': 'интереснее',
  'ужё': 'уже', 'успёла': 'успела', 'нёскольких': 'нескольких', 'совётую': 'советую',
  'цёлое': 'целое', 'путёшёствие': 'путешествие', 'билёт': 'билет', 'какйе': 'какие',
  'докумёнты': 'документы', 'трётьи': 'третьи', 'четвёртые': 'четвертые',
  'увлечёний': 'увлечений', 'неинтерёсной': 'неинтересной', 'Чёрез': 'Через',
  'увлечёния': 'увлечения', 'мойх': 'моих', 'интерёсов': 'интересов', 'чтёние': 'чтение',
  'дётства': 'детства', 'библиотёки': 'библиотеки', 'значёнии': 'значении', 'приведём': 'приведем',

  'тебё': 'тебе', 'Тебё': 'Тебе',
  'Вёчером': 'Вечером', 'вёчером': 'вечером',
  'свётлые': 'светлые', 'свётлее': 'светлее',
  'сёрого': 'серого', 'моёй': 'моей', 'твоёй': 'твоей', 'своёй': 'своей',
  'моёго': 'моего', 'твоёго': 'твоего', 'своёго': 'своего',
  'моёму': 'моему', 'твоёму': 'твоему', 'своёму': 'своему',
  'жйИзни': 'жизни', 'скблько': 'сколько', 'успёшным': 'успешным',
  'тёло': 'тело', 'сдёлать': 'сделать', 'Отёц': 'Отец', 'отёц': 'отец',
  'онй': 'они', 'ёсли': 'если', 'мойми': 'моими', 'срёднего': 'среднего',
  'цвёта': 'цвета', 'свёте': 'свете', 'секрёт': 'секрет',
  'настроёния': 'настроения', 'одёжда': 'одежда', 'внёшним': 'внешним',
  'вйИдом': 'видом', 'Посещёние': 'Посещение', 'посещёние': 'посещение',
  'торжёственное': 'торжественное', 'красйвом': 'красивом',
  'коллёкция': 'коллекция', 'оттёнков': 'оттенков', 'говорйл': 'говорил',
  'отдёльный': 'отдельный'
};

function correctText(line) {
  let out = line;
  Object.keys(CORRECTIONS).forEach(function (from) {
    out = out.replace(new RegExp('(^|[^А-Яа-яЁё])' + from + '($|[^А-Яа-яЁё])', 'g'), '$1' + CORRECTIONS[from] + '$2');
  });
  return out;
}

function stripGarbageLine(line) {
  let text = String(line).replace(/[ \t]+/g, ' ').trim();
  text = text.replace(/^\s*\d+\s*[—–-]+\s*/, '');
  const tokens = text.split(/\s+/).filter(Boolean);
  const kept = [];
  for (const token of tokens) {
    const word = token.replace(/[^А-Яа-яЁёA-Za-z0-9]/g, '');
    if (!word) {
      if (/^[—–-]+$/.test(token)) kept.push('—');
      continue;
    }
    if (/[0-9\[\]|@\\©°"“”]/.test(token)) continue;
    if (/[A-Za-z]/.test(token)) continue;
    if (word.length <= 1 && !KEEP_WORDS.has(word.toLowerCase())) continue;
    if (/^(Гаоо|ЭР|ФЕ|Ро|Е)$/.test(word)) continue;
    kept.push(token);
  }
  return kept.join(' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

function cleanText(t) {
  const lines = String(t).replace(/\r/g, '').split('\n').map(line => correctText(stripGarbageLine(line.replace(/[ \t]+/g, ' ').trim())));
  const kept = lines.filter(line => {
    if (!line) return false;
    if (/^(ЛЕКСИКА И РАЗВИТИЕ РЕЧИ|УРОК \d+|Основной текст|Диалоги|НОВЫЕ СЛОВА|\d+)$/i.test(line)) return false;
    const cyr = (line.match(/[А-Яа-яЁё]/g) || []).length;
    const letters = (line.match(/[А-Яа-яЁёA-Za-z]/g) || []).length;
    const total = line.replace(/\s/g, '').length;
    if (cyr < 3 && !line.startsWith('—')) return false;
    if (total && letters / total < 0.5) return false;
    return true;
  });
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

for (const s of sections) {
  const raw = s.files.map(f => readPage(s.lesson, f)).join('\n');
  const start = raw.indexOf(s.start);
  const end = raw.indexOf(s.end, start + 1);
  if (start < 0 || end < 0) {
    console.log('MARKER FAIL', s.id, start, end);
    s.text = '';
  } else {
    s.text = cleanText(raw.slice(start, end + s.end.length));
  }
}
for (const s of sections) {
  if (MANUAL_TEXTS[s.id]) s.text = String(MANUAL_TEXTS[s.id]).trim();
}

const STOP = new Set('и в во не ни на с со к ко о об от до по за из у для что как это ли же бы то'.split(' '));
function norm(t) {
  return String(t).toLowerCase().replace(/[\[\]]/g, '').replace(/ё/g, 'е').replace(/[^а-яa-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function words(t) { return norm(t).split(' ').filter(Boolean); }
function stem(w) {
  if (w.length <= 3) return w;
  return w
    .replace(/(ыми|ами|ого|ему|ому|ых|их|ая|яя|ое|ее|ые|ие|ой|ый|ий|ям|ам|ом|ем|ах|ях|ов|ев|ей|ью|ия|ию|ии|ую|ею|его|ым|им)$/,'')
    .replace(/(ться|тся|лся|ешь|ете|ите|ют|ут|ят|ат|ит|ал|ил|ел|ла|ло|ли|ем|им|ти|ть|ет|ёт)$/,'')
    .replace(/[аяыиоеёюу]$/,'');
}
function tokenStems(t) { return words(t).map(stem); }

function containsSequence(sectionText, cardText) {
  const cardWords = words(cardText).filter(w => !STOP.has(w));
  if (!cardWords.length) return false;
  const cardStems = Array.from(new Set(cardWords.map(stem)));
  const sentences = String(sectionText).split(/(?<=[.!?])\s+/);
  return sentences.some(sentence => {
    const textStems = new Set(words(sentence).map(stem));
    return cardStems.every(cs => {
      for (const ts of textStems) {
        if (ts === cs) return true;
      }
      return false;
    });
  });
}

function cleanLine(line) {
  const kept = String(line).split(/\s+/).filter(token => {
    const word = token.replace(/[^А-Яа-яЁёA-Za-z0-9]/g, '').toLowerCase();
    if (!word || /^\d+$/.test(word)) return false;
    if (word.length <= 3 && !KEEP_WORDS.has(word)) return false;
    return true;
  });
  return kept.join(' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

function cleanFullText(text) {
  const lines = String(text).split('\n').map(cleanLine).filter(line => {
    const cyr = (line.match(/[А-Яа-яЁё]/g) || []).length;
    const words = line.split(/\s+/).filter(Boolean).length;
    return cyr >= 3 && words >= 2;
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function cleanQuote(text) {
  const KEEP = new Set('а и в во к ко о об от до по за из у с со не ни на но да нет то же ли бы мы вы он она они оно я ты это как что кто где когда там тут уже ещё дом год раз всё так чем кем кого чего нас вас им их ему ей ею нам вам ими нами вами мной тобой себя свой своя своё свои про при без для под над через после между перед около кроме вокруг него неё них'.split(' '));
  return String(text)
    .replace(/[\[\]{}|]/g, ' ')
    .split(/\s+/)
    .filter(token => {
      const word = token.replace(/[^А-Яа-яЁёA-Za-z0-9]/g, '').toLowerCase();
      if (!word || /^\d+$/.test(word)) return false;
      if (word.length <= 3 && !KEEP.has(word)) return false;
      return true;
    })
    .join(' ')
    .replace(/^[—\-\s]+/, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function quoteFor(sectionText, cardText) {
  const sentences = sectionText.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (containsSequence(sentence, cardText)) return cleanQuote(sentence);
  }
  const cardStems = Array.from(new Set(words(cardText).filter(w => !STOP.has(w)).map(stem)));
  let best = null;
  let bestScore = 0;
  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    const textStems = Array.from(new Set(words(sentence).map(stem)));
    let score = 0;
    for (const cs of cardStems) {
      if (textStems.some(ts => ts === cs || ts.startsWith(cs) || cs.startsWith(ts))) score++;
    }
    if (score > bestScore || (score === bestScore && best && sentence.length < best.length)) {
      best = sentence;
      bestScore = score;
    }
  }
  if (best && bestScore > 0) return cleanQuote(best);
  return sectionText.slice(0, 240).trim();
}

const LESSON_NUM = { '第一课': 1, '第二课': 2, '第三课': 3, '第四课': 4, '第五课': 5 };
const PAGE_FILES = {};
for (const lesson of Object.keys(LESSON_NUM)) {
  PAGE_FILES[lesson] = fs.readdirSync(path.join(ocr, lesson))
    .filter(f => /\.txt$/.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['deck.js', 'lesson1.js', 'lesson2.js', 'lesson3.js', 'lesson5.js']) {
  vm.runInContext(fs.readFileSync(path.join(base, 'data', file), 'utf8'), sandbox, { filename: file });
}
const w = sandbox.window;
const decks = [
  { id:'lesson1', data:w.RU_ZH_LESSON1 },
  { id:'lesson2', data:w.RU_ZH_LESSON2 },
  { id:'lesson3', data:w.RU_ZH_LESSON3 },
  { id:'lesson4', data:w.RU_ZH_DECK },
  { id:'lesson5', data:w.RU_ZH_LESSON5 }
];
function cleanRu(t) { return String(t || '').replace(/\[([А-Яа-яЁё])\]/g, '$1'); }

const MANUAL = {
  'я всегда хочу быть похожим на моего папу.': ['l1t1'],
  'когда отец смотрит на меня, мне кажется, что он видит меня насквозь.': ['l1t1'],
  'у отца губы отчётливой формы, но из-за бороды их не так сильно заметно.': ['l1t1'],
  'отец с бородой выглядит более зрелым и мужественным.': ['l1t1'],
  'отец коротко пострижен.': ['l1t1'],
  'я никогда не видел его с длинными волосами.': ['l1t1'],
  'я похож на отца ушами.': ['l1t1'],
  'если сравнивать с моими знакомыми, то папины уши больше среднего.': ['l1t1'],
  'отец уверен, что здоровое тело может сделать человека счастливым и успешным.': ['l1t1'],
  'на вид я бы дал ему лет 30.': ['l1t1'],
  'папина одежда аккуратно выглажена, а его обувь всегда вычищена до блеска.': ['l1t1'],
  'в повседневной жизни он ходит в джинсах.': ['l1t1'],
  'мне есть на кого равняться.': ['l1t1'],
  'у неё большие глубокие синие глаза.': ['l1t1'],
  'сёстры разные по характеру, одна любит разговаривать, а другая молчаливая.': ['l2d1'],
  'я пошёл в папу, люблю общаться.': ['l2d1'],
  'саша скромный до застенчивости, и от этого страдает.': ['l2d1'],
  'мы часто общаемся с русскими студентами.': ['l2d1'],
  'на ресторан денег не хватает.': ['l2d2'],
  'что бы жена ни приготовила, мужу не нравится.': ['l2d2']
};

const MANUAL_SOURCE_IDS = {
  'библиографический кабинет': 'l2t1',
  'кандидат наук': 'l2t1',
  'прийти к странному решению': 'l2t1',
  'своевременно сообщить кому о чём': 'l2t1',
  'обаятельный человек': 'l2t1',
  'как правило': 'l4t1',
  'принести удовольствие': 'l3t1',
  'смотреть сериал': 'l3d2',
  'кататься на велосипеде': 'l3t1',
  'ночевать в лесу': 'l3t1',
  'ходить в походы': 'l3t1',
  'кататься на горных лыжах': 'l3t1',
  'тренировать лёгкие': 'l3t1',
  'приобрести множество болезней': 'l3t1',
  'добиваться успеха': 'l3t1',
  'безграничный мир увлечений': 'l3t1',
  'быть наедине с собой': 'l3t1',
  'картинная галерея': 'l4d2',
  'иметь своё лицо': 'l4t1',
  'играть важную роль в чём': 'l4t1',
  'символ города': 'l4t1',
  'белая ночь': 'l4t1',
  'войти в восьмёрку наиболее привлекательных для туристов городов в мире': 'l4t1',
  'пользоваться особой популярностью': 'l4t1',
  'перечитать классику': 'l5d1',
  'выдавать книги': 'l5d2',
  'роль и значение домашней библиотеки': 'l5t1',
  'привести отрывки из писем': 'l5t1',
  'начать читать из любопытства': 'l5t1',
  'усвоить информацию': 'l5t1',
  'попадаться на глаза': 'l5t1',
  'подать детям пример': 'l5t1',
  'раскрыть кому глаза на что': 'l5t1',
  'мужчина среднего роста': 'l1d1',
  'вести здоровый образ жизни': 'l1t1',
  'отказываться от жирной пищи': 'l1t1',
  'одеваться со вкусом': 'l1t1',
  'сила воли': 'l3t1'
};
const MANUAL_NO_SOURCE = new Set([
  'я пошёл в папу, люблю общаться',
  'я пошёл в папу, люблю общаться.',
  'мы часто общаемся с русскими студентами',
  'мы часто общаемся с русскими студентами.',
  'сёстры разные по характеру, одна любит разговаривать, а другая молчаливая.',
  'саша скромный до застенчивости, и от этого страдает.',
  'что бы жена ни приготовила, мужу не нравится.',
  'у неё большие глубокие синие глаза.'
]);

const MANUAL_QUOTES = {
  'кандидат наук': 'Сюда заходили кандидаты и доктора наук.',
  'своевременно сообщить кому о чём': 'Почему же вы не сообщили мне своевременно об этом?',
  'прийти к странному решению': 'После того, как похоронил жену, он пришёл к странному, на первый взгляд, решению:',
  'обаятельный человек': 'Удивительно скромный, трудолюбивый, обаятельный, он сделал для меня лично, для моих коллег очень много.',
  'библиографический кабинет': 'Он представлял себе, какое впечатление производил на посетителей библиографического кабинета, где он работал.',
  'редкая книга': 'Он им был, конечно, нужен: искал забытые журнальные статьи, редкие книги...',
  'думать про себя': 'Иногда он смотрел на себя со стороны и тогда думал про себя, как, должно быть, смешно он выглядит.',
  'принести удовольствие': 'Любимые занятия приносят человеку удовольствие, и он забывает о повседневных проблемах.',
  'смотреть сериал': 'Мне нравится проводить выходные за просмотром любимого сериала и за чтением.',
  'ходить в походы': 'В зависимости от времени года я хожу в походы или катаюсь на горных лыжах.',
  'пользоваться особой популярностью': 'Северная столица России пользуется особой популярностью у посетителей.',
  'что бы жена ни приготовила, мужу не нравится': 'Всем: жизнью, погодой, мной. Что бы я ни приготовила, тебе не нравится.',
  'мужчина среднего роста': 'Ему лет 30. Среднего роста.',
  'на вид я бы дал ему лет 30.': 'Ему уже 45 лет, но на вид я бы дал ему лет 30.',
  'сила воли': 'Я считаю, что каждый человек должен любить спорт и часто им заниматься. Недаром говорят, что движение — это жизнь. Если всё время сидишь в четырёх стенах, то приобретёшь множество болезней, да и настроение будет мрачным. А ещё я недавно прочёл в журнале, что люди, которые занимаются спортом, гораздо чаще добиваются успеха в жизни. Это, наверное, потому, что спорт требует не только регулярности тренировок, но и силы воли.',
  'вести здоровый образ жизни': 'Действительно, любовь к физкультуре и ведение здорового образа жизни — основные увлечения папы.',
  'отказываться от жирной пищи': 'Кроме того, папа старается следить за своим питанием, он всегда отказывается от жирной пищи.',
  'одеваться со вкусом': 'Папа всегда одевается со вкусом.'
};

const map = {};
const report = [];
for (const deck of decks) {
  for (const card of deck.data.cards) {
    const key = cleanRu(card.ru).toLowerCase();
    if (MANUAL_NO_SOURCE.has(key)) continue;
    let hits = sections.filter(s => s.text && containsSequence(s.text, card.ru));
    const manual = MANUAL[key];
    if (manual) hits = sections.filter(s => manual.indexOf(s.id) !== -1);
    if (MANUAL_SOURCE_IDS[key]) hits = sections.filter(s => s.id === MANUAL_SOURCE_IDS[key]);
    if (!hits.length) continue;
    const sources = hits.map(s => ({
      book: '新东方大学俄语（3）',
      unit: s.unit,
      kind: s.kind,
      number: s.number,
      title: s.title,
      page: s.page,
      pdf: 'sources/lesson' + LESSON_NUM[s.lesson] + '.pdf',
      pdfPage: PAGE_FILES[s.lesson].indexOf(s.files[0]) + 1,
      textKey: s.id,
      quote: MANUAL_QUOTES[key] || quoteFor(s.text, card.ru)
    }));
    map[key] = (map[key] || []).concat(sources);
    report.push({ deck: deck.id, ru: cleanRu(card.ru), zh: card.zh, sources: hits.map(s => s.id) });
  }
}

const textStore = {};
const sectionMeta = [];
for (const s of sections) {
  if (s.text) textStore[s.id] = s.text;
  sectionMeta.push({
    id: s.id,
    unit: s.unit,
    kind: s.kind,
    number: s.number,
    title: s.title,
    page: s.page,
    pdf: 'sources/lesson' + LESSON_NUM[s.lesson] + '.pdf',
    pdfPage: PAGE_FILES[s.lesson].indexOf(s.files[0]) + 1
  });
}
fs.writeFileSync(path.join(base, 'data', 'sources.js'),
  'window.RU_ZH_SOURCE_TEXTS = ' + JSON.stringify(textStore) + ';\n' +
  'window.RU_ZH_SOURCE_SECTIONS = ' + JSON.stringify(sectionMeta) + ';\n' +
  'window.RU_ZH_SOURCES = ' + JSON.stringify(map) + ';\n', 'utf8');
fs.writeFileSync(path.join(base, 'ocr', 'source-report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log('sections');
sections.forEach(s => console.log(s.id, s.text.length));
console.log('cards with sources', report.length, 'mapped keys', Object.keys(map).length);
console.log('no source', decks.reduce((n,d)=>n+d.data.cards.length,0) - report.length);
