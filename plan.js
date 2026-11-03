(function () {
  'use strict';

  var PLAN_KEY = 'ru-zh-cards-plan-v1';
  var DECKS_KEY = 'ru-zh-cards-decks-v0.3';
  var PROGRESS_KEY = 'ru-zh-cards-progress-v0.2';
  var SCHEDULE_KEY = 'ru-zh-cards-schedule-v0.3';

  var BUILTINS = [];
  if (window.RU_ZH_LESSON1) BUILTINS.push(Object.assign({ id: 'lesson1' }, window.RU_ZH_LESSON1));
  if (window.RU_ZH_LESSON2) BUILTINS.push(Object.assign({ id: 'lesson2' }, window.RU_ZH_LESSON2));
  if (window.RU_ZH_LESSON3) BUILTINS.push(Object.assign({ id: 'lesson3' }, window.RU_ZH_LESSON3));
  if (window.RU_ZH_DECK) BUILTINS.push(Object.assign({ id: 'lesson4' }, window.RU_ZH_DECK));
  if (window.RU_ZH_LESSON5) BUILTINS.push(Object.assign({ id: 'lesson5' }, window.RU_ZH_LESSON5));

  var unitList = document.getElementById('unitList');
  var planCount = document.getElementById('planCount');
  var planHint = document.getElementById('planHint');
  var startBtn = document.getElementById('startBtn');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.plan-tab'));

  var decks = [];
  var mode = 'sequential';
  var modeParam = new URLSearchParams(location.search).get('mode');
  if (modeParam === 'sequential' || modeParam === 'custom' || modeParam === 'review') mode = modeParam;
  var selectedUnits = {};
  var selectedCards = {};
  var progress = {};
  var schedule = {};

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) { return fallback; }
  }

  function cardKey(card) {
    return cleanRu(card.ru) + '\u0001' + String(card.zh || '');
  }

  function deckKey(deckId, card) {
    return deckId + '\u0002' + cardKey(card);
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
    });
  }

  function cleanRu(text) {
    return String(text || '').replace(/\[([А-Яа-яЁё])\]/g, '$1');
  }

  function unitTitle(deck, index) {
    var title = deck.title || '未命名单元';
    if (/^lesson\d+$/.test(deck.id) && !/^第\s*\d+\s*课/.test(title)) {
      title = '第 ' + (index + 1) + ' 课 · ' + title;
    }
    return title;
  }

  function loadDecks() {
    if (window.RU_ZH_DECKS_SOURCE) return window.RU_ZH_DECKS_SOURCE.load();
    var saved = readJson(DECKS_KEY, []);
    var savedById = {};
    if (Array.isArray(saved)) {
      saved.forEach(function (deck) {
        if (deck && deck.id && deck.id !== 'plan' && Array.isArray(deck.cards)) savedById[deck.id] = deck;
      });
    }
    var result = BUILTINS.map(function (builtin) {
      if (savedById[builtin.id]) {
        return Object.assign({}, builtin, {
          title: savedById[builtin.id].title || builtin.title,
          subtitle: savedById[builtin.id].subtitle || builtin.subtitle,
          tag: savedById[builtin.id].tag || builtin.tag,
          cards: savedById[builtin.id].cards
        });
      }
      return builtin;
    });
    if (Array.isArray(saved)) {
      saved.forEach(function (deck) {
        if (!deck || !deck.id || deck.id === 'plan' || !Array.isArray(deck.cards)) return;
        if (!result.some(function (d) { return d.id === deck.id; })) result.push(deck);
      });
    }
    return result;
  }

  function currentReviewCount(deck) {
    return deck.cards.filter(isReviewCard).length;
  }

  function isReviewCard(card) {
    if (progress[cardKey(card)] === 'review') return true;
    var item = schedule[cardKey(card)];
    return !!(item && item.due && item.due <= todayKey());
  }

  function initSelection() {
    selectedUnits = {};
    selectedCards = {};
    decks.forEach(function (deck) {
      selectedUnits[deck.id] = true;
      deck.cards.forEach(function (card) {
        selectedCards[deckKey(deck.id, card)] = true;
      });
    });
  }

  function renderUnits() {
    document.body.className = 'mode-' + mode;
    unitList.innerHTML = decks.map(function (deck, deckIndex) {
      var reviewCount = currentReviewCount(deck);
      var cards = deck.cards.map(function (card, index) {
        var checked = selectedCards[deckKey(deck.id, card)] ? ' checked' : '';
        return '<label class="plan-card-check"><input type="checkbox" class="card-check" data-deck="' + escapeHtml(deck.id) + '" data-card="' + index + '"' + checked + '>' +
          '<span><span class="plan-card-ru">' + escapeHtml(cleanRu(card.ru)) + '</span><span class="plan-card-zh">' + escapeHtml(card.zh) + '</span></span></label>';
      }).join('');
      return '<section class="plan-unit" data-deck="' + escapeHtml(deck.id) + '">' +
        '<div class="plan-unit-head">' +
          '<label class="plan-unit-check"><input type="checkbox" class="unit-check" data-deck="' + escapeHtml(deck.id) + '">' +
            '<span><span class="plan-unit-title">' + escapeHtml(unitTitle(deck, deckIndex)) + '</span><span class="plan-unit-sub">' + escapeHtml(deck.subtitle || '') + '</span></span>' +
          '</label>' +
          '<span class="plan-unit-count">' + deck.cards.length + ' 张</span>' +
          '<span class="review-pill' + (reviewCount ? '' : ' zero') + '">需复习 ' + reviewCount + '</span>' +
        '</div>' +
        '<div class="plan-cards">' + cards + '</div>' +
      '</section>';
    }).join('');
    updateUnitChecks();
    updateSummary();
  }

  function updateUnitChecks() {
    decks.forEach(function (deck) {
      var box = unitList.querySelector('.unit-check[data-deck="' + cssEscape(deck.id) + '"]');
      if (!box) return;
      if (mode === 'custom') {
        var selected = deck.cards.filter(function (card) { return selectedCards[deckKey(deck.id, card)]; }).length;
        box.checked = selected === deck.cards.length && selected > 0;
        box.indeterminate = selected > 0 && selected < deck.cards.length;
      } else {
        box.checked = !!selectedUnits[deck.id];
        box.indeterminate = false;
      }
    });
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function countForMode() {
    if (mode === 'custom') {
      return Object.keys(selectedCards).filter(function (key) { return selectedCards[key]; }).length;
    }
    var count = 0;
    decks.forEach(function (deck) {
      if (!selectedUnits[deck.id]) return;
      if (mode === 'review') count += deck.cards.filter(isReviewCard).length;
      else count += deck.cards.length;
    });
    return count;
  }

  function updateSummary() {
    var count = countForMode();
    planCount.textContent = count + ' 张';
    startBtn.disabled = count === 0;
    planHint.textContent = mode === 'custom'
      ? '勾选到具体词组；单元勾选框会全选/取消该单元。'
      : mode === 'review'
        ? '只取已标记“需复习”或今天到期 的卡片。'
        : '按所选单元的顺序，从第 1 课到第 5 课。';
    updateUnitChecks();
  }

  function setMode(next) {
    mode = next;
    tabs.forEach(function (tab) {
      var active = tab.dataset.mode === mode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    renderUnits();
  }

  unitList.addEventListener('change', function (event) {
    var target = event.target;
    if (target.classList.contains('unit-check')) {
      var deckId = target.dataset.deck;
      selectedUnits[deckId] = target.checked;
      var deck = decks.find(function (d) { return d.id === deckId; });
      if (deck) {
        deck.cards.forEach(function (card) {
          selectedCards[deckKey(deckId, card)] = target.checked;
        });
        var section = unitList.querySelector('.plan-unit[data-deck="' + cssEscape(deckId) + '"]');
        if (section) {
          section.querySelectorAll('.card-check').forEach(function (box) {
            box.checked = target.checked;
          });
        }
      }
      updateSummary();
    } else if (target.classList.contains('card-check')) {
      var dId = target.dataset.deck;
      var index = parseInt(target.dataset.card, 10);
      var d = decks.find(function (item) { return item.id === dId; });
      if (d && d.cards[index]) {
        selectedCards[deckKey(dId, d.cards[index])] = target.checked;
        if (target.checked) selectedUnits[dId] = true;
        else {
          selectedUnits[dId] = d.cards.some(function (card) { return selectedCards[deckKey(dId, card)]; });
        }
      }
      updateSummary();
    }
  });

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { setMode(tab.dataset.mode); });
  });

  document.getElementById('selectAll').addEventListener('click', function () {
    decks.forEach(function (deck) {
      selectedUnits[deck.id] = true;
      deck.cards.forEach(function (card) { selectedCards[deckKey(deck.id, card)] = true; });
    });
    renderUnits();
  });

  document.getElementById('clearAll').addEventListener('click', function () {
    decks.forEach(function (deck) {
      selectedUnits[deck.id] = false;
      deck.cards.forEach(function (card) { selectedCards[deckKey(deck.id, card)] = false; });
    });
    renderUnits();
  });

  startBtn.addEventListener('click', function () {
    var keys = [];
    if (mode === 'custom') {
      decks.forEach(function (deck) {
        deck.cards.forEach(function (card) {
          if (selectedCards[deckKey(deck.id, card)]) keys.push(cardKey(card));
        });
      });
    } else {
      decks.forEach(function (deck) {
        if (!selectedUnits[deck.id]) return;
        deck.cards.forEach(function (card) {
          if (mode === 'review' && !isReviewCard(card)) return;
          keys.push(cardKey(card));
        });
      });
    }
    if (!keys.length) {
      window.alert(mode === 'review' ? '所选单元里还没有需复习/到期的卡片。' : '请至少选择一个单元或词组。');
      return;
    }
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify({
        mode: mode,
        keys: keys,
        units: selectedUnits,
        createdAt: new Date().toISOString()
      }));
    } catch (err) {
      window.alert('浏览器本地存储不可用，无法开始学习计划。');
      return;
    }
    window.location.href = 'index.html?plan=1';
  });

  decks = loadDecks();
  progress = readJson(PROGRESS_KEY, {});
  schedule = readJson(SCHEDULE_KEY, {});
  initSelection();
  setMode(mode);
})();
