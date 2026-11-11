/* SIMC Radiology Portal – app shell
 * - shows the Google Apps Script portal full screen
 * - offers to install the app (Android / Chrome / Edge: real install prompt; iPhone/iPad and Mac Safari: short instructions)
 * - asks people who opened the link inside Messenger / Facebook etc. to open it in a real browser first
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone === true;
  var LATER_KEY = 'simc_install_later', LATER_DAYS = 3;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- 1. opened inside Messenger / Facebook / Instagram …? ---------- */
  function inAppName() {
    if (/FBAN\/Messenger|MessengerForiOS|Orca-Android/i.test(ua)) return 'Messenger';
    if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return 'Facebook';
    if (/Instagram/i.test(ua)) return 'Instagram';
    if (/Viber/i.test(ua)) return 'Viber';
    if (/Line\//i.test(ua)) return 'LINE';
    if (/MicroMessenger/i.test(ua)) return 'WeChat';
    if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'TikTok';
    if (isAndroid && /; wv\)/.test(ua)) return 'an app';
    return '';
  }
  var here = location.href.split('#')[0];
  var app = inAppName();
  if (app) {
    var br = isIOS ? 'Safari' : 'Chrome';
    $('inapp').style.display = 'flex'; $('splash').classList.add('gone');
    $('iaName').textContent = app; $('iaBr').textContent = br; $('iaUrl').textContent = here;
    $('iaSteps').innerHTML = '<b>If the button doesn’t work:</b><br>' + (isIOS
      ? '1. Tap <b>•••</b> (or the compass icon).<br>2. Choose <b>Open in Safari</b> / <b>Open in external browser</b>.'
      : '1. Tap <b>⋮</b> at the top right.<br>2. Choose <b>Open in Chrome</b> / <b>Open in browser</b>.') +
      '<br>Or tap <b>Copy link</b> and paste it into ' + br + '.';
    $('iaOpen').onclick = function () {
      var t = isIOS ? 'x-safari-' + here
        : 'intent://' + here.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(here) + ';end';
      location.href = t;
    };
    $('iaCopy').onclick = function () {
      var ok = false;
      try { var ta = document.createElement('textarea'); ta.value = here; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e) {}
      if (!ok && navigator.clipboard) navigator.clipboard.writeText(here);
      $('iaCopy').textContent = 'Link copied ✓';
    };
    return;   // do not load the portal inside the in-app browser
  }

  /* ---------- 2. load the portal ---------- */
  var frame = $('portal'), splash = $('splash');
  var slowTimer = setTimeout(function () { $('slow').style.display = 'block'; }, 20000);
  frame.addEventListener('load', function () {
    clearTimeout(slowTimer);
    setTimeout(function () { splash.classList.add('gone'); }, 400);
  });
  frame.src = window.PORTAL_URL;

  function onlineState() { $('offline').style.display = navigator.onLine ? 'none' : 'block'; }
  window.addEventListener('online', function () { onlineState(); if (!frame.dataset.ok) location.reload(); });
  window.addEventListener('offline', onlineState);
  onlineState();
  frame.addEventListener('load', function () { frame.dataset.ok = '1'; });

  /* ---------- 3. service worker (needed for installing; keeps the shell available) ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  /* ---------- 4. install prompt ---------- */
  if (standalone) return;   // already installed and opened as an app
  var deferred = null, box = $('install');
  function snoozed() { var t = Number(store(LATER_KEY) || 0); return t && Date.now() - t < LATER_DAYS * 864e5; }
  function show(h, p, btnText) {
    if (snoozed()) return;
    $('insH').textContent = h; $('insP').innerHTML = p;
    $('insBtn').style.display = btnText ? '' : 'none'; if (btnText) $('insBtn').textContent = btnText;
    setTimeout(function () { box.classList.add('show'); }, 2500);   // let the portal appear first
  }
  function hide(snooze) { box.classList.remove('show'); if (snooze) store(LATER_KEY, String(Date.now())); }
  $('laterBtn').onclick = function () { hide(true); };
  $('closeBtn').onclick = function () { hide(true); };

  // Android, Chrome, Edge (desktop + phone): the browser's own install prompt
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    show('Install SIMC Radiology', 'Add the portal to your ' + (isAndroid ? 'home screen' : 'computer') + ' for one-tap access, full screen, like a regular app.', 'Install');
  });
  $('insBtn').onclick = function () {
    if (!deferred) return hide(false);
    deferred.prompt();
    deferred.userChoice.then(function (r) { if (r && r.outcome !== 'accepted') store(LATER_KEY, String(Date.now())); hide(false); deferred = null; });
  };
  window.addEventListener('appinstalled', function () { hide(false); store(LATER_KEY, null); });

  // iPhone / iPad (Safari has no install prompt: show the two steps)
  var share = '<svg class="ios-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  if (isIOS) {
    var otherBrowser = /CriOS|FxiOS|EdgiOS/.test(ua);
    show('Install SIMC Radiology',
      'Tap ' + share + ' <b>Share</b> ' + (otherBrowser ? '(at the top or bottom)' : 'at the bottom of Safari') + ', then <b>Add to Home Screen</b>.' +
      (otherBrowser ? ' If you don’t see it, open this page in <b>Safari</b>.' : ''), '');
  } else if (isMacSafari) {
    show('Install SIMC Radiology', 'In Safari, choose <b>File → Add to Dock</b> to install the portal as an app.', '');
  }
})();
