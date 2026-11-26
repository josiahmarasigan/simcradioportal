/* SIMC Radiology – ultrasound images & clips viewer (shared by the portal and the PACS; downloaded the first time it is needed).
 * Uses the page's run(), esc() and token. Files come in 8 MB pieces (usmGet), 3 pieces at a time, and are kept in memory for
 * this visit only. USM.inline() shows them beside the report (like the X-ray reader); USM.open() is the full-screen viewer. */
(function () {
  var CACHE = {}, PEND = {}, BOX = null, FULL = null;
  function $(id) { return document.getElementById(id); }
  function css() {
    if ($('usmCss')) return;
    var s = document.createElement('style'); s.id = 'usmCss';
    s.textContent =
      '.usmstrip{display:flex;gap:8px;overflow-x:auto;padding:4px 0 8px}' +
      '.usmt{position:relative;flex:0 0 auto;width:110px;height:82px;border-radius:10px;overflow:hidden;background:#0d1418;border:1px solid var(--line,#ccd);cursor:pointer;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:12px;padding:0;margin:0;min-height:0}' +
      '.usmt img{width:100%;height:100%;object-fit:cover}.usmt .b{position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,.65);color:#fff;border-radius:6px;padding:1px 6px;font-size:11px}' +
      '.usmt .x{position:absolute;top:2px;right:2px;width:22px;height:22px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:14px;line-height:22px;cursor:pointer}' +
      '.usmt.on{outline:3px solid #2dd4bf;outline-offset:-3px}.usmt .pg{position:absolute;left:0;bottom:0;height:3px;background:#2dd4bf}' +
      '.usmv{display:flex;flex-direction:column;min-height:0;height:100%;background:#05090c;color:#e2e8f0}' +
      '#usmBox{position:fixed;inset:0;z-index:9999}' +
      '.usmv .bar{display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:6px;background:#111}' +
      '.usmv .bar button,.usmv .bar select{width:auto;min-height:0;margin:0;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer;flex:0 0 auto}' +
      '.usmv .bar button.on{background:#0f766e;border-color:#0f766e}.usmv .bar .t{flex:1;min-width:90px;font-size:12.5px;color:#94a3b8;padding:0 4px}' +
      '.usmv .stage{flex:1;position:relative;overflow:hidden;touch-action:none;display:flex;align-items:center;justify-content:center;min-height:0}' +
      '.usmv .stage img,.usmv .stage video{max-width:100%;max-height:100%;transform-origin:center center;user-select:none}' +
      '.usmv .stage .msg{color:#94a3b8;font-size:14px;text-align:center}.usmv .stage .msg i{display:block;width:180px;height:4px;background:#1e293b;border-radius:3px;margin:8px auto 0;overflow:hidden}.usmv .stage .msg i b{display:block;height:100%;background:#2dd4bf;width:0}' +
      '.usmv .nav{min-height:0;margin:0;padding:0;position:absolute;top:50%;transform:translateY(-50%);background:rgba(15,23,42,.7);color:#fff;border:0;width:40px;height:60px;font-size:24px;cursor:pointer;border-radius:10px;z-index:2}' +
      '.usmv .thumbs{display:flex;gap:6px;overflow-x:auto;padding:6px;background:#0d1418}.usmv .thumbs .usmt{width:84px;height:62px;border-color:#334155}';
    document.head.appendChild(s);
  }
  /* ---------- fetching: 8 MB pieces, 3 at a time; one download per file even if asked twice ---------- */
  var LISTEN = {};
  function prog(id, f) { (LISTEN[id] || []).forEach(function (cb) { try { cb(f); } catch (e) {} }); }
  function onProg(id, cb) { (LISTEN[id] = LISTEN[id] || []).push(cb); }
  function piece(rid, it, off, tries) {
    return run('usmGet', token, rid, it.id, off).then(function (r) {
      if (r.expired) { if (typeof expired === 'function') expired(); throw new Error('Session ended'); }
      if (!r.ok) { if (r.retry && (tries || 0) < 3) return piece(rid, it, off, (tries || 0) + 1); throw new Error(r.msg || 'Could not load'); }
      var bin = atob(r.b64), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      r.bytes = a; return r;
    });
  }
  function blob(rid, it, onp) {
    if (CACHE[it.id]) { if (onp) onp(1); return Promise.resolve(CACHE[it.id]); }
    if (onp) onProg(it.id, onp);
    if (PEND[it.id]) return PEND[it.id];
    var got = 0;
    PEND[it.id] = piece(rid, it, 0).then(function (first) {
      var total = first.total || first.bytes.length, size = first.piece || first.bytes.length, parts = [first.bytes], offs = [];
      got = first.bytes.length; prog(it.id, total ? got / total : 1);
      for (var o = first.next; o && o < total; o += size) offs.push(o);
      var k = 0;
      function worker() {
        if (k >= offs.length) return Promise.resolve();
        var idx = k++, off = offs[idx];
        return piece(rid, it, off).then(function (r) { parts[idx + 1] = r.bytes; got += r.bytes.length; prog(it.id, got / total); return worker(); });
      }
      return Promise.all([worker(), worker(), worker()]).then(function () { return new Blob(parts, { type: first.mime || it.mime }); });
    }).then(function (b) { CACHE[it.id] = b; delete PEND[it.id]; delete LISTEN[it.id]; return b; }, function (e) { delete PEND[it.id]; delete LISTEN[it.id]; throw e; });
    return PEND[it.id];
  }
  /** Background download of the rest, one file at a time (stills first), so a clip is ready when it is opened. */
  function prefetch(rid, items) {
    items.filter(function (x) { return !x.clip; }).concat(items.filter(function (x) { return x.clip; }))
      .reduce(function (p, it) { return p.then(function () { return CACHE[it.id] ? null : blob(rid, it).catch(function () {}); }); }, Promise.resolve());
  }
  function dur(ms) { if (!ms) return ''; var s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function list(rid) { return run('usmList', token, rid).then(function (r) { if (r.expired && typeof expired === 'function') expired(); return r; }); }
  function removedHtml(r) { return '🗑 Images and clips were deleted ' + (r.removedAt ? new Date(r.removedAt).toLocaleDateString() : '') + ' (kept ' + r.keepDays + ' days after the report).'; }
  /** Thumbnail strip into el; opts {canRemove, onChange}. */
  function strip(el, rid, opts) {
    css(); opts = opts || {};
    el.innerHTML = '<p class="sub" style="margin:4px 0">Loading images…</p>';
    return list(rid).then(function (r) {
      if (!r.ok) { el.innerHTML = '<p class="sub err">' + esc(r.msg || '') + '</p>'; return r; }
      if (r.removed) { el.innerHTML = '<p class="sub" style="margin:4px 0">' + removedHtml(r) + '</p>'; return r; }
      if (!r.items.length) { el.innerHTML = '<p class="sub" style="margin:4px 0">No images or clips.</p>'; return r; }
      var canRm = opts.canRemove && r.canRemove;
      el.innerHTML = '<div class="usmstrip">' + thumbsHtml(r.items, canRm) + '</div>' + (r.deleteOn ? '<p class="hint" style="margin:0">Kept until ' + new Date(r.deleteOn).toLocaleDateString() + ' (' + r.keepDays + ' days after the report).</p>' : '');
      wireThumbs(el, rid, r.items, function (i) { open(rid, r.items, i); }, canRm ? function (i) { removeIt(rid, r.items[i], function () { strip(el, rid, opts); if (opts.onChange) opts.onChange(); }); } : null);
      return r;
    }).catch(function (e) { el.innerHTML = '<p class="sub err">Could not load the images: ' + esc((e && e.message) || e) + '</p>'; });
  }
  function thumbsHtml(items, canRm) {
    return items.map(function (it, i) {
      return '<button type="button" class="usmt" data-i="' + i + '" title="' + esc(it.name) + '"><span class="ic">' + (it.clip ? '🎞' : '🖼') + '</span><span class="b">' + (i + 1) + (it.clip ? ' · ▶ ' + dur(it.dur) : '') + '</span>' +
        (canRm ? '<span class="x" role="button" tabindex="0" data-rm="' + i + '" title="Remove">×</span>' : '') + '<span class="pg"></span></button>';
    }).join('');
  }
  function wireThumbs(el, rid, items, pick, rm) {
    var q = [];
    Array.prototype.forEach.call(el.querySelectorAll('.usmt'), function (b) {
      var i = +b.getAttribute('data-i'), it = items[i];
      b.onclick = function (e) { if (rm && e.target.getAttribute('data-rm') != null) { e.stopPropagation(); return rm(i); } pick(i); };
      if (!it.clip) q.push(function () { return blob(rid, it).then(function (bl) { var ic = b.querySelector('.ic'); if (ic) ic.outerHTML = '<img alt="" src="' + URL.createObjectURL(bl) + '">'; }).catch(function () {}); });
      else onProg(it.id, function (f) { var pg = b.querySelector('.pg'); if (pg) pg.style.width = Math.round(f * 100) + '%'; });
    });
    return q;
  }
  function removeIt(rid, it, done) {
    if (!window.confirm('Remove this ' + (it.clip ? 'clip' : 'image') + ' from the study?')) return;
    run('usmRemove', token, rid, it.id).then(function (x) { if (!x.ok) return alert(x.msg); delete CACHE[it.id]; done(); });
  }
  /* ---------- the viewer (one per container) ---------- */
  function Viewer(root, o) {
    css(); o = o || {};
    var me = this; me.root = root; me.o = o; me.V = { z: 1, x: 0, y: 0, b: 100, c: 100 };
    root.classList.add('usmv');
    root.innerHTML = '<div class="bar"><span class="t"></span>' +
      '<button type="button" data-a="fm" title="Previous frame (paused) – , key">⏮ Frame</button><button type="button" data-a="fp" title="Next frame (paused) – . key">Frame ⏭</button>' +
      '<select data-a="sp" title="Speed"><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1" selected>1×</option></select>' +
      '<button type="button" data-a="z0" title="Fit">Fit</button><button type="button" data-a="zp">＋</button><button type="button" data-a="zm">－</button>' +
      '<button type="button" data-a="bc" title="Brightness / contrast: then drag">☀ B/C</button>' +
      (o.full ? '<button type="button" data-a="x">✕ Close</button>' : '<button type="button" data-a="fs" title="Full screen">⛶</button>') + '</div>' +
      '<div class="stage"></div>' + (o.thumbs ? '<div class="thumbs"></div>' : '');
    me.q = function (a) { return root.querySelector('[data-a="' + a + '"]'); };
    me.stage = root.querySelector('.stage');
    me.q('z0').onclick = function () { me.V.z = 1; me.V.x = me.V.y = 0; me.apply(); };
    me.q('zp').onclick = function () { me.V.z = Math.min(8, me.V.z * 1.25); me.apply(); };
    me.q('zm').onclick = function () { me.V.z = Math.max(1, me.V.z / 1.25); if (me.V.z === 1) me.V.x = me.V.y = 0; me.apply(); };
    me.q('bc').onclick = function () { me.V.bc = !me.V.bc; this.classList.toggle('on', me.V.bc); };
    me.q('sp').onchange = function () { var v = me.media(); if (v && v.tagName === 'VIDEO') v.playbackRate = +this.value; };
    me.q('fm').onclick = function () { me.frame(-1); }; me.q('fp').onclick = function () { me.frame(1); };
    if (me.q('x')) me.q('x').onclick = function () { close(); };
    if (me.q('fs')) me.q('fs').onclick = function () { var v = me.media(); if (v && v.pause) v.pause(); open(me.rid, me.items, me.i); };
    var st = me.stage, drag = null;
    st.addEventListener('wheel', function (e) { e.preventDefault(); me.V.z = Math.max(1, Math.min(8, me.V.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); if (me.V.z === 1) me.V.x = me.V.y = 0; me.apply(); }, { passive: false });
    st.addEventListener('pointerdown', function (e) { if (e.target.closest('video') && e.offsetY > e.target.clientHeight - 48) return; drag = { x: e.clientX, y: e.clientY, vx: me.V.x, vy: me.V.y, b: me.V.b, c: me.V.c }; });
    st.addEventListener('pointermove', function (e) {
      if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (me.V.bc) { me.V.b = Math.max(20, Math.min(300, drag.b + dx / 3)); me.V.c = Math.max(20, Math.min(300, drag.c - dy / 3)); } else if (me.V.z > 1) { me.V.x = drag.vx + dx; me.V.y = drag.vy + dy; }
      me.apply();
    });
    st.addEventListener('pointerup', function () { drag = null; }); st.addEventListener('pointerleave', function () { drag = null; });
    st.addEventListener('dblclick', function () { me.V.z = me.V.z > 1 ? 1 : 2.5; me.V.x = me.V.y = 0; me.apply(); });
  }
  Viewer.prototype.media = function () { return this.stage.querySelector('img,video'); };
  Viewer.prototype.apply = function () { var m = this.media(), V = this.V; if (m) { m.style.transform = 'translate(' + V.x + 'px,' + V.y + 'px) scale(' + V.z + ')'; m.style.filter = 'brightness(' + V.b + '%) contrast(' + V.c + '%)'; } };
  Viewer.prototype.frame = function (d) { var v = this.media(); if (!v || v.tagName !== 'VIDEO') return; v.pause(); v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d / 30)); };
  Viewer.prototype.go = function (d) { var n = this.items.length; if (n) this.show((this.i + d + n) % n); };
  Viewer.prototype.set = function (rid, items, i) {
    var me = this; me.rid = rid; me.items = items;
    if (!me.navs) {
      me.navs = 1; var p = document.createElement('button'), n = document.createElement('button');
      p.type = n.type = 'button'; p.className = n.className = 'nav'; p.textContent = '‹'; n.textContent = '›'; p.style.left = '6px'; n.style.right = '6px';
      p.onclick = function () { me.go(-1); }; n.onclick = function () { me.go(1); };
      if (!me.o.full) me.root.style.position = 'relative';
      me.root.appendChild(p); me.root.appendChild(n); me.navP = p; me.navN = n;
    }
    me.navP.style.display = me.navN.style.display = items.length > 1 ? '' : 'none';
    var th = me.root.querySelector('.thumbs');
    if (th) { th.innerHTML = thumbsHtml(items, false); var q = wireThumbs(th, rid, items, function (k) { me.show(k); }); me.thumbQ = q; }
    me.show(i || 0);
    return me;
  };
  Viewer.prototype.show = function (i) {
    var me = this, it = me.items[i], tok = {};
    me.i = i; me.tok = tok; me.V.z = 1; me.V.x = me.V.y = 0; me.V.b = me.V.c = 100;
    me.root.querySelector('.t').textContent = (i + 1) + ' / ' + me.items.length + ' · ' + (it.clip ? 'Clip' + (it.dur ? ' ' + dur(it.dur) : '') : 'Image');
    ['fm', 'fp', 'sp'].forEach(function (a) { me.q(a).style.display = it.clip ? '' : 'none'; });
    Array.prototype.forEach.call(me.root.querySelectorAll('.thumbs .usmt'), function (b) { b.classList.toggle('on', +b.getAttribute('data-i') === i); });
    var old = me.media(); if (old && old.pause) old.pause();
    me.stage.innerHTML = '<div class="msg">Loading ' + (it.clip ? 'clip' : 'image') + '…<i><b></b></i></div>';
    var bar = me.stage.querySelector('b');
    blob(me.rid, it, function (f) { if (me.tok === tok && bar) bar.style.width = Math.round(f * 100) + '%'; }).then(function (b) {
      if (me.tok !== tok) return;
      var u = URL.createObjectURL(b);
      me.stage.innerHTML = it.clip ? '<video src="' + u + '" controls loop autoplay muted playsinline></video>' : '<img alt="Ultrasound image ' + (i + 1) + '" src="' + u + '" draggable="false">';
      if (it.clip) me.media().playbackRate = +me.q('sp').value;
      me.apply();
      if (!me.pre) { me.pre = 1; (me.thumbQ || []).reduce(function (p, f) { return p.then(f); }, Promise.resolve()).then(function () { prefetch(me.rid, me.items); }); }
    }).catch(function (e) { if (me.tok === tok) me.stage.innerHTML = '<div class="msg">' + esc((e && e.message) || 'Could not load') + '</div>'; });
  };
  Viewer.prototype.stop = function () { var v = this.media(); if (v && v.pause) v.pause(); this.tok = null; };
  /* ---------- full screen ---------- */
  function open(rid, items, i) {
    css();
    if (!BOX) {
      BOX = document.createElement('div'); BOX.id = 'usmBox'; BOX.setAttribute('role', 'dialog'); BOX.setAttribute('aria-label', 'Ultrasound images');
      document.body.appendChild(BOX); FULL = new Viewer(BOX, { full: true });
      document.addEventListener('keydown', function (e) {   // capture phase: the page's own keys (Esc closes the report…) must not fire under the viewer
        if (!BOX || BOX.style.display === 'none') return;
        var k = e.key, hit = true;
        if (k === 'Escape') close(); else if (k === 'ArrowLeft') FULL.go(-1); else if (k === 'ArrowRight') FULL.go(1);
        else if (k === ',') FULL.frame(-1); else if (k === '.') FULL.frame(1);
        else if (k === ' ') { var v = FULL.media(); if (v && v.tagName === 'VIDEO') { e.preventDefault(); v.paused ? v.play() : v.pause(); } }
        else hit = false;
        if (hit) { e.stopImmediatePropagation(); e.stopPropagation(); }
      }, true);
    }
    BOX.style.display = 'flex'; document.body.style.overflow = 'hidden';
    FULL.set(rid, items, i);
  }
  function close() { if (!BOX) return; FULL.stop(); BOX.style.display = 'none'; FULL.stage.innerHTML = ''; document.body.style.overflow = ''; }
  /** Beside the report: loads the list, shows the first image, thumbnails underneath; resolves the list result. */
  function inline(el, rid, opts) {
    css(); opts = opts || {};
    return list(rid).then(function (r) {
      if (!r.ok || r.removed || !r.items.length) return r;
      var v = new Viewer(el, { thumbs: true });
      var first = 0; for (var k = 0; k < r.items.length; k++) if (!r.items[k].clip) { first = k; break; }
      v.set(rid, r.items, first); r.viewer = v;
      return r;
    });
  }
  window.USM = { strip: strip, open: open, close: close, blob: blob, inline: inline, removedHtml: removedHtml };
})();
