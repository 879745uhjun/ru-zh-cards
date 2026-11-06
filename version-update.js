(function () {
  'use strict';
  if (document.getElementById('versionUpdateModal')) return;
  if (/changelog\.html$/i.test(location.pathname)) return;

  var DATA = window.RU_ZH_VERSIONS || {};
  var CURRENT = DATA.current;
  var VERSIONS = Array.isArray(DATA.versions) ? DATA.versions : [];
  if (!CURRENT || !VERSIONS.length) return;

  var SEEN_KEY = 'ru-zh-cards-version-seen-v1';
  var MUTE_KEY = 'ru-zh-cards-version-muted-v1';
  var DEFAULT_SEEN = VERSIONS[1] ? VERSIONS[1].version : '0';

  function read(key) { try { return localStorage.getItem(key); } catch (err) { return null; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch (err) {} }
  function versionParts(v) {
    return String(v || '0').split('.').map(function (part) { return parseInt(part, 10) || 0; });
  }
  function compareVersion(a, b) {
    var left = versionParts(a);
    var right = versionParts(b);
    var length = Math.max(left.length, right.length);
    for (var i = 0; i < length; i++) {
      var diff = (left[i] || 0) - (right[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
    });
  }

  var seen = read(SEEN_KEY) || DEFAULT_SEEN;
  var muted = read(MUTE_KEY) === '1';
  if (muted || compareVersion(seen, CURRENT) >= 0) return;
  var missed = VERSIONS.filter(function (item) { return compareVersion(item.version, seen) > 0; });
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
            '<ul>' + (item.items || []).map(function (text) { return '<li>' + esc(text) + '</li>'; }).join('') + '</ul>' +
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
