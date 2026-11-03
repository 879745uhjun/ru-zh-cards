(function () {
  'use strict';

  var STORAGE_KEY = 'ru-zh-cards-beta-v0.1';
  var DECKS_KEY = 'ru-zh-cards-decks-v0.3';
  var UI_KEY = 'ru-zh-cards-ui-v0.2';
  var PROGRESS_KEY = 'ru-zh-cards-progress-v0.2';
  var SCHEDULE_KEY = 'ru-zh-cards-schedule-v0.3';
  var PLAN_KEY = 'ru-zh-cards-plan-v1';
  var BUILTIN_DECK = window.RU_ZH_DECK;
  var BUILTIN_LESSON1 = window.RU_ZH_LESSON1;
  var BUILTIN_LESSON2 = window.RU_ZH_LESSON2;
  var BUILTIN_LESSON3 = window.RU_ZH_LESSON3;
  var BUILTIN_LESSON5 = window.RU_ZH_LESSON5;
  var VOWELS = 'аеёиоуыэюяАЕЁИОУЫЭЮЯ';
  var WORD_RE = /(?:[А-Яа-яЁёA-Za-z0-9]|\[[А-Яа-яЁё]\])+(?:[-–—](?:[А-Яа-яЁёA-Za-z0-9]|\[[А-Яа-яЁё]\])+)*/g;
  var CASE_RE = /(主格|宾格|与格|属格|工具格|前置格|第一格|第二格|第三格|第四格|第五格|第六格)/;

  var state = {
    decks: [],
    deckId: '',
    deck: null,
    lastCards: {},
    visible: [],
    index: 0,
    mode: 'both',
    revealed: false,
    study: false,
    editEnabled: false,
    filter: 'all',
    type: 'all',
    query: '',
    random: false,
    onlyReview: false,
    dueOnly: false,
    progress: {},
    schedule: {},
    importTab: 'table',
    fileText: '',
    fileName: '',
    fileType: 'auto'
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var cardBody = $('#cardBody');
  var toastEl = $('#toast');
  var modal = $('#importModal');
  var editModal = $('#editModal');
  var sourceModal = $('#sourceModal');
  var toastTimer = null;
  var lastFocus = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function hasVowel(text) {
    for (var i = 0; i < text.length; i++) {
      if (VOWELS.indexOf(text[i]) !== -1) return true;
    }
    return false;
  }

  function extractStress(raw) {
    var text = String(raw == null ? '' : raw);
    var stress = null;
    var m = text.match(/\[([А-Яа-яЁё])\]/);
    if (m) {
      stress = m.index;
      text = text.slice(0, m.index) + m[1] + text.slice(m.index + m[0].length);
      text = text.replace(/\[([А-Яа-яЁё])\]/g, '$1');
    }
    var acute = text.indexOf('\u0301');
    if (acute > 0) {
      stress = acute - 1;
      text = text.replace(/\u0301/g, '');
    }
    if (stress === null) {
      var lower = text.toLowerCase();
      var yo = lower.indexOf('ё');
      if (yo >= 0) {
        stress = yo;
      } else {
        var vowels = [];
        for (var i = 0; i < text.length; i++) {
          if (VOWELS.indexOf(text[i]) !== -1) vowels.push(i);
        }
        if (vowels.length === 1) stress = vowels[0];
      }
    }
    return { text: text, stress: stress };
  }

  function cleanRu(raw) {
    return String(raw == null ? '' : raw)
      .replace(/\[([А-Яа-яЁё])\]/g, '$1')
      .replace(/\u0301/g, '')
      .trim();
  }

  function normalizeSources(raw) {
    var list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    var out = [];
    list.forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      var kind = String(item.kind || item.type || '').indexOf('对话') !== -1 ? '对话' : '课文';
      var source = {
        book: String(item.book || '新东方大学俄语（3）').trim(),
        unit: String(item.unit || item.lesson || '').trim(),
        kind: kind,
        number: String(item.number || item.part || '').trim(),
        title: String(item.title || '').trim(),
        page: item.page == null ? '' : String(item.page).trim(),
        pdf: String(item.pdf || '').trim(),
        pdfPage: item.pdfPage == null ? '' : String(item.pdfPage).trim(),
        text: String(item.text || item.quote || '').trim(),
        quote: String(item.quote || '').trim()
      };
      if (!source.unit && !source.title && !source.text) return;
      out.push(source);
    });
    return out;
  }

  function sourcesForRu(ru) {
    var map = window.RU_ZH_SOURCES || {};
    var key = cleanRu(ru).toLowerCase();
    var found = map[key] || map[cleanRu(ru)] || [];
    return normalizeSources(found);
  }

  function splitWordPunct(text) {
    var lead = '';
    var punct = '';
    var rest = String(text == null ? '' : text).trim();
    var mLead = rest.match(/^([«„“"'(\[]+)/);
    if (mLead) {
      lead = mLead[1];
      rest = rest.slice(lead.length);
    }
    var mPunct = rest.match(/([.,!?;:…»”"')\]]+)$/);
    if (mPunct) {
      punct = mPunct[1];
      rest = rest.slice(0, rest.length - punct.length);
    }
    return { lead: lead, text: rest, punct: punct };
  }

  function tokenizeRu(ru) {
    var src = String(ru == null ? '' : ru);
    var tokens = [];
    var re = new RegExp('(' + WORD_RE.source + ')|([^\\s])', 'g');
    var match;
    while ((match = re.exec(src))) {
      if (match[1]) {
        var raw = match[1];
        var bare = raw.replace(/\[[^\]]*\]/g, '');
        if (/[А-Яа-яЁёA-Za-z0-9]/.test(bare)) {
          var parsed = extractStress(raw);
          tokens.push({ text: parsed.text, stress: parsed.stress, grammar: [], punct: '', lead: '' });
          continue;
        }
      }
      var punct = match[2] || match[1] || '';
      if (tokens.length) tokens[tokens.length - 1].punct += punct;
      else tokens.push({ punctOnly: true, text: punct, grammar: [] });
    }
    return tokens;
  }

  function splitLabels(value) {
    if (Array.isArray(value)) {
      var out = [];
      value.forEach(function (v) { out = out.concat(splitLabels(v)); });
      return out;
    }
    if (typeof value !== 'string') return [];
    return value.split(/\s*[\/｜]\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function normalizeGrammar(value) {
    if (Array.isArray(value)) {
      return value.map(function (group) { return splitLabels(group); });
    }
    if (typeof value === 'string') {
      return value.split('|').map(function (group) { return splitLabels(group); });
    }
    return [];
  }

  function normalizeWord(raw, fallbackGrammar) {
    if (typeof raw === 'string') {
      var parsedString = extractStress(raw);
      var splitString = splitWordPunct(parsedString.text);
      return {
        text: splitString.text,
        stress: parsedString.stress,
        grammar: splitLabels(fallbackGrammar),
        punct: splitString.punct,
        lead: splitString.lead
      };
    }
    var text = String((raw && (raw.text || raw.word)) || '');
    var parsed = extractStress(text);
    var stress = raw && Number.isInteger(raw.stress) ? raw.stress : parsed.stress;
    var split = splitWordPunct(parsed.text);
    var grammar = raw && raw.grammar != null ? splitLabels(raw.grammar) : splitLabels(fallbackGrammar);
    if (raw && raw.stress === null) stress = null;
    return {
      text: split.text,
      stress: stress,
      grammar: grammar,
      punct: raw && raw.punct ? String(raw.punct) : split.punct,
      lead: raw && raw.lead ? String(raw.lead) : split.lead
    };
  }

  function normalizeCard(raw, index) {
    if (!raw || typeof raw !== 'object') throw new Error('卡片不是对象');
    var ruRaw = raw.ru || raw.russian || '';
    var zh = raw.zh || raw.chinese || raw.cn || '';
    var groups = normalizeGrammar(raw.grammar);
    var words = [];

    if (Array.isArray(raw.words) && raw.words.length) {
      words = raw.words.map(function (w, i) {
        return normalizeWord(w, groups[i] || []);
      });
      if (!ruRaw) {
        ruRaw = words.map(function (w) {
          return (w.lead || '') + w.text + (w.punct || '');
        }).join(' ');
      }
    } else {
      if (!ruRaw) throw new Error('缺少俄语原文');
      words = tokenizeRu(ruRaw);
      var gi = 0;
      words.forEach(function (word) {
        if (word.punctOnly) return;
        word.grammar = groups[gi] || [];
        gi++;
      });
    }

    if (!zh) throw new Error('缺少中文译文');
    var cleaned = cleanRu(ruRaw);
    if (!cleaned) throw new Error('俄语原文为空');

    var type = normalizeType(raw.type) || detectCardType(cleaned);
    var sources = normalizeSources(raw.sources || raw.source);
    if (!sources.length) sources = sourcesForRu(cleaned);
    return {
      id: raw.id || ('c' + (index + 1)),
      ru: cleaned,
      zh: String(zh).trim(),
      tag: String(raw.tag || '未分类').trim(),
      type: type,
      note: String(raw.note || '').trim(),
      sources: sources,
      words: words
    };
  }

  function normalizeDeck(input) {
    if (!input) throw new Error('没有卡片数据');
    var rawCards = Array.isArray(input) ? input : input.cards;
    if (!Array.isArray(rawCards) || !rawCards.length) throw new Error('没有识别到卡片');
    var title = (!Array.isArray(input) && input.title) ? String(input.title) : '我的俄汉卡片';
    var subtitle = (!Array.isArray(input) && input.subtitle) ? String(input.subtitle) : '导入内容';
    var tag = (!Array.isArray(input) && input.tag) ? String(input.tag) : '自定义';
    var deckId = (!Array.isArray(input) && input.id) ? String(input.id) : ('deck-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7));
    var cards = [];
    var warnings = [];

    rawCards.forEach(function (raw, i) {
      try {
        var card = normalizeCard(raw, i);
        cards.push(card);
        var missing = card.words.filter(function (w) {
          return !w.punctOnly && (!w.grammar || !w.grammar.length);
        }).length;
        if (missing) warnings.push('第 ' + (i + 1) + ' 张有 ' + missing + ' 个词未标语法');
      } catch (err) {
        warnings.push('第 ' + (i + 1) + ' 张：' + err.message);
      }
    });

    if (!cards.length) {
      throw new Error('没有有效卡片。' + warnings.slice(0, 3).join('；'));
    }
    return { id: deckId, title: title, subtitle: subtitle, tag: tag, cards: cards, warnings: warnings };
  }

  function deckPayload(deck) {
    return {
      id: deck.id,
      title: deck.title,
      subtitle: deck.subtitle,
      tag: deck.tag,
      cards: deck.cards.map(function (card) {
        return {
          ru: card.ru,
          zh: card.zh,
          tag: card.tag,
          type: card.type,
          note: card.note,
          sources: card.sources || [],
          words: card.words.map(function (w) {
            return { text: w.text, stress: w.stress, grammar: w.grammar, punct: w.punct, lead: w.lead };
          })
        };
      })
    };
  }

  function saveDecks() {
    try {
      localStorage.setItem(DECKS_KEY, JSON.stringify(state.decks.filter(function (deck) { return deck.id !== 'plan'; }).map(deckPayload)));
    } catch (err) {
      // localStorage 不可用时，程序仍可继续使用当前会话。
    }
  }

  function saveDeck() {
    saveDecks();
  }

  function builtinDecks() {
    var list = [];
    if (BUILTIN_LESSON1) {
      var lesson1 = Object.assign({}, BUILTIN_LESSON1);
      lesson1.id = 'lesson1';
      list.push(lesson1);
    }
    if (BUILTIN_LESSON2) {
      var lesson2 = Object.assign({}, BUILTIN_LESSON2);
      lesson2.id = 'lesson2';
      list.push(lesson2);
    }
    if (BUILTIN_LESSON3) {
      var lesson3 = Object.assign({}, BUILTIN_LESSON3);
      lesson3.id = 'lesson3';
      list.push(lesson3);
    }
    if (BUILTIN_DECK) {
      var lesson4 = Object.assign({}, BUILTIN_DECK);
      lesson4.id = 'lesson4';
      list.push(lesson4);
    }
    if (BUILTIN_LESSON5) {
      var lesson5 = Object.assign({}, BUILTIN_LESSON5);
      lesson5.id = 'lesson5';
      list.push(lesson5);
    }
    return list;
  }

  function mergeBuiltinDecks(loaded) {
    var builtins = builtinDecks();
    builtins.forEach(function (builtin) {
      var exists = loaded.some(function (deck) { return deck.id === builtin.id; });
      if (!exists) loaded.push(normalizeDeck(builtin));
    });
    return loaded;
  }

  function loadDecks() {
    try {
      var saved = localStorage.getItem(DECKS_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) {
          var loaded = parsed.map(function (deck) { return normalizeDeck(deck); });
          if (loaded.length) return mergeBuiltinDecks(loaded);
        }
      }
    } catch (err) {
      // 忽略损坏的多课程数据。
    }

    try {
      var legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy) {
        var oldDeck = normalizeDeck(JSON.parse(legacy));
        oldDeck.id = 'lesson4';
        var migrated = mergeBuiltinDecks([oldDeck]);
        localStorage.setItem(DECKS_KEY, JSON.stringify(migrated.map(deckPayload)));
        return migrated;
      }
    } catch (err) {
      // 忽略旧版单课程数据。
    }

    var builtins = builtinDecks();
    if (!builtins.length) throw new Error('未找到内置词表 data/deck.js');
    return builtins.map(function (deck) { return normalizeDeck(deck); });
  }

  function loadPlanDeck() {
    try {
      var raw = localStorage.getItem(PLAN_KEY);
      if (!raw) return null;
      var plan = JSON.parse(raw);
      var keys = plan && Array.isArray(plan.keys) ? plan.keys : [];
      if (!keys.length) return null;
      var byKey = {};
      state.decks.forEach(function (deck) {
        if (deck.id === 'plan') return;
        deck.cards.forEach(function (card) {
          var key = cardKey(card);
          if (!byKey[key]) byKey[key] = card;
        });
      });
      var cards = [];
      keys.forEach(function (key) {
        if (byKey[key]) cards.push(byKey[key]);
      });
      if (!cards.length) return null;
      var labels = { sequential: '顺序学习', custom: '自定义学习', review: '复习模式' };
      return {
        id: 'plan',
        title: '学习计划 · ' + (labels[plan.mode] || '自定义'),
        subtitle: '按计划生成的临时课程',
        tag: '学习计划',
        cards: cards
      };
    } catch (err) {
      return null;
    }
  }

  function renderDeckOptions() {
    var select = $('#deckSelect');
    if (!select) return;
    select.innerHTML = state.decks.map(function (deck) {
      return '<option value="' + escapeHtml(deck.id) + '">' + escapeHtml(deck.title) + ' · ' + deck.cards.length + ' 张</option>';
    }).join('');
    select.value = state.deckId;
  }

  function switchDeck(id) {
    if (!id || id === state.deckId) return;
    var next = null;
    for (var i = 0; i < state.decks.length; i++) {
      if (state.decks[i].id === id) { next = state.decks[i]; break; }
    }
    if (!next) return;
    saveUI();
    state.deckId = id;
    state.deck = next;
    state.filter = 'all';
    state.type = 'all';
    state.query = '';
    state.onlyReview = false;
    state.dueOnly = false;
    state.random = false;
    state.revealed = false;
    var search = $('#searchInput');
    if (search) search.value = '';
    rebuildCategoryOptions();
    refreshVisible({ preferredKey: state.lastCards[id] || '', fallbackIndex: 0 });
    render();
  }

  function builtinDeckById(id) {
    var list = builtinDecks();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return normalizeDeck(list[i]);
    }
    return null;
  }
  function cardKey(card) {
    return card.ru + '\u0001' + card.zh;
  }

  function normalizeType(value) {
    var v = String(value == null ? '' : value).trim().toLowerCase();
    if (v === 'sentence' || v === '句子' || v === '句') return 'sentence';
    if (v === 'phrase' || v === '词组' || v === '短语' || v === '词') return 'phrase';
    return '';
  }

  function detectCardType(ru) {
    return /[.!?…]\s*$/.test(String(ru || '').trim()) ? 'sentence' : 'phrase';
  }

  function typeLabel(card) {
    return card && card.type === 'sentence' ? '句子' : '词组';
  }

  function typeMatches(card) {
    return state.type === 'all' || card.type === state.type;
  }

  function currentCard() {
    return state.visible && state.visible.length ? state.visible[state.index] : null;
  }

  function statusOf(card) {
    return (card && state.progress[cardKey(card)]) || 'new';
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      var clean = {};
      Object.keys(data).forEach(function (key) {
        if (data[key] === 'mastered' || data[key] === 'review') clean[key] = data[key];
      });
      return clean;
    } catch (err) {
      return {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
    } catch (err) {
      // 忽略本地存储失败。
    }
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function addDaysKey(days) {
    var date = new Date();
    date.setDate(date.getDate() + days);
    return dateKey(date);
  }

  function loadSchedule() {
    try {
      var raw = localStorage.getItem(SCHEDULE_KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      var clean = {};
      Object.keys(data).forEach(function (key) {
        var item = data[key];
        if (item && typeof item.due === 'string') {
          clean[key] = {
            due: item.due,
            interval: Number(item.interval) || 1,
            lapses: Number(item.lapses) || 0
          };
        }
      });
      return clean;
    } catch (err) {
      return {};
    }
  }

  function saveSchedule() {
    try {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(state.schedule));
    } catch (err) {
      // 忽略本地存储失败。
    }
  }

  function scheduleOf(card) {
    return (card && state.schedule[cardKey(card)]) || null;
  }

  function isDue(card) {
    var item = scheduleOf(card);
    return !!(item && item.due && item.due <= todayKey());
  }

  function dueLabel(card) {
    var item = scheduleOf(card);
    if (!item || !item.due) return '';
    return item.due <= todayKey() ? '今天复习' : '下次 ' + item.due;
  }

  function loadUI() {
    try {
      var raw = localStorage.getItem(UI_KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
    } catch (err) {
      return {};
    }
  }

  function saveUI() {
    try {
      var card = currentCard();
      if (card && state.deckId) state.lastCards[state.deckId] = cardKey(card);
      localStorage.setItem(UI_KEY, JSON.stringify({
        mode: state.mode,
        study: state.study,
        editEnabled: state.editEnabled,
        filter: state.filter,
        type: state.type,
        random: state.random,
        onlyReview: state.onlyReview,
        dueOnly: state.dueOnly,
        deckId: state.deckId,
        lastCards: state.lastCards,
        lastCard: card ? cardKey(card) : ''
      }));
    } catch (err) {
      // 忽略本地存储失败。
    }
  }

  function matchesFilter(card) {
    if (state.filter !== 'all' && card.tag !== state.filter) return false;
    if (state.onlyReview && statusOf(card) !== 'review') return false;
    if (state.dueOnly && !isDue(card)) return false;
    var q = state.query.trim().toLowerCase();
    if (q) {
      var haystack = (card.ru + '\n' + card.zh + '\n' + card.tag).toLowerCase();
      if (haystack.indexOf(q) === -1) return false;
    }
    return true;
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function refreshVisible(options) {
    options = options || {};
    var previous = currentCard();
    var preferred = options.preferredKey != null ? options.preferredKey : (previous ? cardKey(previous) : '');
    var fallback = typeof options.fallbackIndex === 'number' ? options.fallbackIndex : state.index;
    var cards = state.deck.cards.filter(matchesFilter);
    if (state.random) shuffle(cards);
    state.visible = cards;
    if (!cards.length) {
      state.index = 0;
      return;
    }
    var found = -1;
    if (preferred) {
      for (var i = 0; i < cards.length; i++) {
        if (cardKey(cards[i]) === preferred) { found = i; break; }
      }
    }
    if (found >= 0) state.index = found;
    else state.index = Math.max(0, Math.min(fallback, cards.length - 1));
  }

  function rebuildCategoryOptions() {
    var select = $('#categorySelect');
    if (!select) return;
    var counts = {};
    var allCards = state.deck.cards;
    allCards.forEach(function (card) {
      var tag = card.tag || '未分类';
      counts[tag] = (counts[tag] || 0) + 1;
    });
    var html = '<option value="all">全部分类 (' + allCards.length + ')</option>';
    Object.keys(counts).forEach(function (tag) {
      html += '<option value="' + escapeHtml(tag) + '">' + escapeHtml(tag) + ' (' + counts[tag] + ')</option>';
    });
    select.innerHTML = html;
    if (state.filter !== 'all' && !counts[state.filter]) state.filter = 'all';
    select.value = state.filter;
  }

  function renderFilterUI() {
    var select = $('#categorySelect');
    if (select) select.value = state.filter;
    var randomBtn = $('#randomBtn');
    var reviewBtn = $('#reviewBtn');
    var dueBtn = $('#dueBtn');
    if (randomBtn) randomBtn.setAttribute('aria-pressed', state.random ? 'true' : 'false');
    if (reviewBtn) reviewBtn.setAttribute('aria-pressed', state.onlyReview ? 'true' : 'false');
    if (dueBtn) dueBtn.setAttribute('aria-pressed', state.dueOnly ? 'true' : 'false');

    var scopedCards = state.deck.cards;
    var mastered = 0;
    var review = 0;
    var due = 0;
    scopedCards.forEach(function (card) {
      var status = statusOf(card);
      if (status === 'mastered') mastered++;
      else if (status === 'review') review++;
      if (isDue(card)) due++;
    });
    if ($('#reviewCount')) $('#reviewCount').textContent = review;
    if ($('#dueCount')) $('#dueCount').textContent = due;
    if ($('#progressSummary')) {
      $('#progressSummary').textContent = '已掌握 ' + mastered + ' / ' + scopedCards.length + ' · 需复习 ' + review;
    }
  }

  function emptyStateHtml() {
    var message = state.onlyReview
      ? '还没有标记为“需复习”的卡片。先退出“只练复习”，或在卡片底部标记“需复习”。'
      : '没有符合当前筛选条件的卡片。可以换个分类、清空搜索，或恢复全部卡片。';
    return '<div class="empty-state">' +
      '<div class="empty-icon" aria-hidden="true">Я</div>' +
      '<h3>没有找到卡片</h3>' +
      '<p>' + message + '</p>' +
      '<button type="button" class="btn ghost" data-clear-filters>清除筛选，显示全部</button>' +
    '</div>';
  }

  function cardActionsHtml(card) {
    var status = statusOf(card);
    return '<div class="card-actions">' +
      '<span class="actions-label">学习进度</span>' +
      '<button type="button" class="mark-btn' + (status === 'mastered' ? ' active' : '') + '" data-mark="mastered" aria-pressed="' + (status === 'mastered' ? 'true' : 'false') + '" title="再次点击取消标记">✓ 已掌握</button>' +
      '<button type="button" class="mark-btn' + (status === 'review' ? ' active' : '') + '" data-mark="review" aria-pressed="' + (status === 'review' ? 'true' : 'false') + '" title="再次点击取消标记">↻ 需复习</button>' +
      (dueLabel(card) ? '<span class="due-label">' + escapeHtml(dueLabel(card)) + '</span>' : '') +
    '</div>';
  }

  function markCard(status) {
    var card = currentCard();
    if (!card) return;
    var key = cardKey(card);
    var previous = state.progress[key];
    var oldSchedule = state.schedule[key];

    if (previous === status) {
      delete state.progress[key];
      delete state.schedule[key];
      showToast(status === 'mastered' ? '已取消“已掌握”标记' : '已取消“需复习”标记');
    } else {
      state.progress[key] = status;
      if (status === 'mastered') {
        var interval = Math.min(60, Math.max(7, ((oldSchedule && oldSchedule.interval) || 3) * 2));
        state.schedule[key] = {
          due: addDaysKey(interval),
          interval: interval,
          lapses: (oldSchedule && oldSchedule.lapses) || 0
        };
        showToast('已标记为已掌握，' + interval + ' 天后复习');
      } else {
        state.schedule[key] = {
          due: todayKey(),
          interval: 1,
          lapses: ((oldSchedule && oldSchedule.lapses) || 0) + 1
        };
        showToast('已加入错题本，今天需要复习');
      }
    }
    saveProgress();
    saveSchedule();
    refreshVisible({ preferredKey: key, fallbackIndex: state.index });
    render();
  }

  function clearFilters() {
    state.filter = 'all';
    state.type = 'all';
    state.query = '';
    state.onlyReview = false;
    state.dueOnly = false;
    state.random = false;
    var search = $('#searchInput');
    if (search) search.value = '';
    rebuildCategoryOptions();
    refreshVisible({ fallbackIndex: 0 });
    render();
    showToast('已清除筛选，显示全部卡片');
  }

  function shouldMarkStress(word) {
    if (!Number.isInteger(word.stress) || word.stress < 0) return false;
    if (countVowels(word.text) <= 1) return false;
    if (word.stress === 0 && /[А-ЯЁ]/.test(word.text[0])) return false;
    return true;
  }

  function wordBody(word) {
    var out = '';
    var stress = word.stress;
    var mark = shouldMarkStress(word);
    for (var i = 0; i < word.text.length; i++) {
      var ch = word.text[i];
      if (mark && stress === i) {
        out += '<span class="vowel">' + escapeHtml(ch) + (ch.toLowerCase() === 'ё' ? '' : '\u0301') + '</span>';
      } else {
        out += escapeHtml(ch);
      }
    }
    return out;
  }

  function grammarHtml(word) {
    var labels = word.grammar || [];
    if (!labels.length) {
      return '<span class="grammar-wrap"><span class="grammar"><span class="g-empty">—</span></span></span>';
    }
    var inner = labels.map(function (label) {
      var safe = String(label).split(/\s*·\s*/).map(function (part) {
        var chunk = escapeHtml(part);
        chunk = chunk.replace(CASE_RE, '<span class="g-case">$1</span>');
        return '<span class="g-seg">' + chunk + '</span>';
      }).join(' ');
      return '<span class="g-label">' + safe + '</span>';
    }).join('');
    return '<span class="grammar-wrap"><span class="grammar">' + inner + '</span><span class="grammar-hint">点击</span></span>';
  }

  function ruHtml(card, first) {
    var tokens = card.words.map(function (word, i) {
      if (word.punctOnly) {
        return '<span class="punct-only">' + escapeHtml(word.text) + '</span>';
      }
      var hasGrammar = !!(word.grammar && word.grammar.length);
      var noStress = !Number.isInteger(word.stress) || word.stress < 0 || !hasVowel(word.text);
      var title = !hasVowel(word.text) ? ' title="单辅音前置词，无独立重音"' : '';
      var role = hasGrammar && state.study
        ? ' role="button" tabindex="0" data-word-index="' + i + '" aria-expanded="false" aria-label="查看 ' + escapeHtml(word.text) + ' 的语法"'
        : '';
      var cls = 'token' + (hasGrammar ? ' has-grammar' : '');
      var lead = word.lead ? '<span class="lead">' + escapeHtml(word.lead) + '</span>' : '';
      var punct = word.punct ? '<span class="punct">' + escapeHtml(word.punct) + '</span>' : '';
      return '<span class="' + cls + '" style="--i:' + i + '"' + role + '>' +
        '<span class="word-line">' + lead +
          '<span class="word' + (noStress ? ' no-stress' : '') + '"' + title + '>' + wordBody(word) + '</span>' + punct +
        '</span>' +
        grammarHtml(word) +
      '</span>';
    }).join('');
    return '<div class="ru-block' + (first ? ' first' : '') + '">' + tokens + '</div>';
  }

  function zhHtml(card, first) {
    return '<div class="zh-wrap' + (first ? ' first' : '') + '">' +
      '<span class="zh-label" aria-hidden="true"><span>中</span><span>文</span></span>' +
      '<p class="zh-text">' + escapeHtml(card.zh) + '</p>' +
    '</div>';
  }

  function hideHtml(kind, card) {
    var isRu = kind === 'ru';
    var count = card.words.filter(function (w) { return !w.punctOnly; }).length;
    var title = isRu ? '俄语原句已隐藏' : '中文译文已隐藏';
    var sub = isRu
      ? '根据中文回忆俄语表达 · 共 ' + count + ' 个词'
      : '先在心里翻译，再显示对照译文';
    var btn = isRu ? '显示俄语' : '显示中文';
    var icon = isRu
      ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.4" stroke="currentColor" stroke-width="1.6"/><path d="m4 4 16 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6.5h16M4 12h10M4 17.5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M17.5 14.2c1.4.8 2.5 1.8 2.5 1.8s-2.7 3.5-6 3.5c-.7 0-1.4-.14-2-.38" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    return '<div class="hide-slot ' + (isRu ? 'ru-hidden' : 'zh-hidden') + '">' +
      '<span class="hide-icon">' + icon + '</span>' +
      '<div class="hide-copy"><strong class="hide-title">' + title + '</strong><p class="hide-sub">' + sub + '</p></div>' +
      '<button type="button" class="reveal-btn" data-reveal="' + kind + '">' + btn + '</button>' +
    '</div>';
  }

  function noteHtml(card) {
    if (!card.note) return '';
    return '<div class="note"><span class="note-label">语法提示</span><p>' + escapeHtml(card.note) + '</p></div>';
  }

  function tagForDisplay(card) {
    var tag = card.tag || '未分类';
    if (state.mode === 'zh' && !state.revealed) {
      return tag.split(' · ')[0] + ' · 回忆模式';
    }
    return tag;
  }

  function render() {
    var deck = state.deck;
    var total = state.visible.length;
    var card = total ? state.visible[state.index] : null;

    $('#deckTag').textContent = (deck.tag ? deck.tag + ' · ' : '') + '共 ' + deck.cards.length + ' 张' +
      (total !== deck.cards.length ? ' · 显示 ' + total + ' 张' : '');
    $('#deckTitle').textContent = deck.title;
    var deckSelect = $('#deckSelect');
    if (deckSelect) deckSelect.value = state.deckId;
    var from = new URLSearchParams(window.location.search).get('from');
    var backLink = $('#backLevelLink');
    if (backLink) {
      backLink.href = from === 'unit'
        ? 'unit.html?deck=' + encodeURIComponent(state.deckId)
        : 'book.html';
      backLink.title = from === 'unit' ? '返回当前单元' : '返回书首页';
    }
    var overviewLink = $('#overviewLink');
    if (overviewLink) overviewLink.href = 'unit.html?deck=' + encodeURIComponent(state.deckId) + '&from=card';
    $('#currentNum').textContent = total ? pad(state.index + 1) : '—';
    $('#totalNum').textContent = pad(total);
    $('#jumpTotal').textContent = total;
    $('#jumpInput').max = Math.max(1, total);
    $('#jumpInput').value = total ? state.index + 1 : '';
    $('#jumpInput').placeholder = total ? '' : '–';
    $('#jumpInput').disabled = total === 0;
    $('#cardTag').textContent = card ? tagForDisplay(card) : '无结果';
    $('#cardIndex').textContent = card ? 'CARD ' + pad(state.index + 1) : '—';
    $('#progressBar').style.width = (total ? ((state.index + 1) / total * 100) : 0) + '%';

    document.querySelectorAll('.mode-switch button').forEach(function (btn) {
      var active = btn.dataset.mode === state.mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    var studyBtn = $('#studyToggle');
    studyBtn.setAttribute('aria-pressed', state.study ? 'true' : 'false');
    studyBtn.title = state.study
      ? '关闭学习模式，恢复显示全部语法'
      : '开启学习模式：默认显示全部语法，开启后点击单词才显示';
    studyBtn.querySelector('.study-label').textContent = state.study ? '学习模式 · 开' : '学习模式';

    $('#editCardBtn').hidden = !card || !state.editEnabled;
    var editToggle = $('#editToggle');
    if (editToggle) editToggle.setAttribute('aria-pressed', state.editEnabled ? 'true' : 'false');
    $('#rehideBtn').hidden = !card || !(state.mode !== 'both' && state.revealed);
    $('#prevBtn').disabled = !total || state.index === 0;
    $('#nextBtn').disabled = !total || state.index === total - 1;

    renderFilterUI();

    if (!card) {
      cardBody.innerHTML = emptyStateHtml();
      cardBody.classList.remove('study-mode');
      saveUI();
      return;
    }

    var body = '';
    var ruVisible = state.mode !== 'zh' || state.revealed;
    if (state.study && ruVisible) {
      body += '<div class="study-banner">学习模式：点击单词查看该词语法' + (card.note ? ' · 语法提示已隐藏' : '') + '</div>';
    }

    if (state.mode === 'zh') {
      body += zhHtml(card, true);
      if (state.revealed) body += ruHtml(card, false);
      else body += hideHtml('ru', card);
    } else {
      body += ruHtml(card, true);
      if (state.mode === 'ru' && !state.revealed) body += hideHtml('zh', card);
      else body += zhHtml(card, false);
    }

    if ((state.mode === 'both' || state.revealed) && !state.study) {
      body += noteHtml(card);
    }
    body += cardActionsHtml(card);

    cardBody.innerHTML = body;
    cardBody.classList.toggle('study-mode', state.study);
    saveUI();
  }

  function goTo(index) {
    var total = state.visible.length;
    if (!total || index < 0 || index >= total || index === state.index) return;
    state.index = index;
    state.revealed = false;
    render();
  }

  function setMode(mode) {
    if (!['both', 'ru', 'zh'].includes(mode)) return;
    state.mode = mode;
    state.revealed = false;
    render();
  }

  function toggleReveal(force) {
    if (state.mode === 'both') return;
    state.revealed = typeof force === 'boolean' ? force : !state.revealed;
    render();
  }

  function toggleStudy() {
    state.study = !state.study;
    render();
    showToast(state.study ? '学习模式已开启：点击单词查看语法' : '学习模式已关闭：显示全部语法');
  }

  function toggleWord(token) {
    if (!state.study) return;
    var revealed = token.classList.toggle('is-revealed');
    token.setAttribute('aria-expanded', revealed ? 'true' : 'false');
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
  }

  function jumpToInput() {
    var n = parseInt($('#jumpInput').value, 10);
    if (isNaN(n)) {
      $('#jumpInput').value = state.index + 1;
      return;
    }
    n = Math.max(1, Math.min(Math.max(1, state.visible.length), n));
    goTo(n - 1);
  }

  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    $('#importError').hidden = true;
    hideImportValidation();
    setTimeout(function () { $('#closeModal').focus(); }, 30);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  var editLastFocus = null;

  function ruWithStress(card) {
    return card.words.map(function (word) {
      if (word.punctOnly) return word.text;
      var text = word.text;
      if (shouldMarkStress(word) && text[word.stress] && text[word.stress].toLowerCase() !== 'ё') {
        text = text.slice(0, word.stress) + '[' + text[word.stress] + ']' + text.slice(word.stress + 1);
      }
      return (word.lead || '') + text + (word.punct || '');
    }).join(' ');
  }

  function closeSourceModal() {
    if (!sourceModal) return;
    sourceModal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function highlightSource(text, needle) {
    var raw = String(text || '');
    var safeNeedle = String(needle || '');
    if (!safeNeedle) return escapeHtml(raw);
    var index = raw.toLowerCase().indexOf(safeNeedle.toLowerCase());
    if (index < 0) return escapeHtml(raw);
    return escapeHtml(raw.slice(0, index)) +
      '<mark class="source-hl">' + escapeHtml(raw.slice(index, index + safeNeedle.length)) + '</mark>' +
      escapeHtml(raw.slice(index + safeNeedle.length));
  }

  function sourceKicker(source) {
    var parts = [];
    if (source.book) parts.push(source.book);
    if (source.unit) parts.push(source.unit);
    return parts.join(' · ');
  }

  function sourceTypeLabel(source) {
    var number = String(source.number || '').replace(/^(课文|对话)\s*/, '');
    return source.kind + (number ? ' ' + number : '');
  }

  function openSourceModal() {
    var card = currentCard();
    if (!card || !sourceModal) return;
    var sources = card.sources || [];
    $('#sourceSub').textContent = card.ru + ' · ' + card.zh;
    var list = $('#sourceList');
    if (!sources.length) {
      list.innerHTML = '<div class="source-empty"><strong>暂无来源</strong>这张卡还没有录入原课文/对话出处。<br>等 PDF 原文整理后，这里会显示书名、课次、对话编号和原文。</div>';
    } else {
      list.innerHTML = sources.map(function (source) {
        var passage = source.quote || source.text || '';
        var full = source.text || '';
        var needle = card.ru;
        return '<article class="source-item">' +
          '<div class="source-kicker"><span class="source-kind">' + escapeHtml(sourceTypeLabel(source)) + '</span>' + escapeHtml(sourceKicker(source)) + '</div>' +
          (source.title ? '<h3 class="source-title">' + escapeHtml(source.title) + '</h3>' : '') +
          (source.page ? '<p class="source-meta">第 ' + escapeHtml(source.page) + ' 页</p>' : '') +
          (source.pdf ? '<a class="source-pdf" target="_blank" rel="noopener" href="' + escapeHtml(source.pdf) + '#page=' + encodeURIComponent(source.pdfPage || '1') + '">查看原 PDF · 第 ' + escapeHtml(source.pdfPage || '1') + ' 页</a>' : '') +
          '<blockquote class="source-text">' + highlightSource(passage, needle) + '</blockquote>' +
          (full && full !== passage ? '<details class="source-more" open><summary>对话 / 全文（OCR 初稿）</summary><blockquote class="source-text full">' + highlightSource(full, needle) + '</blockquote></details>' : '') +
        '</article>';
      }).join('');
    }
    sourceModal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function openEditModal() {
    var card = currentCard();
    if (!card) return;
    if (!state.editEnabled) {
      showToast('请先开启“编辑权限”');
      return;
    }
    editLastFocus = document.activeElement;
    $('#editRu').value = ruWithStress(card);
    $('#editZh').value = card.zh;
    $('#editTag').value = card.tag || '';
    $('#editNote').value = card.note || '';
    $('#editGrammar').value = card.words.filter(function (w) { return !w.punctOnly; }).map(function (w) {
      return w.text + '=' + (w.grammar || []).join(' / ');
    }).join('\n');
    $('#editError').hidden = true;
    editModal.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(function () { $('#editRu').focus(); }, 30);
  }

  function closeEditModal() {
    editModal.hidden = true;
    document.body.classList.remove('modal-open');
    if (editLastFocus && typeof editLastFocus.focus === 'function') editLastFocus.focus();
  }

  function showEditError(message) {
    var box = $('#editError');
    box.textContent = message;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function saveCardEdit() {
    var card = currentCard();
    if (!card) return;
    var ru = $('#editRu').value.trim();
    var zh = $('#editZh').value.trim();
    var tag = $('#editTag').value.trim() || '未分类';
    var note = $('#editNote').value.trim();
    var grammarLines = $('#editGrammar').value.split(/\r?\n/).map(function (line) {
      return line.trim();
    }).filter(Boolean);

    if (!ru || !zh) {
      showEditError('俄语和中文都不能为空。');
      return;
    }

    var tokens = tokenizeRu(ru).filter(function (w) { return !w.punctOnly; });
    if (grammarLines.length && grammarLines.length !== tokens.length) {
      showEditError('语法行数（' + grammarLines.length + '）与俄语单词数（' + tokens.length + '）不一致。请每个词一行。');
      return;
    }

    var groups = grammarLines.map(function (line) {
      var eq = line.indexOf('=');
      var labels = eq >= 0 ? line.slice(eq + 1) : line;
      return splitLabels(labels);
    });

    try {
      var newCard = normalizeCard({
        id: card.id,
        ru: ru,
        zh: zh,
        tag: tag,
        note: note,
        sources: card.sources || [],
        grammar: groups
      }, state.deck.cards.indexOf(card));

      var oldKey = cardKey(card);
      var newKey = cardKey(newCard);
      var index = state.deck.cards.indexOf(card);
      state.deck.cards[index] = newCard;

      if (oldKey !== newKey && state.progress[oldKey]) {
        state.progress[newKey] = state.progress[oldKey];
        delete state.progress[oldKey];
        saveProgress();
      }

      var missing = newCard.words.filter(function (w) {
        return !w.punctOnly && (!w.grammar || !w.grammar.length);
      }).length;

      saveDecks();
      rebuildCategoryOptions();
      refreshVisible({ preferredKey: newKey, fallbackIndex: state.index });
      closeEditModal();
      render();
      showToast(missing ? '卡片已保存；有 ' + missing + ' 个词未标语法' : '卡片已保存');
    } catch (err) {
      showEditError(err && err.message ? err.message : '保存失败，请检查内容。');
    }
  }

  function switchTab(tab) {
    state.importTab = tab;
    document.querySelectorAll('.tab').forEach(function (btn) {
      var active = btn.dataset.tab === tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.dataset.panel === tab);
    });
    $('#importError').hidden = true;
    hideImportValidation();
  }

  function showImportError(message) {
    var box = $('#importError');
    box.textContent = message;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function parseTable(text) {
    var cards = [];
    var errors = [];
    var lines = String(text).split(/\r?\n/);
    lines.forEach(function (line, i) {
      var raw = line.trim();
      if (!raw || raw.charAt(0) === '#') return;
      if (i === 0 && raw.indexOf('俄语') !== -1 && raw.indexOf('中文') !== -1) return;
      var parts = line.split('\t');
      if (parts.length < 2) {
        errors.push('第 ' + (i + 1) + ' 行：缺少 Tab 分隔');
        return;
      }
      var ru = parts[0].trim();
      var zh = parts[1].trim();
      var grammarRaw = (parts[2] || '').trim();
      if (!ru || !zh) {
        errors.push('第 ' + (i + 1) + ' 行：俄语或中文为空');
        return;
      }
      cards.push({
        ru: ru,
        zh: zh,
        tag: '导入',
        grammar: grammarRaw ? grammarRaw.split('|').map(function (g) { return g.trim(); }).filter(Boolean) : []
      });
    });
    if (!cards.length) {
      throw new Error('没有识别到有效卡片。' + (errors.length ? '\n' + errors.slice(0, 4).join('\n') : ''));
    }
    return { cards: cards, errors: errors };
  }

  function detectType(text) {
    var trimmed = String(text).trim();
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') return 'json';
    return 'table';
  }

  function countVowels(text) {
    var count = 0;
    for (var i = 0; i < text.length; i++) {
      if (VOWELS.indexOf(text[i]) !== -1) count++;
    }
    return count;
  }

  function hideImportValidation() {
    var box = $('#importValidation');
    if (box) box.hidden = true;
  }

  function showImportValidation(parsed, warnings) {
    var box = $('#importValidation');
    if (!box) return;
    var total = parsed.cards.length;
    var missingGrammar = 0;
    var missingStress = 0;
    var keyCounts = {};
    parsed.cards.forEach(function (card) {
      var key = cardKey(card);
      keyCounts[key] = (keyCounts[key] || 0) + 1;
      card.words.forEach(function (word) {
        if (word.punctOnly) return;
        if (!word.grammar || !word.grammar.length) missingGrammar++;
        if (countVowels(word.text) > 1 && !Number.isInteger(word.stress)) missingStress++;
      });
    });

    var modeEl = document.querySelector('input[name="importMode"]:checked');
    var mode = modeEl ? modeEl.value : 'append';
    var duplicates = 0;
    var existing = {};
    if (mode === 'append') {
      state.deck.cards.forEach(function (card) { existing[cardKey(card)] = 1; });
    }
    Object.keys(keyCounts).forEach(function (key) {
      if (keyCounts[key] > 1) duplicates += keyCounts[key] - 1;
      else if (mode === 'append' && existing[key]) duplicates++;
    });

    var items = [];
    if (missingGrammar) items.push('<li class="warn">' + missingGrammar + ' 个词没有语法标注</li>');
    if (missingStress) items.push('<li class="warn">' + missingStress + ' 个多音节词没有标重音</li>');
    if (duplicates) items.push('<li class="warn">' + duplicates + ' 张卡片与现有课程或本批内容重复</li>');
    if (warnings && warnings.length) {
      warnings.slice(0, 4).forEach(function (message) {
        items.push('<li class="warn">' + escapeHtml(message) + '</li>');
      });
      if (warnings.length > 4) items.push('<li class="warn">还有 ' + (warnings.length - 4) + ' 条提示未显示</li>');
    }
    if (!items.length) items.push('<li class="ok">✓ 校验通过，可以导入。</li>');

    box.innerHTML = '<strong>校验结果：' + total + ' 张</strong>' +
      '<ul>' + items.join('') + '</ul>';
    box.hidden = false;
    $('#importError').hidden = true;
  }

  function readImportPayload() {
    var text = '';
    if (state.importTab === 'table') text = $('#tableInput').value.trim();
    else if (state.importTab === 'json') text = $('#jsonInput').value.trim();
    else text = state.fileText.trim();

    if (!text) {
      throw new Error(state.importTab === 'file' ? '请先选择文件。' : '请先粘贴内容。');
    }

    var type = state.importTab === 'file' ? (state.fileType === 'json' ? 'json' : detectType(text)) : state.importTab;
    var parsed;
    var warnings = [];

    if (type === 'json') {
      parsed = normalizeDeck(JSON.parse(text));
      warnings = parsed.warnings || [];
    } else {
      var table = parseTable(text);
      warnings = table.errors || [];
      parsed = normalizeDeck({
        title: '我的俄汉卡片',
        subtitle: '导入内容',
        tag: '导入',
        cards: table.cards
      });
      warnings = warnings.concat(parsed.warnings || []);
    }
    return { parsed: parsed, warnings: warnings, type: type };
  }

  function validateImport() {
    try {
      var payload = readImportPayload();
      showImportValidation(payload.parsed, payload.warnings);
    } catch (err) {
      showImportError(err && err.message ? err.message : '校验失败，请检查格式。');
    }
  }

  function importCurrent() {
    try {
      var payload = readImportPayload();
      var parsed = payload.parsed;
      var warnings = payload.warnings;

      var modeEl = document.querySelector('input[name="importMode"]:checked');
      var mode = modeEl ? modeEl.value : 'append';
      var targetKey = parsed.cards.length ? cardKey(parsed.cards[0]) : '';

      if (mode === 'new') {
        var newTitle = $('#newDeckTitle').value.trim() || parsed.title || '新课程';
        parsed.id = 'deck-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 5);
        parsed.title = newTitle;
        parsed.tag = parsed.tag || '自定义';
        state.decks.push(parsed);
        state.deckId = parsed.id;
        state.deck = parsed;
      } else if (mode === 'replace') {
        parsed.id = state.deck.id;
        for (var di = 0; di < state.decks.length; di++) {
          if (state.decks[di].id === state.deckId) state.decks[di] = parsed;
        }
        state.deck = parsed;
      } else {
        state.deck.cards = state.deck.cards.concat(parsed.cards);
        state.deck.subtitle = state.deck.cards.length + ' 张卡片';
      }

      state.filter = 'all';
      state.type = 'all';
      state.query = '';
      state.onlyReview = false;
      state.dueOnly = false;
    state.dueOnly = false;
      state.random = false;
      var search = $('#searchInput');
      if (search) search.value = '';
      renderDeckOptions();
      rebuildCategoryOptions();
      refreshVisible({ preferredKey: targetKey, fallbackIndex: 0 });
      state.revealed = false;
      saveDeck();
      closeModal();
      render();

      var message = '已导入 ' + parsed.cards.length + ' 张卡片';
      if (warnings.length) message += '；' + warnings.slice(0, 2).join('；');
      showToast(message);

      if (state.importTab === 'table') $('#tableInput').value = '';
      if (state.importTab === 'json') $('#jsonInput').value = '';
    } catch (err) {
      showImportError(err && err.message ? err.message : '导入失败，请检查格式。');
    }
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportDeck() {
    var data = {
      title: state.deck.title,
      subtitle: state.deck.subtitle,
      tag: state.deck.tag,
      cards: state.deck.cards.map(function (card) {
        return {
          ru: card.ru,
          zh: card.zh,
          tag: card.tag,
          type: card.type,
          note: card.note,
          sources: card.sources || [],
          words: card.words.map(function (w) {
            return { text: w.text, stress: w.stress, grammar: w.grammar, punct: w.punct, lead: w.lead };
          })
        };
      })
    };
    download('俄汉卡片-导出.json', JSON.stringify(data, null, 2), 'application/json');
    showToast('已导出当前 ' + state.deck.cards.length + ' 张卡片');
  }

  function exportBackup() {
    var data = {
      format: 'ru-zh-cards-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      activeDeckId: state.deckId,
      decks: state.decks.map(deckPayload),
      progress: state.progress,
      schedule: state.schedule
    };
    download('俄汉卡片-完整备份.json', JSON.stringify(data, null, 2), 'application/json');
    showToast('已导出完整备份（含全部课程与进度）');
  }

  function restoreBackupData(data) {
    if (!data || !Array.isArray(data.decks) || !data.decks.length) {
      throw new Error('不是有效的备份文件：缺少 decks 数组。');
    }
    var decks = data.decks.map(function (deck) { return normalizeDeck(deck); });
    if (!decks.length) throw new Error('备份中没有有效课程。');

    var progress = {};
    if (data.progress && typeof data.progress === 'object' && !Array.isArray(data.progress)) {
      Object.keys(data.progress).forEach(function (key) {
        if (data.progress[key] === 'mastered' || data.progress[key] === 'review') progress[key] = data.progress[key];
      });
    }

    var schedule = {};
    if (data.schedule && typeof data.schedule === 'object' && !Array.isArray(data.schedule)) {
      Object.keys(data.schedule).forEach(function (key) {
        var item = data.schedule[key];
        if (item && typeof item.due === 'string') {
          schedule[key] = {
            due: item.due,
            interval: Number(item.interval) || 1,
            lapses: Number(item.lapses) || 0
          };
        }
      });
    }

    state.decks = decks;
    state.progress = progress;
    state.schedule = schedule;
    state.lastCards = {};
    var current = decks[0];
    for (var i = 0; i < decks.length; i++) {
      if (decks[i].id === data.activeDeckId) { current = decks[i]; break; }
    }
    state.deck = current;
    state.deckId = current.id;
    state.filter = 'all';
    state.type = 'all';
    state.query = '';
    state.onlyReview = false;
    state.dueOnly = false;
    state.random = false;
    state.revealed = false;
    var search = $('#searchInput');
    if (search) search.value = '';
    saveProgress();
    saveSchedule();
    saveDecks();
    renderDeckOptions();
    rebuildCategoryOptions();
    refreshVisible({ fallbackIndex: 0 });
    state.index = 0;
    render();
    showToast('备份已恢复：' + decks.length + ' 个课程');
  }

  function restoreBackupFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result || ''));
        if (!window.confirm('恢复备份会覆盖当前全部课程和学习进度，继续？')) return;
        restoreBackupData(data);
        closeModal();
      } catch (err) {
        showImportError(err && err.message ? err.message : '备份文件读取失败。');
      }
    };
    reader.onerror = function () { showImportError('备份文件读取失败。'); };
    reader.readAsText(file, 'utf-8');
  }

  function downloadTemplate() {
    var rows = [
      '# 每行一张卡片：俄语<TAB>中文<TAB>逐词语法（可选）<TAB>类型（词组/句子，可留空）',
      '# 重音用方括号标出，例如 чит[а]ет；ё 自带重音。',
      '# 语法用 | 分隔不同单词，用 / 分隔同一个词的多个标签。',
      '# 俄语\t中文\t逐词语法',
      'высокоскоростн[о]й п[о]езд\t高铁\t形容词 · 阳性单数 · 主格|名词 · 阳性单数 · 主格',
      'сал[о]н красот[ы]\t美容院\t名词 · 阳性单数 · 主格|名词 · 阴性单数 · 属格',
      'мен[я] ук[а]чивает\t我晕车\t代词 · 第一人称 · 宾格|动词 · 未完成体 · 现在时 · 第三人称单数'
    ];
    download('俄汉卡片导入模板.tsv', '\uFEFF' + rows.join('\r\n'), 'text/tab-separated-values');
  }

  function resetDeck() {
    var builtin = builtinDeckById(state.deckId);
    if (!builtin) {
      showToast('当前课程是导入课程，没有内置版本可恢复');
      return;
    }
    if (!window.confirm('恢复当前课程的内置词表？导入的卡片会被替换。')) return;
    for (var i = 0; i < state.decks.length; i++) {
      if (state.decks[i].id === state.deckId) state.decks[i] = builtin;
    }
    state.deck = builtin;
    state.filter = 'all';
    state.type = 'all';
    state.query = '';
    state.onlyReview = false;
    state.dueOnly = false;
    state.random = false;
    var search = $('#searchInput');
    if (search) search.value = '';
    renderDeckOptions();
    rebuildCategoryOptions();
    refreshVisible({ fallbackIndex: 0 });
    state.index = 0;
    state.revealed = false;
    state.study = false;
    saveDeck();
    closeModal();
    render();
    showToast('已恢复当前课程的内置词表');
  }

  function renameDeck() {
    var name = window.prompt('新的课程名称：', state.deck.title);
    if (name === null) return;
    name = name.trim();
    if (!name) return;
    state.deck.title = name;
    saveDeck();
    renderDeckOptions();
    render();
    showToast('课程已重命名');
  }

  function deleteDeck() {
    if (state.decks.length <= 1) {
      showToast('至少保留一个课程，不能删除');
      return;
    }
    if (!window.confirm('删除当前课程“' + state.deck.title + '”？此操作不会删除学习进度记录。')) return;
    state.decks = state.decks.filter(function (deck) { return deck.id !== state.deckId; });
    state.deckId = state.decks[0].id;
    state.deck = state.decks[0];
    state.filter = 'all';
    state.type = 'all';
    state.query = '';
    state.onlyReview = false;
    state.dueOnly = false;
    state.random = false;
    var search = $('#searchInput');
    if (search) search.value = '';
    renderDeckOptions();
    rebuildCategoryOptions();
    refreshVisible({ preferredKey: state.lastCards[state.deckId] || '', fallbackIndex: 0 });
    state.revealed = false;
    saveDeck();
    closeModal();
    render();
    showToast('课程已删除，已切换到：' + state.deck.title);
  }

  function clearAllProgress() {
    if (!window.confirm('清除全部“已掌握 / 需复习”标记？此操作不可撤销。')) return;
    state.progress = {};
    state.schedule = {};
    saveProgress();
    saveSchedule();
    refreshVisible({ fallbackIndex: 0 });
    render();
    showToast('已清除全部学习进度');
  }

  function readFile(file) {
    if (!file) return;
    state.fileName = file.name;
    state.fileText = '';
    state.fileType = /\.json$/i.test(file.name) ? 'json' : 'auto';
    $('#fileName').textContent = file.name + ' · ' + Math.max(1, Math.round(file.size / 1024)) + ' KB';
    var reader = new FileReader();
    reader.onload = function () {
      state.fileText = String(reader.result || '');
      $('#importError').hidden = true;
      hideImportValidation();
    };
    reader.onerror = function () {
      showImportError('文件读取失败，请重试。');
    };
    reader.readAsText(file, 'utf-8');
  }

  document.querySelectorAll('.mode-switch button').forEach(function (btn) {
    btn.addEventListener('click', function () { setMode(btn.dataset.mode); });
  });

  $('#studyToggle').addEventListener('click', toggleStudy);
  $('#importBtn').addEventListener('click', openModal);
  $('#closeModal').addEventListener('click', closeModal);
  var editToggle = $('#editToggle');
  if (editToggle) {
    editToggle.addEventListener('click', function () {
      state.editEnabled = !state.editEnabled;
      saveUI();
      render();
      showToast(state.editEnabled ? '编辑权限已开启' : '编辑权限已关闭');
    });
  }
  $('#editCardBtn').addEventListener('click', openEditModal);
  $('#sourceBtn').addEventListener('click', openSourceModal);
  $('#closeSourceModal').addEventListener('click', closeSourceModal);
  document.querySelectorAll('[data-close-source]').forEach(function (el) {
    el.addEventListener('click', closeSourceModal);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && sourceModal && !sourceModal.hidden) {
      closeSourceModal();
    }
  });
  $('#closeEditModal').addEventListener('click', closeEditModal);
  $('#saveCardBtn').addEventListener('click', saveCardEdit);
  $('#importConfirm').addEventListener('click', importCurrent);  $('#validateImportBtn').addEventListener('click', validateImport);
  $('#templateBtn').addEventListener('click', downloadTemplate);
  $('#exportBtn').addEventListener('click', exportDeck);
  $('#resetBtn').addEventListener('click', resetDeck);
  $('#backupBtn').addEventListener('click', exportBackup);
  $('#restoreBackupBtn').addEventListener('click', function () { $('#backupFileInput').click(); });
  $('#backupFileInput').addEventListener('change', function (event) {
    restoreBackupFile(event.target.files && event.target.files[0]);
    event.target.value = '';
  });
  $('#clearProgressBtn').addEventListener('click', clearAllProgress);
  $('#renameDeckBtn').addEventListener('click', renameDeck);
  $('#deleteDeckBtn').addEventListener('click', deleteDeck);

  $('#deckSelect').addEventListener('change', function () {
    switchDeck(this.value);
  });

  document.querySelectorAll('input[name="importMode"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      var field = $('#newDeckField');
      if (field) field.hidden = this.value !== 'new';
    });
  });
  $('#categorySelect').addEventListener('change', function () {
    state.filter = this.value;
    refreshVisible({ fallbackIndex: 0 });
    render();
  });
  var searchInput = $('#searchInput');
  var searchTimer = null;
  searchInput.addEventListener('input', function () {
    var value = this.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.query = value;
      refreshVisible({ fallbackIndex: 0 });
      render();
    }, 140);
  });

  $('#randomBtn').addEventListener('click', function () {
    var key = currentCard() ? cardKey(currentCard()) : '';
    state.random = !state.random;
    refreshVisible({ preferredKey: key, fallbackIndex: state.index });
    render();
    showToast(state.random ? '已开启随机顺序' : '已恢复原有顺序');
  });

  $('#dueBtn').addEventListener('click', function () {
    state.dueOnly = !state.dueOnly;
    if (state.dueOnly) state.onlyReview = false;
    refreshVisible({ fallbackIndex: 0 });
    render();
    showToast(state.dueOnly ? '只显示今天到期需要复习的卡片' : '已显示全部卡片');
  });

  $('#reviewBtn').addEventListener('click', function () {
    state.onlyReview = !state.onlyReview;
    if (state.onlyReview) state.dueOnly = false;
    refreshVisible({ fallbackIndex: 0 });
    render();
    showToast(state.onlyReview ? '错题本：只显示标记为“需复习”的卡片' : '已显示全部卡片');
  });

  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
  });

  $('#tableInput').addEventListener('input', hideImportValidation);
  $('#jsonInput').addEventListener('input', hideImportValidation);

  $('#fileInput').addEventListener('change', function (event) {
    readFile(event.target.files && event.target.files[0]);
  });

  var dropZone = $('#dropZone');
  ['dragenter', 'dragover'].forEach(function (type) {
    dropZone.addEventListener(type, function (event) {
      event.preventDefault();
      dropZone.classList.add('is-drag');
    });
  });
  ['dragleave', 'drop'].forEach(function (type) {
    dropZone.addEventListener(type, function (event) {
      event.preventDefault();
      dropZone.classList.remove('is-drag');
    });
  });
  dropZone.addEventListener('drop', function (event) {
    var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) readFile(file);
  });

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-close-modal]')) {
      closeModal();
      return;
    }
    if (event.target.closest('[data-close-edit]')) {
      closeEditModal();
      return;
    }
    if (event.target.closest('#rehideBtn')) {
      toggleReveal(false);
      return;
    }
    if (event.target.closest('[data-reveal]')) {
      toggleReveal(true);
      return;
    }
    if (event.target.closest('[data-clear-filters]')) {
      clearFilters();
      return;
    }
    if (event.target.closest('#prevBtn')) {
      goTo(state.index - 1);
      return;
    }
    if (event.target.closest('#nextBtn')) {
      goTo(state.index + 1);
      return;
    }
  });

  cardBody.addEventListener('click', function (event) {
    var mark = event.target.closest('[data-mark]');
    if (mark) {
      event.preventDefault();
      markCard(mark.dataset.mark);
      return;
    }
    var token = event.target.closest('.token[data-word-index]');
    if (!token) return;
    event.preventDefault();
    toggleWord(token);
  });

  cardBody.addEventListener('keydown', function (event) {
    var token = event.target.closest('.token[data-word-index]');
    if (!token) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      event.stopPropagation();
      toggleWord(token);
    }
  });

  $('#jumpInput').addEventListener('change', jumpToInput);
  $('#jumpInput').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      jumpToInput();
      $('#jumpInput').blur();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (!modal.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key === 'Tab') {
        var focusable = Array.prototype.slice.call(modal.querySelectorAll(
          'button:not([disabled]), [href], input:not([hidden]), textarea, select, [tabindex]:not([tabindex="-1"])'
        )).filter(function (el) { return el.offsetParent !== null; });
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }

    if (!editModal.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeEditModal();
        return;
      }
      if (event.key === 'Tab') {
        var editFocusable = Array.prototype.slice.call(editModal.querySelectorAll(
          'button:not([disabled]), [href], input:not([hidden]), textarea, select, [tabindex]:not([tabindex="-1"])'
        )).filter(function (el) { return el.offsetParent !== null; });
        if (!editFocusable.length) return;
        var editFirst = editFocusable[0];
        var editLast = editFocusable[editFocusable.length - 1];
        if (event.shiftKey && document.activeElement === editFirst) {
          event.preventDefault();
          editLast.focus();
        } else if (!event.shiftKey && document.activeElement === editLast) {
          event.preventDefault();
          editFirst.focus();
        }
      }
      return;
    }

    var tag = (event.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || event.target.isContentEditable) return;
    if (event.target.closest('button, a, [role="button"]')) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(state.index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(state.index + 1);
    } else if (event.key === ' ' || event.key === 'Spacebar') {
      if (state.mode !== 'both') {
        event.preventDefault();
        toggleReveal();
      }
    } else if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      toggleStudy();
    }
  });

  var touchStartX = null;
  var touchStartY = null;
  $('#card').addEventListener('touchstart', function (event) {
    if (!event.touches || !event.touches.length) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });
  $('#card').addEventListener('touchend', function (event) {
    if (touchStartX === null || !event.changedTouches || !event.changedTouches.length) return;
    var dx = event.changedTouches[0].clientX - touchStartX;
    var dy = event.changedTouches[0].clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;
    if (Math.abs(dx) > 52 && Math.abs(dy) < 42) {
      goTo(state.index + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });

  function init() {
    try {
      state.decks = loadDecks();
      state.progress = loadProgress();
      state.schedule = loadSchedule();
      var ui = loadUI();
      state.lastCards = (ui.lastCards && typeof ui.lastCards === 'object') ? ui.lastCards : {};

      var params = new URLSearchParams(window.location.search);
      var deckParam = params.get('deck');
      var wantedDeck = state.decks[0];
      if (ui.deckId) {
        for (var di = 0; di < state.decks.length; di++) {
          if (state.decks[di].id === ui.deckId) { wantedDeck = state.decks[di]; break; }
        }
      }
      if (deckParam) {
        for (var dj = 0; dj < state.decks.length; dj++) {
          if (state.decks[dj].id === deckParam) { wantedDeck = state.decks[dj]; break; }
        }
      }
      state.deck = wantedDeck;
      state.deckId = wantedDeck.id;
      if (params.get('plan') === '1') {
        var planDeck = loadPlanDeck();
        if (planDeck) {
          state.decks.unshift(planDeck);
          state.deck = planDeck;
          state.deckId = 'plan';
        }
      }
      if (ui.lastCard && !state.lastCards[state.deckId]) state.lastCards[state.deckId] = ui.lastCard;

      if (['both', 'ru', 'zh'].includes(ui.mode)) state.mode = ui.mode;
      state.study = !!ui.study;
      state.editEnabled = !!ui.editEnabled;
      if (typeof ui.filter === 'string') state.filter = ui.filter;
      if (['all', 'phrase', 'sentence'].includes(ui.type)) state.type = ui.type;
      state.random = !!ui.random;
      state.onlyReview = !!ui.onlyReview;
      state.dueOnly = !!ui.dueOnly;

      var mode = params.get('mode');
      if (['both', 'ru', 'zh'].includes(mode)) state.mode = mode;
      if (params.has('study')) state.study = params.get('study') === '1';
      if (params.get('filter')) state.filter = params.get('filter');
      var typeParam = params.get('type');
      if (['all', 'phrase', 'sentence'].includes(typeParam)) state.type = typeParam;
      if (params.get('q')) state.query = params.get('q');
      if (params.get('review') === '1') state.onlyReview = true;
      if (params.get('edit') === '1' || params.get('editSave') === '1') state.editEnabled = true;
      if (params.get('due') === '1') state.dueOnly = true;
      if (params.get('random') === '1') state.random = true;

      var cardParam = parseInt(params.get('card'), 10);
      if (!isNaN(cardParam)) {
        state.filter = params.get('filter') || 'all';
        state.type = params.get('type') || 'all';
        state.query = params.get('q') || '';
        state.onlyReview = params.get('review') === '1';
        state.random = params.get('random') === '1';
      }

      if (params.get('clearProgress') === '1') {
        state.progress = {};
        saveProgress();
      }

      var markParam = params.get('mark');
      if ((markParam === 'mastered' || markParam === 'review') && !isNaN(cardParam)) {
        var preCard = state.deck.cards[cardParam - 1];
        if (preCard) {
          var preKey = cardKey(preCard);
          state.progress[preKey] = markParam;
          if (markParam === 'review') {
            state.schedule[preKey] = { due: todayKey(), interval: 1, lapses: 1 };
          } else {
            state.schedule[preKey] = { due: addDaysKey(7), interval: 7, lapses: 0 };
          }
          saveProgress();
          saveSchedule();
        }
      }

      renderDeckOptions();
      rebuildCategoryOptions();
      var preferred = !isNaN(cardParam) ? '' : (state.lastCards[state.deckId] || ui.lastCard || '');
      refreshVisible({ preferredKey: preferred, fallbackIndex: 0 });
      if (!isNaN(cardParam)) {
        state.index = Math.max(0, Math.min(state.visible.length - 1, cardParam - 1));
      }

      state.revealed = params.get('reveal') === '1' && state.mode !== 'both';
      var search = $('#searchInput');
      if (search) search.value = state.query;
      render();

      if (params.get('word') !== null) {
        var wordIndex = parseInt(params.get('word'), 10);
        var token = cardBody.querySelector('.token[data-word-index="' + wordIndex + '"]');
        if (token) {
          token.classList.add('is-revealed');
          token.setAttribute('aria-expanded', 'true');
        }
      }
      if (params.get('import') === '1') openModal();
      if (params.get('edit') === '1') openEditModal();
      if (params.get('source') === '1') openSourceModal();
      if (params.get('editSave') === '1') {
        openEditModal();
        $('#editNote').value = '编辑测试';
        saveCardEdit();
      }
      if (params.get('validate') === '1') {
        openModal();
        switchTab('table');
        $('#tableInput').value = 'тест\t测试\t名词 · 阳性单数 · 主格\t词组\nтест\t测试\t名词 · 阳性单数 · 主格\t词组';
        validateImport();
      }
    } catch (err) {
      cardBody.innerHTML = '<div class="fatal-error"><strong>程序启动失败</strong><p>' +
        escapeHtml(err && err.message ? err.message : String(err)) +
        '</p><p>请确认 data/deck.js 与 app.js 在同一目录下。</p></div>';
      showToast('程序启动失败，请查看页面提示');
    }
  }

  init();
})();
