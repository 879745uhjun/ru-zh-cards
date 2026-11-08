(function () {
  'use strict';

  var map = window.RU_ZH_SOURCES || {};
  var extra = window.RU_ZH_EXTRA_TEXTS || {};
  var seen = {};
  var sections = Array.isArray(window.RU_ZH_SOURCE_SECTIONS) ? window.RU_ZH_SOURCE_SECTIONS.slice() : [];
  (extra.sections || []).forEach(function (source) {
    if (!sections.some(function (item) { return item.id === source.id; })) sections.push(source);
  });
  if (!sections.length) {
    Object.keys(map).forEach(function (key) {
      (map[key] || []).forEach(function (source) {
        var id = [source.unit, source.kind, source.number].join('|');
        if (seen[id]) return;
        seen[id] = true;
        sections.push(source);
      });
    });
  }

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

  function sourceText(source) {
    if (!source) return '';
    if (source.text) return source.text;
    var store = window.RU_ZH_SOURCE_TEXTS || {};
    var extraStore = (window.RU_ZH_EXTRA_TEXTS || {}).texts || {};
    var key = source.textKey || source.id;
    return key ? (store[key] || extraStore[key] || '') : '';
  }

  function dialogueHtml(text) {
    var lines = String(text || '').replace(/\r/g, '').split(/\n+/).map(function (line) {
      return line.replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
    return lines.map(function (line) {
      return '<p class="source-paragraph dialogue-line">' + escapeHtml(line) + '</p>';
    }).join('');
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
    '第 5 课': '图书馆与阅读',
    '第 6 课': '居住',
    '第 7 课': '俄语学习',
    '第 8 课': '传媒',
    '第 9 课': '节日',
    '第 10 课': '民族饮食',
    '第 11 课': '博物馆与展览',
    '第 12 课': '戏剧与电影'
  };

  var UNIT_TITLES_RU = {
    '第 1 课': 'Портрет, внешность человека',
    '第 2 课': 'Характер человека',
    '第 3 课': 'Мир интересов и увлечений',
    '第 4 课': 'Путешествие',
    '第 5 课': 'Чтение — полезная привычка',
    '第 6 课': 'Где мы живём?',
    '第 7 课': 'Русский язык — не проблема!',
    '第 8 课': 'Медиа в современной жизни',
    '第 9 课': 'Праздники',
    '第 10 课': 'Национальные кухни',
    '第 11 课': 'Музей и выставка — источник знаний',
    '第 12 课': 'Театр или кино?'
  };

  function itemHtml(source) {
    var unitNumberMatch = String(source.unit || '').match(/(\d+)/);
    var itemNumberMatch = String(source.number || '').match(/(\d+)/);
    var lessonNo = unitNumberMatch ? unitNumberMatch[1] : '';
    var itemNo = itemNumberMatch ? itemNumberMatch[1] : '';
    var title;
    var route;
    if (source.kind === '对话') {
      route = 'Урок ' + lessonNo + ' · Диалог ' + itemNo;
      title = 'Диалог ' + itemNo;
    } else {
      var textTitle = String(source.title || '').replace(/^Урок\s*\d+\s*·\s*/, '').trim() || 'Текст';
      route = 'Урок ' + lessonNo + ' · Текст ' + itemNo;
      title = 'Текст · ' + textTitle;
    }
    return '<details class="text-item">' +
      '<summary>' +
        '<span class="text-item-copy">' +
          '<span class="text-item-route">' + escapeHtml(route) + '</span>' +
          '<span class="text-item-title">' + escapeHtml(title) + '</span>' +
          '<span class="text-item-meta">' + (source.page ? '第 ' + escapeHtml(source.page) + ' 页' : '') + ' · 点击展开全文</span>' +
        '</span>' +
        '<span class="text-item-arrow" aria-hidden="true">⌄</span>' +
      '</summary>' +
      '<div class="text-body">' + (source.kind === '对话' ? dialogueHtml(sourceText(source)) : paragraphs(sourceText(source))) +
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
