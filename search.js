(function () {
  'use strict';

  var decks = window.RU_ZH_DECKS_SOURCE ? window.RU_ZH_DECKS_SOURCE.load() : [];
  decks = decks.filter(function (deck) { return deck.id !== 'plan'; });
  var input = document.getElementById('bookSearchInput');
  var results = document.getElementById('bookSearchResults');
  var summary = document.getElementById('bookSearchSummary');

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
    });
  }

  function cleanRu(text) {
    return String(text || '').replace(/\[([А-Яа-яЁё])\]/g, '$1');
  }

  function sourceLabel(card) {
    var map = window.RU_ZH_SOURCES || {};
    var list = map[cleanRu(card.ru).toLowerCase()] || card.sources || [];
    if (!list.length) return '暂无来源';
    var source = list[0];
    var number = String(source.number || '').replace(/^(课文|对话)\s*/, '');
    return (source.unit || '') + ' · ' + (source.kind || '课文') + (number ? ' ' + number : '');
  }

  var records = [];
  decks.forEach(function (deck) {
    deck.cards.forEach(function (card, index) {
      records.push({ deck: deck, card: card, index: index });
    });
  });

  function searchText(record) {
    var card = record.card;
    var variants = Array.isArray(card.ruVariants) ? card.ruVariants.map(function (v) {
      return (v.ru || '') + ' ' + (v.zh || '');
    }).join(' ') : '';
    return [card.ru, card.zh, card.tag, card.note, variants, record.deck.title].join(' ').toLowerCase();
  }

  function render() {
    var query = (input.value || '').trim().toLowerCase();
    if (!query) {
      results.innerHTML = '';
      summary.textContent = '全书共 ' + records.length + ' 张卡；输入俄语或中文开始搜索。';
      return;
    }
    var found = records.filter(function (record) {
      return searchText(record).indexOf(query) !== -1;
    });
    summary.textContent = '找到 ' + found.length + ' 张卡' + (found.length > 100 ? '，只显示前 100 张' : '') + '。';
    if (!found.length) {
      results.innerHTML = '<div class="book-search-empty"><strong>没有找到</strong>换一个俄语或中文关键词试试。</div>';
      return;
    }
    results.innerHTML = found.slice(0, 100).map(function (record) {
      var card = record.card;
      var href = 'index.html?deck=' + encodeURIComponent(record.deck.id) + '&card=' + (record.index + 1);
      return '<a class="book-result" href="' + href + '">' +
        '<span><span class="book-result-lesson">' + escapeHtml(record.deck.title) + '</span>' +
          '<span class="book-result-ru">' + escapeHtml(cleanRu(card.ru)) + '</span>' +
          '<span class="book-result-zh">' + escapeHtml(card.zh) + '</span>' +
          '<span class="book-result-source">' + escapeHtml(sourceLabel(card)) + '</span>' +
        '</span><span class="book-result-arrow">→</span></a>';
    }).join('');
  }

  input.addEventListener('input', render);
  var initial = new URLSearchParams(location.search).get('q');
  if (initial) input.value = initial;
  render();
})();
