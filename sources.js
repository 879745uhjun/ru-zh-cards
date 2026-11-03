(function () {
  'use strict';

  var decks = window.RU_ZH_DECKS_SOURCE ? window.RU_ZH_DECKS_SOURCE.load() : [];
  var search = document.getElementById('sourceSearch');
  var results = document.getElementById('sourceResults');
  var hint = document.getElementById('sourceHint');
  var total = document.getElementById('sourceTotal');
  var printBtn = document.getElementById('printBtn');
  var records = [];

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
    });
  }

  function cleanRu(text) {
    return String(text || '').replace(/\[([А-Яа-яЁё])\]/g, '$1');
  }

  function normalizeSource(item) {
    if (!item || typeof item !== 'object') return null;
    var kind = String(item.kind || item.type || '').indexOf('对话') !== -1 ? '对话' : '课文';
    return {
      book: String(item.book || '新东方大学俄语（3）').trim(),
      unit: String(item.unit || item.lesson || '').trim(),
      kind: kind,
      number: String(item.number || item.part || '').trim(),
      title: String(item.title || '').trim(),
      page: item.page == null ? '' : String(item.page).trim(),
      text: String(item.text || item.quote || '').trim(),
      quote: String(item.quote || '').trim()
    };
  }

  function sourcesFor(card) {
    var own = Array.isArray(card.sources) ? card.sources : [];
    var map = window.RU_ZH_SOURCES || {};
    var key = cleanRu(card.ru).toLowerCase();
    var extra = map[key] || [];
    var all = own.concat(Array.isArray(extra) ? extra : [extra]);
    return all.map(normalizeSource).filter(Boolean);
  }

  function route(source) {
    var parts = [];
    if (source.book) parts.push(source.book);
    if (source.unit) parts.push(source.unit);
    return parts.join(' · ');
  }

  function typeLabel(source) {
    var number = String(source.number || '').replace(/^(课文|对话)\s*/, '');
    return source.kind + (number ? ' ' + number : '');
  }

  function highlight(text, needle) {
    var raw = String(text || '');
    var key = String(needle || '');
    if (!key) return escapeHtml(raw);
    var index = raw.toLowerCase().indexOf(key.toLowerCase());
    if (index < 0) return escapeHtml(raw);
    return escapeHtml(raw.slice(0, index)) +
      '<mark class="source-hl">' + escapeHtml(raw.slice(index, index + key.length)) + '</mark>' +
      escapeHtml(raw.slice(index + key.length));
  }

  function build() {
    var seen = {};
    decks.forEach(function (deck) {
      deck.cards.forEach(function (card, index) {
        sourcesFor(card).forEach(function (source) {
          var passage = source.text || source.quote || '';
          var key = cleanRu(card.ru) + '|' + route(source) + '|' + passage.slice(0, 120);
          if (seen[key]) return;
          seen[key] = true;
          records.push({ deck: deck, card: card, index: index, source: source, passage: passage });
        });
      });
    });
    total.textContent = records.length + ' 条来源';
    if (!records.length) {
      hint.textContent = '还没有录入来源。把 PDF 原文整理进 data/sources.js 后，这里会显示查询结果。';
    } else {
      hint.textContent = '共 ' + records.length + ' 条来源；输入关键词缩小范围。';
    }
    render();
  }

  function matches(record, query) {
    if (!query) return true;
    var haystack = [
      record.card.ru,
      record.card.zh,
      record.source.book,
      record.source.unit,
      record.source.kind,
      record.source.number,
      record.source.title,
      record.source.text,
      record.source.quote
    ].join(' ').toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function render() {
    var query = (search.value || '').trim().toLowerCase();
    var filtered = records.filter(function (record) { return matches(record, query); });
    if (!filtered.length) {
      results.innerHTML = '<div class="source-empty"><strong>' + (records.length ? '没有匹配的来源' : '暂无来源') + '</strong>' +
        (records.length ? '换一个关键词试试。' : '等 PDF 原文录入后会显示在这里。') + '</div>';
      return;
    }
    results.innerHTML = filtered.map(function (record) {
      var source = record.source;
      var needle = cleanRu(record.card.ru);
      var quote = source.quote || source.text || '';
      var full = source.text || '';
      var href = 'index.html?deck=' + encodeURIComponent(record.deck.id) + '&card=' + (record.index + 1);
      return '<article class="source-result">' +
        '<div class="source-result-head"><div class="source-result-card">' +
          '<div class="source-result-ru">' + escapeHtml(cleanRu(record.card.ru)) + '</div>' +
          '<div class="source-result-zh">' + escapeHtml(record.card.zh) + '</div>' +
        '</div><a class="unit-btn" href="' + href + '">打开卡片</a></div>' +
        '<div class="source-route"><span class="source-kind">' + escapeHtml(typeLabel(source)) + '</span>' +
          escapeHtml(route(source)) +
          (source.page ? '<span class="source-page">第 ' + escapeHtml(source.page) + ' 页</span>' : '') +
        '</div>' +
        (source.title ? '<div class="source-title" style="font-size:11px;color:#5f574c;margin-top:5px;">' + escapeHtml(source.title) + '</div>' : '') +
        '<blockquote class="source-quote">' + highlight(quote, needle) + '</blockquote>' +
        (full && full !== quote ? '<details class="source-more"><summary>查看完整原文</summary><blockquote class="source-quote full">' + highlight(full, needle) + '</blockquote></details>' : '') +
      '</article>';
    }).join('');
  }

  search.addEventListener('input', render);
  printBtn.addEventListener('click', function () { window.print(); });
  build();
})();
