(function () {
  'use strict';

  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var params = new URLSearchParams(location.search);
  var deck = params.get('deck') || 'lesson1';
  var deckSelect = document.getElementById('deckSelect');
  if (deckSelect && deckSelect.value) deck = deckSelect.value;

  var isCard = page === 'index.html' || page === '';
  var isBook = page === 'book.html';
  var backSource = document.getElementById('backLevelLink');
  var backHref = isBook ? '' : (backSource ? backSource.getAttribute('href') : 'book.html');
  var unitHref = 'unit.html?deck=' + encodeURIComponent(deck);
  var editToggle = document.getElementById('editToggle');

  var sidebar = document.createElement('aside');
  sidebar.className = 'global-sidebar';
  sidebar.setAttribute('aria-label', '全局工具栏');

  function link(href, icon, label, id, extra) {
    return '<a class="gs-btn' + (extra || '') + '" id="' + id + '" href="' + href + '">' +
      '<span class="gs-icon" aria-hidden="true">' + icon + '</span><span>' + label + '</span></a>';
  }

  var html = '<span class="gs-caption">快捷</span>';
  html += link(isBook ? 'book.html' : (backHref || 'book.html'), '←', '上一级', 'gsBack', ' gs-back' + (isBook ? ' is-disabled' : ''));
  html += '<span class="gs-divider" aria-hidden="true"></span>';
  html += '<span class="gs-page-group"><span class="gs-page-label">翻页</span>';
  html += '<button class="gs-btn gs-page" id="gsPrev" type="button"' + (isCard ? '' : ' disabled') + '><span class="gs-icon" aria-hidden="true">↑</span><span>上一页</span></button>';
  html += '<button class="gs-btn gs-page" id="gsNext" type="button"' + (isCard ? '' : ' disabled') + '><span class="gs-icon" aria-hidden="true">↓</span><span>下一页</span></button>';
  html += '</span>';
  html += '<span class="gs-divider" aria-hidden="true"></span>';
  html += link('book.html', '⌂', '书首页', 'gsBook', page === 'book.html' ? ' active' : '');
  html += link('changelog.html', '≡', '日志', 'gsLog', page === 'changelog.html' ? ' active' : '');
  html += '<button class="gs-btn" id="gsEdit" type="button" aria-pressed="false"' + (editToggle ? '' : ' disabled') + '><span class="gs-icon" aria-hidden="true">✎</span><span>编辑</span></button>';
  sidebar.innerHTML = html;
  document.body.appendChild(sidebar);

  var gsBack = document.getElementById('gsBack');
  var gsPrev = document.getElementById('gsPrev');
  var gsNext = document.getElementById('gsNext');
  var gsEdit = document.getElementById('gsEdit');

  if (gsEdit && editToggle) {
    gsEdit.addEventListener('click', function () { editToggle.click(); });
  }
  if (gsPrev) {
    gsPrev.addEventListener('click', function () {
      var b = document.getElementById('prevBtn');
      if (b) b.click();
    });
  }
  if (gsNext) {
    gsNext.addEventListener('click', function () {
      var b = document.getElementById('nextBtn');
      if (b) b.click();
    });
  }

  function sync() {
    if (gsBack) {
      if (isBook) {
        gsBack.classList.add('is-disabled');
        gsBack.setAttribute('aria-disabled', 'true');
      } else {
        gsBack.classList.remove('is-disabled');
        gsBack.removeAttribute('aria-disabled');
        var source = document.getElementById('backLevelLink');
        if (source) {
          gsBack.href = source.getAttribute('href');
        } else {
          gsBack.href = params.get('from') === 'unit'
            ? 'unit.html?deck=' + encodeURIComponent(deck)
            : 'book.html';
        }
      }
    }
    if (gsPrev && gsNext) {
      var p = document.getElementById('prevBtn');
      var n = document.getElementById('nextBtn');
      gsPrev.disabled = !p || p.disabled;
      gsNext.disabled = !n || n.disabled;
    }
    if (gsEdit) {
      if (!editToggle) {
        gsEdit.disabled = true;
      } else {
        gsEdit.disabled = false;
        var on = editToggle.getAttribute('aria-pressed') === 'true';
        gsEdit.setAttribute('aria-pressed', on ? 'true' : 'false');
        gsEdit.querySelector('span:last-child').textContent = on ? '编辑开' : '编辑';
      }
    }
  }

  sync();
  setInterval(sync, 350);
})();
