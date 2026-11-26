/* SIMC Radiology – ultrasound images & clips viewer (shared by the portal and the PACS; downloaded the first time it is needed).
 * Uses the page's run(), esc() and token. Files are fetched in 4 MB pieces (usmGet) and kept in memory for this visit only. */
(function () {
  var CACHE = {}, BOX = null, CUR = null;
  function $(id) { return document.getElementById(id); }
  function css() {
    if ($('usmCss')) return;
    var s = document.createElement('style'); s.id = 'usmCss';
    s.textContent =
      '.usmstrip{display:flex;gap:8px;overflow-x:auto;padding:4px 0 8px}' +
      '.usmt{position:relative;flex:0 0 auto;width:110px;height:82px;border-radius:10px;overflow:hidden;background:#0d1418;border:1px solid var(--line,#ccd);cursor:pointer;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:12px;padding:0}' +
      '.usmt img{width:100%;height:100%;object-fit:cover}.usmt .b{position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,.65);color:#fff;border-radius:6px;padding:1px 6px;font-size:11px}' +
      '.usmt .x{position:absolute;top:2px;right:2px;width:22px;height:22px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:14px;line-height:22px;cursor:pointer}' +
      '#usmBox{position:fixed;inset:0;z-index:9999;background:#05090c;color:#e2e8f0;display:flex;flex-direction:column}' +
      '#usmBox .bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;background:#0d1418}' +
      '#usmBox .bar button,#usmBox .bar select{width:auto;min-height:0;margin:0;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer;flex:0 0 auto}' +
      '#usmBox .bar .t{flex:1;min-width:120px;font-size:13px;color:#94a3b8}' +
      '#usmStage{flex:1;position:relative;overflow:hidden;touch-action:none;display:flex;align-items:center;justify-content:center}' +
      '#usmStage img,#usmStage video{max-width:100%;max-height:100%;transform-origin:center center;user-select:none}' +
      '#usmStage .msg{color:#94a3b8;font-size:14px}' +
      '#usmBox .nav{min-height:0;margin:0;padding:0;position:absolute;top:50%;transform:translateY(-50%);background:rgba(15,23,42,.7);color:#fff;border:0;width:44px;height:64px;font-size:26px;cursor:pointer;border-radius:10px}';
    document.head.appendChild(s);
  }
  /** Whole file as a Blob (pieces of 4 MB). onp(fraction) for progress. */
  function blob(rid, it, onp) {
    if (CACHE[it.id]) return Promise.resolve(CACHE[it.id]);
    var parts = [], tries = 0;
    function step(off) {
      return run('usmGet', token, rid, it.id, off).then(function (r) {
        if (r.expired) { if (typeof expired === 'function') expired(); throw new Error('Session ended'); }
        if (!r.ok) { if (r.retry && tries++ < 3) return step(off); throw new Error(r.msg || 'Could not load'); }
        var bin = atob(r.b64), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
        parts.push(a); if (onp) onp(r.total ? (off + a.length) / r.total : 1);
        return r.next ? step(r.next) : new Blob(parts, { type: r.mime || it.mime });
      });
    }
    return step(0).then(function (b) { CACHE[it.id] = b; return b; });
  }
  function dur(ms) { if (!ms) return ''; var s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  /** Thumbnail strip into el; opts {canRemove, onChange}. Returns the list call's promise. */
  function strip(el, rid, opts) {
    css(); opts = opts || {};
    el.innerHTML = '<p class="sub" style="margin:4px 0">Loading images…</p>';
    return run('usmList', token, rid).then(function (r) {
      if (r.expired) { if (typeof expired === 'function') expired(); return r; }
      if (!r.ok) { el.innerHTML = '<p class="sub err">' + esc(r.msg) + '</p>'; return r; }
      if (r.removed) { el.innerHTML = '<p class="sub" style="margin:4px 0">🗑 Images and clips were deleted ' + (r.removedAt ? new Date(r.removedAt).toLocaleDateString() : '') + ' (kept ' + r.keepDays + ' days after the report).</p>'; return r; }
      if (!r.items.length) { el.innerHTML = '<p class="sub" style="margin:4px 0">No images or clips.</p>'; return r; }
      var canRm = opts.canRemove && r.canRemove;
      el.innerHTML = '<div class="usmstrip">' + r.items.map(function (it, i) {
        return '<button type="button" class="usmt" data-i="' + i + '" title="' + esc(it.name) + '"><span class="ic">' + (it.clip ? '🎞' : '🖼') + '</span><span class="b">' + (i + 1) + (it.clip ? ' · ▶ ' + dur(it.dur) : '') + '</span>' +
          (canRm ? '<span class="x" role="button" tabindex="0" data-rm="' + i + '" title="Remove">×</span>' : '') + '</button>';
      }).join('') + '</div>' + (r.deleteOn ? '<p class="hint" style="margin:0">Kept until ' + new Date(r.deleteOn).toLocaleDateString() + ' (' + r.keepDays + ' days after the report).</p>' : '');
      var thumbQ = [];   // stills load one after another (not all at once)
      Array.prototype.forEach.call(el.querySelectorAll('.usmt'), function (b) {
        var i = +b.getAttribute('data-i'), it = r.items[i];
        b.onclick = function (e) {
          if (e.target.getAttribute('data-rm') != null) {
            e.stopPropagation(); if (!window.confirm('Remove image ' + (i + 1) + ' from this study?')) return;
            run('usmRemove', token, rid, it.id).then(function (x) { if (!x.ok) return alert(x.msg); delete CACHE[it.id]; strip(el, rid, opts); if (opts.onChange) opts.onChange(); });
            return;
          }
          open(rid, r.items, i);
        };
        if (!it.clip) thumbQ.push(function () { return blob(rid, it).then(function (bl) { var ic = b.querySelector('.ic'); if (ic) ic.outerHTML = '<img alt="" src="' + URL.createObjectURL(bl) + '">'; }).catch(function () {}); });
      });
      thumbQ.reduce(function (p, f) { return p.then(f); }, Promise.resolve());
      return r;
    }).catch(function (e) { el.innerHTML = '<p class="sub err">Could not load the images: ' + esc((e && e.message) || e) + '</p>'; });
  }
  /* ---------- full-screen viewer ---------- */
  var V = { z: 1, x: 0, y: 0, b: 100, c: 100 };
  function open(rid, items, i) {
    css();
    if (!BOX) {
      BOX = document.createElement('div'); BOX.id = 'usmBox'; BOX.setAttribute('role', 'dialog'); BOX.setAttribute('aria-label', 'Ultrasound images');
      BOX.innerHTML = '<div class="bar"><span class="t" id="usmT"></span>' +
        '<button type="button" id="usmFm" title="Previous frame (paused)">⏮ Frame</button><button type="button" id="usmFp" title="Next frame (paused)">Frame ⏭</button>' +
        '<select id="usmSp" title="Speed"><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1" selected>1×</option></select>' +
        '<button type="button" id="usmZ0" title="Fit">Fit</button><button type="button" id="usmZp">＋</button><button type="button" id="usmZm">－</button>' +
        '<button type="button" id="usmBc" title="Brightness / contrast">☀ B/C</button><button type="button" id="usmX">✕ Close</button></div>' +
        '<div id="usmStage"></div><button type="button" class="nav" id="usmPrev" style="left:8px">‹</button><button type="button" class="nav" id="usmNext" style="right:8px">›</button>';
      document.body.appendChild(BOX);
      $('usmX').onclick = close; $('usmPrev').onclick = function () { go(-1); }; $('usmNext').onclick = function () { go(1); };
      $('usmZ0').onclick = function () { V.z = 1; V.x = V.y = 0; apply(); }; $('usmZp').onclick = function () { V.z = Math.min(8, V.z * 1.25); apply(); }; $('usmZm').onclick = function () { V.z = Math.max(1, V.z / 1.25); if (V.z === 1) V.x = V.y = 0; apply(); };
      $('usmBc').onclick = function () { V.bc = !V.bc; $('usmBc').style.background = V.bc ? '#0f766e' : ''; };
      $('usmSp').onchange = function () { var v = media(); if (v && v.tagName === 'VIDEO') v.playbackRate = +this.value; };
      $('usmFm').onclick = function () { frame(-1); }; $('usmFp').onclick = function () { frame(1); };
      var st = $('usmStage'), drag = null;
      st.addEventListener('wheel', function (e) { e.preventDefault(); V.z = Math.max(1, Math.min(8, V.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); if (V.z === 1) V.x = V.y = 0; apply(); }, { passive: false });
      st.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, vx: V.x, vy: V.y, b: V.b, c: V.c }; st.setPointerCapture(e.pointerId); });
      st.addEventListener('pointermove', function (e) {
        if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (V.bc) { V.b = Math.max(20, Math.min(300, drag.b + dx / 3)); V.c = Math.max(20, Math.min(300, drag.c - dy / 3)); } else if (V.z > 1) { V.x = drag.vx + dx; V.y = drag.vy + dy; }
        apply();
      });
      st.addEventListener('pointerup', function () { drag = null; });
      st.addEventListener('dblclick', function () { V.z = V.z > 1 ? 1 : 2.5; V.x = V.y = 0; apply(); });
      document.addEventListener('keydown', function (e) {   // capture phase: the page's own keys (Esc closes the report…) must not fire under the viewer
        if (!BOX || BOX.style.display === 'none') return;
        var k = e.key, hit = true;
        if (k === 'Escape') close(); else if (k === 'ArrowLeft') go(-1); else if (k === 'ArrowRight') go(1);
        else if (k === ',') frame(-1); else if (k === '.') frame(1);
        else if (k === ' ') { var v = media(); if (v && v.tagName === 'VIDEO') { e.preventDefault(); v.paused ? v.play() : v.pause(); } }
        else hit = false;
        if (hit) { e.stopImmediatePropagation(); e.stopPropagation(); }
      }, true);
    }
    BOX.style.display = 'flex'; document.body.style.overflow = 'hidden';
    CUR = { rid: rid, items: items, i: i }; show();
  }
  function media() { return $('usmStage').querySelector('img,video'); }
  function apply() { var m = media(); if (m) { m.style.transform = 'translate(' + V.x + 'px,' + V.y + 'px) scale(' + V.z + ')'; m.style.filter = 'brightness(' + V.b + '%) contrast(' + V.c + '%)'; } }
  function frame(d) { var v = media(); if (!v || v.tagName !== 'VIDEO') return; v.pause(); v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d / 30)); }
  function go(d) { if (!CUR) return; var n = CUR.items.length; CUR.i = (CUR.i + d + n) % n; show(); }
  function show() {
    var it = CUR.items[CUR.i], st = $('usmStage'), me = CUR;
    V.z = 1; V.x = V.y = 0; V.b = V.c = 100;
    $('usmT').textContent = (CUR.i + 1) + ' / ' + CUR.items.length + ' · ' + (it.clip ? 'Clip' + (it.dur ? ' ' + dur(it.dur) : '') : 'Image');
    ['usmFm', 'usmFp', 'usmSp'].forEach(function (id) { $(id).style.display = it.clip ? '' : 'none'; });
    $('usmPrev').style.display = $('usmNext').style.display = CUR.items.length > 1 ? '' : 'none';
    st.innerHTML = '<div class="msg" id="usmP">Loading…</div>';
    blob(CUR.rid, it, function (f) { var p = $('usmP'); if (p) p.textContent = 'Loading… ' + Math.round(f * 100) + '%'; }).then(function (b) {
      if (CUR !== me || CUR.items[CUR.i] !== it) return;
      var u = URL.createObjectURL(b);
      st.innerHTML = it.clip ? '<video src="' + u + '" controls loop autoplay muted playsinline></video>' : '<img alt="Ultrasound image ' + (CUR.i + 1) + '" src="' + u + '" draggable="false">';
      var v = media(); if (it.clip) v.playbackRate = +$('usmSp').value;
      apply();
    }).catch(function (e) { st.innerHTML = '<div class="msg">' + esc((e && e.message) || 'Could not load') + '</div>'; });
  }
  function close() { if (!BOX) return; var v = media(); if (v && v.pause) v.pause(); BOX.style.display = 'none'; $('usmStage').innerHTML = ''; document.body.style.overflow = ''; CUR = null; }
  window.USM = { strip: strip, open: open, close: close, blob: blob };
})();
