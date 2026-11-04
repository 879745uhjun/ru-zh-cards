(function () {
  'use strict';

  var button = document.querySelector('[data-global-search]');
  var input = document.getElementById('searchInput') || document.getElementById('filterInput');
  if (!button || !input) return;

  var panel = document.createElement('section');
  panel.className = 'global-search-results';
  panel.hidden = true;

  var anchor = document.querySelector('.toolbar') || document.querySelector('.unit-meta');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
  else (document.querySelector('main') || document.body).appendChild(panel);

  var decks = window.RU_ZH_DECKS_SOURCE ? window.RU_ZH_DECKS_SOURCE.load() : [];
  decks = decks.filter(function (deck) { return deck.id !== 'plan'; });
  var records = [];
  decks.forEach(function (deck) {
    deck.cards.forEach(function (card, index) {
      records.push({ deck: deck, card: card, index: index });
    });
  });

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

  function textOf(record) {
    var card = record.card;
    var variants = Array.isArray(card.ruVariants) ? card.ruVariants.map(function (v) {
      return (v.ru || '') + ' ' + (v.zh || '');
    }).join(' ') : '';
    return [card.ru, card.zh, card.tag, card.note, variants, record.deck.title].join(' ').toLowerCase();
  }

  function render(query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) {
      panel.innerHTML = '<div class="global-search-head">全书搜索 <span>输入关键词</span></div>' +
        '<div class="global-search-empty">输入俄语或中文，跨 5 个单元查找。</div>';
      return;
    }
    var found = records.filter(function (record) { return textOf(record).indexOf(q) !== -1; });
    panel.innerHTML = '<div class="global-search-head">全书搜索 <span>找到 ' + found.length + ' 张</span></div>' +
      (found.length ? found.slice(0, 80).map(function (record) {
        var card = record.card;
        var href = 'index.html?deck=' + encodeURIComponent(record.deck.id) + '&card=' + (record.index + 1);
        return '<a class="global-result" href="' + href + '">' +
          '<span class="global-result-lesson">' + escapeHtml(record.deck.title) + '</span>' +
          '<span class="global-result-ru">' + escapeHtml(cleanRu(card.ru)) + '</span>' +
          '<span class="global-result-zh">' + escapeHtml(card.zh) + '</span>' +
          '<span class="global-result-source">' + escapeHtml(sourceLabel(card)) + '</span>' +
        '</a>';
      }).join('') : '<div class="global-search-empty">没有找到，换一个关键词试试。</div>');
  }

  var active = false;
  function setActive(next) {
    active = next;
    window.__globalSearchActive = active;
    document.body.classList.toggle('global-search-active', active);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    panel.hidden = !active;
    if (active) {
      input.placeholder = '搜索全书：俄语 / 中文 / 分类';
      render(input.value);
      input.focus();
    } else {
      input.placeholder = '搜索俄语 / 中文';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  button.addEventListener('click', function () { setActive(!active); });
  input.addEventListener('input', function () {
    if (!active) return;
    render(input.value);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && active) setActive(false);
  });

  var params = new URLSearchParams(location.search);
  if (params.get('q')) input.value = params.get('q');
  if (params.get('global') === '1') setActive(true);
})();
