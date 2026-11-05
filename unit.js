(function () {
  'use strict';

  var VOWELS = 'аеёиоуыэюяАЕЁИОУЫЭЮЯ';
  var CASE_RE = /(主格|宾格|与格|属格|工具格|前置格|第一格|第二格|第三格|第四格|第五格|第六格)/;
  var WORD_RE = /(?:[А-Яа-яЁёA-Za-z0-9]|\[[А-Яа-яЁё]\])+(?:[-–—](?:[А-Яа-яЁёA-Za-z0-9]|\[[А-Яа-яЁё]\])+)*/g;

  var DECKS = window.RU_ZH_DECKS_SOURCE ? window.RU_ZH_DECKS_SOURCE.load() : [];

  var deckSelect = document.getElementById('deckSelect');
  var titleEl = document.getElementById('deckTitle');
  var tagEl = document.getElementById('deckTag');
  var countEl = document.getElementById('count');
  var grid = document.getElementById('unitGrid');
  var empty = document.getElementById('empty');
  var filterInput = document.getElementById('filterInput');
  var printBtn = document.getElementById('printBtn');
  var backLevelLink = document.getElementById('backLevelLink');
  var startStudy = document.getElementById('startStudy');

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
    });
  }

  function countVowels(text) {
    var n = 0;
    for (var i = 0; i < text.length; i++) {
      if (VOWELS.indexOf(text[i]) !== -1) n++;
    }
    return n;
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
    if (stress === null) {
      var yo = text.toLowerCase().indexOf('ё');
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

  function tokenize(ru) {
    var tokens = [];
    var src = String(ru || '');
    var re = new RegExp('(' + WORD_RE.source + ')|([^\\s])', 'g');
    var m;
    while ((m = re.exec(src))) {
      if (m[1] && /[А-Яа-яЁёA-Za-z0-9]/.test(m[1].replace(/\[[^\]]*\]/g, ''))) {
        var parsed = extractStress(m[1]);
        tokens.push({ text: parsed.text, stress: parsed.stress, grammar: [], punct: '', lead: '', punctOnly: false });
      } else {
        var p = m[2] || m[1] || '';
        if (tokens.length) tokens[tokens.length - 1].punct += p;
        else tokens.push({ text: p, grammar: [], punct: '', lead: '', punctOnly: true });
      }
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

  function shouldMarkStress(word) {
    if (!Number.isInteger(word.stress) || word.stress < 0) return false;
    if (countVowels(word.text) <= 1) return false;
    if (word.stress === 0 && /[А-ЯЁ]/.test(word.text[0])) return false;
    return true;
  }

  function wordHtml(word) {
    var out = '';
    var mark = shouldMarkStress(word);
    for (var i = 0; i < word.text.length; i++) {
      var ch = word.text[i];
      if (mark && i === word.stress) {
        out += '<span class="vowel">' + escapeHtml(ch) + (ch.toLowerCase() === 'ё' ? '' : '\u0301') + '</span>';
      } else {
        out += escapeHtml(ch);
      }
    }
    return out;
  }

  function gramHtml(word) {
    var labels = word.grammar || [];
    if (!labels.length) return '<span class="unit-grammar">—</span>';
    var html = labels.map(function (label) {
      var parts = String(label).split(/\s*·\s*/).map(function (part) {
        var safe = escapeHtml(part).replace(CASE_RE, '<span class="unit-g-case">$1</span>');
        return safe;
      });
      return '<span class="unit-g-line">' + parts.join(' · ') + '</span>';
    }).join('');
    return '<span class="unit-grammar">' + html + '</span>';
  }

  function makeWords(card) {
    if (Array.isArray(card.words) && card.words.length) {
      return card.words.map(function (word) {
        return {
          text: word.text || '',
          stress: Number.isInteger(word.stress) ? word.stress : null,
          grammar: splitLabels(word.grammar),
          punct: word.punct || '',
          lead: word.lead || '',
          punctOnly: !!word.punctOnly
        };
      });
    }
    var words = tokenize(card.ru);
    var groups = Array.isArray(card.grammar) ? card.grammar : [];
    var gi = 0;
    words.forEach(function (word) {
      if (word.punctOnly) return;
      var group = groups[gi];
      word.grammar = splitLabels(group);
      gi++;
    });
    return words;
  }

  function cardHtml(card, index) {
    var words = makeWords(card);
    var ru = words.map(function (word) {
      if (word.punctOnly) return '<span class="unit-punct">' + escapeHtml(word.text) + '</span>';
      var noStress = !Number.isInteger(word.stress) || word.stress < 0 || countVowels(word.text) === 0;
      return '<span class="unit-token">' +
        '<span class="unit-word-line">' +
          '<span class="unit-word' + (noStress ? ' no-stress' : '') + '">' + wordHtml(word) + '</span>' +
          (word.punct ? '<span class="unit-punct">' + escapeHtml(word.punct) + '</span>' : '') +
        '</span>' +
        gramHtml(word) +
      '</span>';
    }).join('');
    return '<article class="unit-card" data-card-index="' + index + '" tabindex="0" role="link" aria-label="打开 ' + escapeHtml(String(card.ru || '').replace(/\[([А-Яа-яЁё])\]/g, '$1')) + '" data-search="' + escapeHtml((card.ru + ' ' + card.zh + ' ' + card.tag).toLowerCase()) + '">' +
      '<div class="unit-card-head"><span class="unit-tag">' + escapeHtml(card.tag || '未分类') + '</span><span class="unit-num">' + String(index + 1).padStart(2, '0') + '</span></div>' +
      '<div class="unit-ru">' + ru + '</div>' +
      (Array.isArray(card.ruVariants) && card.ruVariants.length ? '<div class="unit-variants">' + card.ruVariants.map(function (v) { return '<span>同义：' + escapeHtml(String(v.ru || '').replace(/\[([А-Яа-яЁё])\]/g, '$1')) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="unit-zh"><span class="unit-zh-label">中</span><p class="unit-zh-text">' + escapeHtml(card.zh) + '</p></div>' +
      (card.note ? '<div class="unit-note">' + escapeHtml(card.note) + '</div>' : '') +
    '</article>';
  }

  function getDeckFromUrl() {
    var params = new URLSearchParams(location.search);
    var id = params.get('deck');
    for (var i = 0; i < DECKS.length; i++) if (DECKS[i].id === id) return DECKS[i];
    return DECKS[0];
  }

  function render() {
    var deck = getDeckFromUrl();
    if (!deck) {
      titleEl.textContent = '没有课程数据';
      return;
    }
    deckSelect.value = deck.id;
    titleEl.textContent = deck.title || '未命名课程';
    tagEl.textContent = (deck.tag || '课程') + ' · 整课浏览';
    var q = (filterInput.value || '').trim().toLowerCase();
    var cards = deck.cards.map(function (card, i) { return { card: card, i: i }; }).filter(function (item) {
      if (!q) return true;
      return (item.card.ru + ' ' + item.card.zh + ' ' + item.card.tag).toLowerCase().indexOf(q) !== -1;
    });
    countEl.textContent = cards.length + ' / ' + deck.cards.length + ' 张';
    grid.innerHTML = cards.map(function (item) { return cardHtml(item.card, item.i); }).join('');
    empty.hidden = cards.length > 0;
    var from = new URLSearchParams(location.search).get('from');
    if (backLevelLink) {
      backLevelLink.href = from === 'card'
        ? 'index.html?deck=' + encodeURIComponent(deck.id)
        : 'book.html';
      backLevelLink.title = '返回上一级';
    }
    if (startStudy) startStudy.href = 'index.html?deck=' + encodeURIComponent(deck.id) + '&from=unit';
    history.replaceState(null, '', '?deck=' + encodeURIComponent(deck.id) + (from ? '&from=' + encodeURIComponent(from) : ''));
  }

  function fillSelect() {
    deckSelect.innerHTML = DECKS.map(function (deck) {
      return '<option value="' + escapeHtml(deck.id) + '">' + escapeHtml(deck.title) + ' · ' + deck.cards.length + ' 张</option>';
    }).join('');
  }

  fillSelect();
  deckSelect.addEventListener('change', function () {
    var url = new URL(location.href);
    url.searchParams.set('deck', deckSelect.value);
    history.replaceState(null, '', url);
    filterInput.value = '';
    render();
  });
  filterInput.addEventListener('input', render);
  grid.addEventListener('click', function (event) {
    var card = event.target.closest('.unit-card');
    if (!card) return;
    var deck = getDeckFromUrl();
    if (!deck) return;
    location.href = 'index.html?deck=' + encodeURIComponent(deck.id) + '&card=' + (Number(card.getAttribute('data-card-index')) + 1);
  });
  grid.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    var card = event.target.closest('.unit-card');
    if (!card) return;
    event.preventDefault();
    card.click();
  });
  printBtn.addEventListener('click', function () { window.print(); });
  render();
})();
