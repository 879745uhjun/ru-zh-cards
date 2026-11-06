(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  var refreshing = false;
  var banner = null;
  var waitingWorker = null;

  function ensureBanner() {
    if (banner || !document.body) return banner;
    banner = document.createElement('div');
    banner.id = 'pwaUpdate';
    banner.hidden = true;
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML =
      '<div class="pwa-update-copy"><strong>新版本已准备好</strong><span>刷新后使用最新内容</span></div>' +
      '<div class="pwa-update-actions"><button type="button" class="pwa-later">稍后</button><button type="button" class="pwa-reload">刷新</button></div>';
    var style = document.createElement('style');
    style.textContent = [
      '#pwaUpdate{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:95;display:flex;align-items:center;gap:16px;width:min(560px,calc(100% - 30px));padding:11px 13px 11px 16px;border:1px solid #d8cdbb;border-radius:14px;background:#fffdf8;box-shadow:0 16px 42px rgba(31,42,56,.2);font-family:var(--sans,sans-serif)}',
      '#pwaUpdate[hidden]{display:none}',
      '#pwaUpdate .pwa-update-copy{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}',
      '#pwaUpdate strong{font-size:11px;color:#1f2a38}',
      '#pwaUpdate span{font-size:9px;color:#7d7367}',
      '#pwaUpdate .pwa-update-actions{display:flex;align-items:center;gap:7px;flex:0 0 auto}',
      '#pwaUpdate button{border:0;border-radius:999px;font-family:inherit;font-size:10px;cursor:pointer;padding:7px 12px}',
      '#pwaUpdate .pwa-later{background:transparent;color:#7d7367}',
      '#pwaUpdate .pwa-reload{background:#b23a2f;color:#fff;font-weight:700}',
      '@media(max-width:480px){#pwaUpdate{flex-direction:column;align-items:stretch;gap:8px;padding:11px 12px}#pwaUpdate .pwa-update-actions{justify-content:flex-end}#pwaUpdate .pwa-reload{padding:8px 16px}}'
    ].join('\n');
    document.head.appendChild(style);
    document.body.appendChild(banner);
    banner.querySelector('.pwa-later').addEventListener('click', function () { banner.hidden = true; });
    banner.querySelector('.pwa-reload').addEventListener('click', function () {
      if (!waitingWorker) { location.reload(); return; }
      refreshing = true;
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(function () { location.reload(); }, 1500);
    });
    return banner;
  }

  function showUpdate(worker) {
    waitingWorker = worker || null;
    ensureBanner();
    if (banner) banner.hidden = false;
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) location.reload();
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });
      setTimeout(function () { reg.update().catch(function () {}); }, 1500);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) reg.update().catch(function () {});
      });
    }).catch(function () {});
  });
})();
