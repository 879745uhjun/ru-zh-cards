(function () {
  'use strict';

  var map = window.RU_ZH_SOURCES || {};
  var extra = window.RU_ZH_EXTRA_TEXTS || {};
  var INDEX = window.RU_ZH_TEXT_SEARCH || { sections: [], unitTitles: {} };
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

  var indexMap = {};
  (INDEX.sections || []).forEach(function (item) { indexMap[item.id] = item; });

  function unitNumber(source) {
    var m = String(source.unit || '').match(/(\d+)/);
    return m ? Number(m[1]) : 99;
  }
  function kindOrder(source) { return source.kind === '对话' ? 0 : 1; }
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

  function bodyHtml(source) {
    var text = sourceText(source);
    return source.kind === '对话' ? dialogueHtml(text) : paragraphs(text);
  }

  var UNIT_TITLES = {
    '第 1 课': '外貌与性格', '第 2 课': '性格与生活', '第 3 课': '运动与爱好', '第 4 课': '旅游与城市',
    '第 5 课': '图书馆与阅读', '第 6 课': '居住', '第 7 课': '俄语学习', '第 8 课': '传媒',
    '第 9 课': '节日', '第 10 课': '民族饮食', '第 11 课': '博物馆与展览', '第 12 课': '戏剧与电影'
  };

  function itemTitle(source) {
    var itemNo = (String(source.number || '').match(/(\d+)/) || [])[1] || '';
    if (source.kind === '对话') return 'Диалог ' + itemNo;
    var textTitle = String(source.title || '').replace(/^Урок\s*\d+\s*·\s*/, '').trim() || 'Текст';
    return 'Текст · ' + textTitle;
  }

  function routeLabel(source) {
    var lessonNo = (String(source.unit || '').match(/(\d+)/) || [])[1] || '';
    var itemNo = (String(source.number || '').match(/(\d+)/) || [])[1] || '';
    return source.kind === '对话'
      ? 'Урок ' + lessonNo + ' · Диалог ' + itemNo
      : 'Урок ' + lessonNo + ' · Текст ' + itemNo;
  }

  function itemHtml(source) {
    return '<details class="text-item">' +
      '<summary>' +
        '<span class="text-item-copy">' +
          '<span class="text-item-route">' + escapeHtml(routeLabel(source)) + '</span>' +
          '<span class="text-item-title">' + escapeHtml(itemTitle(source)) + '</span>' +
          '<span class="text-item-meta">' + (source.page ? '第 ' + escapeHtml(source.page) + ' 页' : '') + ' · 点击展开全文</span>' +
        '</span>' +
        '<span class="text-item-arrow" aria-hidden="true">⌄</span>' +
      '</summary>' +
      '<div class="text-body">' + bodyHtml(source) +
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

  var input = document.getElementById('textSearch');
  var clearBtn = document.getElementById('textSearchClear');
  var results = document.getElementById('textSearchResults');
  var hint = document.getElementById('textSearchHint');
  if (!input || !results) return;

  var SUFFIX = ['иями', 'ями', 'ами', 'ией', 'иях', 'ях', 'ах', 'ов', 'ев', 'ий', 'ый', 'ой', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ем', 'ом', 'ам', 'ям', 'ия', 'ию', 'ии', 'ей', 'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю'];
  function stem(word) {
    var w = String(word || '').toLowerCase();
    for (var i = 0; i < SUFFIX.length; i++) {
      var s = SUFFIX[i];
      if (w.length - s.length >= 3 && w.slice(-s.length) === s) return w.slice(0, -s.length);
    }
    return w;
  }
  function isRu(v) { return /[А-Яа-яЁё]/.test(v); }
  function isZh(v) { return /[\u3400-\u9fff]/.test(v); }
  function ruWords(v) { return String(v || '').match(/[А-Яа-яЁё-]+/g) || []; }
  function sentences(text) {
    return String(text || '').replace(/\s*\n\s*/g, ' ').split(/(?<=[.!?…])\s+/).filter(Boolean);
  }
  var RE_SPECIAL = /[.*+?^{}$()|[\]\\]/g;
  function escapeRe(raw) { return String(raw).replace(RE_SPECIAL, '\\$&'); }
  function highlight(text, re) {
    if (!re) return escapeHtml(text);
    re.lastIndex = 0;
    var out = '', last = 0, m;
    while ((m = re.exec(text))) {
      out += escapeHtml(text.slice(last, m.index)) + '<mark class="search-hl">' + escapeHtml(m[0]) + '</mark>';
      last = m.index + m[0].length;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out + escapeHtml(text.slice(last));
  }

  function search(raw) {
    var query = String(raw || '').trim();
    if (!query) return [];
    var ru = isRu(query), zh = isZh(query);
    var queryLemmas = ru ? ruWords(query).map(stem) : [];
    var lower = query.toLowerCase();
    var hits = [];

    sections.forEach(function (source) {
      var body = sourceText(source);
      var idx = indexMap[source.id] || {};
      var bodyLemmas = idx.lemmas || [];
      var zhList = idx.zh || [];
      var score = 0, kind = '', snippet = '';

      if (ru) {
        if (body.toLowerCase().indexOf(lower) !== -1) { score = 5; kind = '词组 / 句子'; }
        else if (queryLemmas.length && queryLemmas.every(function (l) { return bodyLemmas.indexOf(l) !== -1; })) { score = 4; kind = '词形匹配'; }
        else if (queryLemmas.some(function (l) { return bodyLemmas.indexOf(l) !== -1; })) { score = 3; kind = '部分匹配'; }
      }
      if (!score && zh) {
        var zhHit = zhList.filter(function (item) { return item.zh && item.zh.indexOf(query) !== -1; });
        if (zhHit.length) { score = 2; kind = '中文释义'; snippet = zhHit[0].ru + '（' + zhHit[0].zh + '）'; }
      }
      if (!score) {
        var meta = (source.unit || '') + ' ' + (UNIT_TITLES[source.unit] || '') + ' ' + (source.kind || '') + ' ' + (source.number || '') + ' ' + (source.title || '');
        if (meta.toLowerCase().indexOf(lower) !== -1) { score = 1; kind = '标题'; }
      }
      if (!score) return;

      if (!snippet) {
        var pool = sentences(body);
        if (ru) {
          var re = new RegExp(escapeRe(query), 'i');
          snippet = pool.filter(function (line) { return re.test(line); })[0] || '';
          if (!snippet) {
            snippet = pool.filter(function (line) {
              var ls = ruWords(line).map(stem);
              return queryLemmas.some(function (l) { return ls.indexOf(l) !== -1; });
            })[0] || '';
          }
        }
        if (!snippet) snippet = pool[0] || '';
      }
      if (snippet.length > 160) snippet = snippet.slice(0, 160) + '…';

      hits.push({ source: source, score: score, kind: kind, snippet: snippet });
    });

    hits.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return unitNumber(a.source) - unitNumber(b.source) || kindOrder(a.source) - kindOrder(b.source);
    });
    return hits;
  }

  function resultHtml(hit, re) {
    var source = hit.source;
    return '<article class="text-result">' +
      '<div class="text-result-head">' +
        '<span class="text-result-kind">' + escapeHtml(hit.kind) + '</span>' +
        '<span class="text-result-route">' + escapeHtml(source.unit) + ' · ' + escapeHtml(source.kind) + ' ' + escapeHtml(String(source.number || '').replace(/^(课文|对话)\s*/, '')) + (source.page ? ' · 第 ' + escapeHtml(source.page) + ' 页' : '') + '</span>' +
      '</div>' +
      '<p class="text-result-title">' + escapeHtml(itemTitle(source)) + '</p>' +
      '<p class="text-result-snippet">' + highlight(hit.snippet, re) + '</p>' +
      '<button type="button" class="text-result-toggle" aria-expanded="false">展开全文</button>' +
      '<div class="text-result-body" hidden>' + bodyHtml(source) + '</div>' +
    '</article>';
  }

  function render(query) {
    var hits = search(query);
    var ru = isRu(query);
    results.hidden = false;
    list.hidden = true;
    clearBtn.hidden = false;
    hint.textContent = '找到 ' + hits.length + ' 篇；俄语按词形还原匹配，中文按卡片释义匹配';
    if (!hits.length) {
      results.innerHTML = '<p class="text-search-empty">没有找到包含“' + escapeHtml(query) + '”的对话或课文。</p>';
      return;
    }
    var re = ru ? new RegExp(escapeRe(query), 'gi') : (isZh(query) ? new RegExp(escapeRe(query), 'g') : null);
    results.innerHTML = hits.map(function (hit) { return resultHtml(hit, re); }).join('');
  }

  function reset() {
    results.hidden = true;
    results.innerHTML = '';
    list.hidden = false;
    clearBtn.hidden = true;
    hint.textContent = '支持俄语词形变化：输入 длинная 也能找到 длинные';
  }

  results.addEventListener('click', function (event) {
    var btn = event.target.closest('.text-result-toggle');
    if (!btn) return;
    var body = btn.parentNode.querySelector('.text-result-body');
    if (!body) return;
    var open = body.hidden;
    body.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? '收起全文' : '展开全文';
  });

  input.addEventListener('input', function () {
    var value = input.value.trim();
    if (!value) { reset(); return; }
    render(value);
  });
  clearBtn.addEventListener('click', function () {
    input.value = '';
    reset();
    input.focus();
  });

  reset();
})();
