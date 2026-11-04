(function () {
  'use strict';

  var map = window.RU_ZH_SOURCES || {};
  var seen = {};
  var sections = [];
  Object.keys(map).forEach(function (key) {
    (map[key] || []).forEach(function (source) {
      var id = [source.unit, source.kind, source.number].join('|');
      if (seen[id]) return;
      seen[id] = true;
      sections.push(source);
    });
  });

  function unitNumber(source) {
    var m = String(source.unit || '').match(/(\d+)/);
    return m ? Number(m[1]) : 99;
  }
  function kindOrder(source) {
    return source.kind === '对话' ? 0 : 1;
  }
  function numberOrder(source) {
    var m = String(source.number || '').match(/(\d+)/);
    return m ? Number(m[1]) : 99;
  }
  sections.sort(function (a, b) {
    return unitNumber(a) - unitNumber(b) || kindOrder(a) - kindOrder(b) || numberOrder(a) - numberOrder(b);
  });

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
    });
  }

  function paragraphs(text) {
    var raw = String(text || '').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (!raw) return '<p>暂无全文。</p>';
    var sentences = raw.split(/(?<=[.!?])\s+/);
    var groups = [];
    for (var i = 0; i < sentences.length; i += 2) groups.push(sentences.slice(i, i + 2).join(' '));
    return groups.map(function (group) { return '<p>' + escapeHtml(group) + '</p>'; }).join('');
  }

  var UNIT_TITLES = {
    '第 1 课': '外貌与性格',
    '第 2 课': '性格与生活',
    '第 3 课': '运动与爱好',
    '第 4 课': '旅游与城市',
    '第 5 课': '图书馆与阅读'
  };

  function itemHtml(source) {
    var unitNumberMatch = String(source.unit || '').match(/(\d+)/);
    var itemNumberMatch = String(source.number || '').match(/(\d+)/);
    var title;
    if (source.kind === '对话') {
      title = 'Урок ' + (unitNumberMatch ? unitNumberMatch[1] : '') + ' · Диалог ' + (itemNumberMatch ? itemNumberMatch[1] : '');
    } else {
      var textTitle = String(source.title || '').replace(/^Урок\s*\d+\s*·\s*/, '').trim() || 'Текст';
      title = 'Текст · ' + textTitle;
    }
    return '<details class="text-item">' +
      '<summary>' +
        '<span class="text-item-copy">' +
          '<span class="text-item-route">' + escapeHtml(source.unit) + ' · ' + escapeHtml(source.kind) + ' ' + escapeHtml(String(source.number || '').replace(/^(课文|对话)\s*/, '')) + '</span>' +
          '<span class="text-item-title">' + escapeHtml(title) + '</span>' +
          '<span class="text-item-meta">' + (source.page ? '第 ' + escapeHtml(source.page) + ' 页' : '') + ' · 点击展开全文</span>' +
        '</span>' +
        '<span class="text-item-arrow" aria-hidden="true">⌄</span>' +
      '</summary>' +
      '<div class="text-body">' + paragraphs(source.text) +
        (source.pdf ? '<div class="text-pdf-row"><a class="unit-btn" target="_blank" rel="noopener" href="' + escapeHtml(source.pdf) + '#page=' + encodeURIComponent(source.pdfPage || '1') + '">查看原 PDF · 第 ' + escapeHtml(source.pdfPage || '1') + ' 页</a></div>' : '') +
      '</div>' +
    '</details>';
  }

  var groups = {};
  sections.forEach(function (source) {
    var key = source.unit || '未分课';
    (groups[key] = groups[key] || []).push(source);
  });
  var list = document.getElementById('textsList');
  list.innerHTML = Object.keys(groups).sort(function (a, b) {
    var ma = String(a).match(/(\d+)/), mb = String(b).match(/(\d+)/);
    return (ma ? Number(ma[1]) : 99) - (mb ? Number(mb[1]) : 99);
  }).map(function (unit) {
    var items = groups[unit];
    var dialogues = items.filter(function (s) { return s.kind === '对话'; }).length;
    var texts = items.filter(function (s) { return s.kind !== '对话'; }).length;
    var number = String(unit).match(/(\d+)/);
    return '<section class="text-unit">' +
      '<div class="text-unit-head">' +
        '<span class="text-unit-number">' + (number ? String(number[1]).padStart(2, '0') : '—') + '</span>' +
        '<div class="text-unit-title"><h3>' + escapeHtml(unit) + ' · ' + escapeHtml(UNIT_TITLES[unit] || '') + '</h3>' +
          '<p>' + items.length + ' 篇 · ' + (dialogues ? '对话 ' + dialogues : '') + (dialogues && texts ? ' · ' : '') + (texts ? '课文 ' + texts : '') + '</p></div>' +
      '</div>' +
      '<div class="text-unit-items">' + items.map(itemHtml).join('') + '</div>' +
    '</section>';
  }).join('');
})();
