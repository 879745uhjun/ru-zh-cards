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

  function sourceText(source) {
    if (!source) return '';
    if (source.text) return source.text;
    var store = window.RU_ZH_SOURCE_TEXTS || {};
    return source.textKey ? (store[source.textKey] || '') : '';
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
      pdf: String(item.pdf || '').trim(),
      pdfPage: item.pdfPage == null ? '' : String(item.pdfPage).trim(),
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
    var key = String(needle || '').trim();
    if (!key) return escapeHtml(raw);
    var ranges = [];
    var lower = raw.toLowerCase();
    var search = key.toLowerCase();
    var pos = lower.indexOf(search);
    while (pos !== -1) {
      ranges.push([pos, pos + search.length]);
      pos = lower.indexOf(search, pos + search.length);
    }
    if (!ranges.length) {
      var stop = ['и', 'в', 'во', 'не', 'на', 'с', 'со', 'к', 'о', 'об', 'от', 'до', 'по', 'за', 'из', 'у', 'что', 'как', 'это', 'же', 'ли', 'бы'];
      var words = (key.toLowerCase().replace(/ё/g, 'е').match(/[а-яa-z0-9]+/g) || []).filter(function (w) {
        return w.length > 2 && stop.indexOf(w) === -1;
      });
      if (words.length) {
        var pattern = words.map(function (w) {
          return (w.length > 4 ? w.slice(0, 4) : w) + '[а-яё]*';
        }).join('\\s+(?:[а-яё]+\\s+){0,3}');
        try {
          var re = new RegExp(pattern, 'gi');
          var match;
          while ((match = re.exec(raw))) {
            ranges.push([match.index, match.index + match[0].length]);
            if (match.index === re.lastIndex) re.lastIndex++;
          }
        } catch (err) { /* ignore */ }
      }
    }
    if (!ranges.length) return escapeHtml(raw);
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    ranges.forEach(function (range) {
      var last = merged[merged.length - 1];
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push(range.slice());
    });
    var out = '';
    var cursor = 0;
    merged.forEach(function (range) {
      out += escapeHtml(raw.slice(cursor, range[0])) +
        '<mark class="source-hl">' + escapeHtml(raw.slice(range[0], range[1])) + '</mark>';
      cursor = range[1];
    });
    return out + escapeHtml(raw.slice(cursor));
  }

  function build() {
    var seen = {};
    decks.forEach(function (deck) {
      deck.cards.forEach(function (card, index) {
        sourcesFor(card).forEach(function (source) {
          var passage = source.quote || sourceText(source) || '';
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
      sourceText(record.source),
      record.source.quote
    ].join(' ').toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function paragraphs(text, needle) {
    var raw = String(text || '').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (!raw) return '';
    var sentences = raw.split(/(?<=[.!?])\s+/);
    var groups = [];
    for (var i = 0; i < sentences.length; i += 2) groups.push(sentences.slice(i, i + 2).join(' '));
    return groups.map(function (group) { return '<p class="source-paragraph">' + highlight(group, needle) + '</p>'; }).join('');
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
      var full = sourceText(source);
      var quote = source.quote || full || '';
      var href = 'index.html?deck=' + encodeURIComponent(record.deck.id) + '&card=' + (record.index + 1);
      return '<article class="source-result">' +
        '<div class="source-result-head"><div class="source-result-card">' +
          '<div class="source-result-ru">' + escapeHtml(cleanRu(record.card.ru)) + '</div>' +
          '<div class="source-result-zh">' + escapeHtml(record.card.zh) + '</div>' +
        '</div><a class="unit-btn" href="' + href + '">打开卡片</a></div>' +
        '<div class="source-route"><span class="source-kind">' + escapeHtml(typeLabel(source)) + '</span>' +
          escapeHtml(route(source)) +
          (source.page ? '<span class="source-page">第 ' + escapeHtml(source.page) + ' 页</span>' : '') +
          (source.pdf ? '<a class="source-pdf" target="_blank" rel="noopener" href="' + escapeHtml(source.pdf) + '#page=' + encodeURIComponent(source.pdfPage || '1') + '">原 PDF · 第 ' + escapeHtml(source.pdfPage || '1') + ' 页</a>' : '') +
        '</div>' +
        (source.title ? '<div class="source-title" style="font-size:11px;color:#5f574c;margin-top:5px;">' + escapeHtml(source.title) + '</div>' : '') +
        '<blockquote class="source-quote">' + highlight(quote, needle) + '</blockquote>' +
        (full && full !== quote ? '<details class="source-more"><summary>查看对话 / 全文（OCR 初稿）</summary><blockquote class="source-quote full">' + paragraphs(full, needle) + '</blockquote></details>' : '') +
      '</article>';
    }).join('');
  }

  search.addEventListener('input', render);
  printBtn.addEventListener('click', function () { window.print(); });
  results.addEventListener('toggle', function (event) {
    if (!event.target.classList.contains('source-more') || !event.target.open) return;
    var mark = event.target.querySelector('.source-hl');
    var box = event.target.querySelector('.source-quote.full');
    if (mark && box) box.scrollTop = Math.max(0, mark.offsetTop - box.offsetTop - 16);
  }, true);
  build();
})();
