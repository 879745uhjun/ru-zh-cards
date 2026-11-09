(function () {
  'use strict';

  var DECKS_KEY = 'ru-zh-cards-decks-v0.3';

  function cleanRu(text) {
    return String(text == null ? '' : text).replace(/\[([А-Яа-яЁё])\]/g, '$1');
  }

  function cardKey(card) {
    return cleanRu(card && card.ru) + '\u0001' + String((card && card.zh) || '');
  }

  function builtinList() {
    var list = [];
    if (window.RU_ZH_LESSON1) list.push(Object.assign({ id: 'lesson1' }, window.RU_ZH_LESSON1));
    if (window.RU_ZH_LESSON2) list.push(Object.assign({ id: 'lesson2' }, window.RU_ZH_LESSON2));
    if (window.RU_ZH_LESSON3) list.push(Object.assign({ id: 'lesson3' }, window.RU_ZH_LESSON3));
    if (window.RU_ZH_DECK) list.push(Object.assign({ id: 'lesson4' }, window.RU_ZH_DECK));
    if (window.RU_ZH_LESSON5) list.push(Object.assign({ id: 'lesson5' }, window.RU_ZH_LESSON5));
    if (window.RU_ZH_LESSON6) list.push(Object.assign({ id: 'lesson6' }, window.RU_ZH_LESSON6));
    return list;
  }

  function readSaved() {
    try {
      var raw = localStorage.getItem(DECKS_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function normalizeCard(card) {
    if (!card || typeof card !== 'object') return null;
    var words = Array.isArray(card.words) ? card.words : null;
    var ru = words ? cleanRu(card.ru || '') : String(card.ru || '');
    if (!ru && words) ru = words.map(function (w) { return (w.lead || '') + (w.text || '') + (w.punct || ''); }).join(' ');
    return {
      ru: ru,
      zh: String(card.zh || ''),
      tag: String(card.tag || '未分类'),
      note: String(card.note || ''),
      grammar: Array.isArray(card.grammar) ? card.grammar : null,
      ruVariants: Array.isArray(card.ruVariants) ? card.ruVariants : null,
      words: words
    };
  }

  function load() {
    var deleted = {};
    try {
      deleted = JSON.parse(localStorage.getItem('ru-zh-cards-deleted-v1') || '{}') || {};
    } catch (err) { deleted = {}; }
    var builtins = builtinList().filter(function (deck) { return !deleted[deck.id]; });
    var saved = readSaved();
    var savedById = {};
    saved.forEach(function (deck) {
      if (deck && deck.id && deck.id !== 'plan' && Array.isArray(deck.cards)) savedById[deck.id] = deck;
    });
    var result = builtins.filter(function (builtin) { return !deleted[builtin.id]; }).map(function (builtin) {
      var source = savedById[builtin.id] || builtin;
      var title = source.title || builtin.title || '未命名单元';
      if (builtin.id === 'lesson4' && title === '旅游与城市') title = '第 4 课 · 旅游与城市';
      var subtitle = source.subtitle || builtin.subtitle || '';
      if (builtin.id === 'lesson4' && subtitle === 'Урок 4 · 第 4 课词汇') subtitle = 'Урок 4 · 词汇 + 句子';
      return {
        id: builtin.id,
        title: title,
        subtitle: subtitle,
        tag: source.tag || builtin.tag || '课程',
        cards: (source.cards || []).map(normalizeCard).filter(Boolean)
      };
    });
    saved.forEach(function (deck) {
      if (!deck || !deck.id || deck.id === 'plan' || !Array.isArray(deck.cards)) return;
      if (result.some(function (d) { return d.id === deck.id; })) return;
      result.push({
        id: deck.id,
        title: deck.title || '导入课程',
        subtitle: deck.subtitle || '',
        tag: deck.tag || '课程',
        cards: deck.cards.map(normalizeCard).filter(Boolean)
      });
    });
    return result;
  }

  window.RU_ZH_DECKS_SOURCE = {
    load: load,
    cleanRu: cleanRu,
    cardKey: cardKey
  };
})();
