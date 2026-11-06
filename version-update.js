(function () {
  'use strict';
  if (document.getElementById('versionUpdateModal')) return;
  if (/changelog\.html$/i.test(location.pathname)) return;

  var CURRENT = '1.3';
  var DEFAULT_SEEN = '1.2';
  var SEEN_KEY = 'ru-zh-cards-version-seen-v1';
  var MUTE_KEY = 'ru-zh-cards-version-muted-v1';
  var VERSIONS = [
    {
      version: '1.3', label: 'Beta v1.3', date: '2026-11-06',
      items: [
        '15 篇对话/课文替换为裁切图精校稿。',
        '来源匹配更新为 196 张有来源、30 张暂无来源。',
        '书首页“查看本课”卡片可点击进入背诵，并显示掌握状态。',
        '手机端俄语词组字号调小。'
      ]
    },
    {
      version: '1.2', label: 'Beta v1.2', date: '2026-11-04',
      summary: '界面与稳定性更新',
      items: [
        '新增 Диалоги и Текст 文本模块，按课分组。',
        '单元预览卡片可点击进入对应卡片。',
        '来源全文改为正常段落排版，对应内容高亮。',
        '备份恢复、缓存和回归检查完善。'
      ]
    },
    {
      version: '1.1', label: 'Beta v1.1', date: '2026-11-03',
      summary: '同义表达与搜索更新',
      items: [
        '同义表达合并到同一张卡，各自标注重音和语法。',
        '新增全书搜索，不再跳转新页面。',
        '自定义学习显示来源。'
      ]
    }
  ];

  function read(key) {
    try { return localStorage.getItem(key); } catch (err) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (err) {}
  }
  function num(v) { return parseFloat(String(v || '0').replace(/[^\d.]/g, '')) || 0; }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
    });
  }

  var seen = read(SEEN_KEY) || DEFAULT_SEEN;
  var muted = read(MUTE_KEY) === '1';
  if (muted || num(seen) >= num(CURRENT)) return;
  var missed = VERSIONS.filter(function (item) { return num(item.version) > num(seen); });
  if (!missed.length) return;

  var modal = document.createElement('div');
  modal.className = 'version-modal';
  modal.id = 'versionUpdateModal';
  modal.innerHTML =
    '<div class="version-backdrop" data-version-close></div>' +
    '<section class="version-panel" role="dialog" aria-modal="true" aria-labelledby="versionUpdateTitle">' +
      '<header class="version-head">' +
        '<button class="version-close" type="button" data-version-close aria-label="关闭">×</button>' +
        '<span class="version-eyebrow">WHAT\'S NEW · 更新记录</span>' +
        '<span class="version-badge">新版本已更新</span>' +
        '<h2 id="versionUpdateTitle">' + esc(missed[0].label) + '</h2>' +
        '<p>本次共更新 ' + missed.length + ' 个版本，最近一次 ' + esc(missed[0].date) + '。</p>' +
      '</header>' +
      '<div class="version-scroll">' +
        missed.map(function (item, index) {
          return '<article class="version-item' + (index === 0 ? ' current' : '') + '">' +
            '<div class="version-item-head">' +
              (index === 0 ? '<span class="version-now">最新</span>' : '') +
              '<strong>' + esc(item.label) + '</strong>' +
              '<time>' + esc(item.date) + '</time>' +
            '</div>' +
            (item.summary ? '<p class="version-summary">' + esc(item.summary) + '</p>' : '') +
            '<ul>' + item.items.map(function (text) { return '<li>' + esc(text) + '</li>'; }).join('') + '</ul>' +
          '</article>';
        }).join('') +
      '</div>' +
      '<footer class="version-foot">' +
        '<label class="version-remember"><input type="checkbox" id="versionRemember"> 以后不再自动弹出</label>' +
        '<div class="version-actions">' +
          '<a class="version-link" href="changelog.html" id="versionLogLink">查看完整更新日志</a>' +
          '<button class="version-ok" type="button" id="versionOk">知道了</button>' +
        '</div>' +
      '</footer>' +
    '</section>';

  function close(remember) {
    write(SEEN_KEY, CURRENT);
    if (remember) write(MUTE_KEY, '1');
    modal.remove();
    document.body.style.overflow = '';
  }

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  var remember = modal.querySelector('#versionRemember');
  modal.querySelector('#versionOk').addEventListener('click', function () { close(remember && remember.checked); });
  modal.querySelector('#versionLogLink').addEventListener('click', function () { write(SEEN_KEY, CURRENT); });
  modal.querySelectorAll('[data-version-close]').forEach(function (el) {
    el.addEventListener('click', function () { close(remember && remember.checked); });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && document.getElementById('versionUpdateModal')) {
      close(remember && remember.checked);
    }
  });
})();
