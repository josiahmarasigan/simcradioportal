/* SIMC portal – 🖼 Images: X-ray viewer for all staff (view only).
 * Loaded by index.html only the first time someone opens it. Uses the portal's run(), token, esc(), openFile().
 * Light on purpose: the list is text only; images load one at a time (screen size), the next one in the background;
 * at most 4 images are kept in memory and everything is released when the viewer closes. Nothing is stored on the device. */
(function () {
  var V = { list: [], st: null, cache: {}, order: [], i: 0, z: 1, x: 0, y: 0, inv: false, br: 100, ct: 100, full: false, seq: 0 };
  var KEEP = 4;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return window.esc ? window.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function when(ms) {
    if (!ms) return ''; var d = new Date(ms), now = new Date(), t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return 'Today ' + t;
    var y = new Date(now); y.setDate(now.getDate() - 1); if (d.toDateString() === y.toDateString()) return 'Yesterday ' + t;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + t;
  }
  var css = '' +
    '#imgv{position:fixed;inset:0;z-index:9;background:#0b1220;color:#e2e8f0;display:flex;flex-direction:column;font-size:14px}' +
    '#imgv.hidden{display:none}#imgv button{font:inherit}' +
    '#imgv .ivtop{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #1e293b;flex-wrap:wrap}' +
    '#imgv .ivt{flex:1;min-width:140px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#imgv .ivt span{font-weight:400;color:#94a3b8;margin-left:6px}' +
    '#imgv .ivb{padding:7px 12px;border-radius:8px;border:1px solid #334155;background:#111827;color:#e2e8f0;cursor:pointer;white-space:nowrap}' +
    '#imgv .ivb.on{background:#0f766e;border-color:#0f766e;color:#fff}#imgv .ivb.pri{background:#0f766e;border-color:#0f766e;color:#fff;font-weight:700}' +
    '#imgv input[type=search],#imgv select{padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#111827;color:#e2e8f0;margin:0;width:auto}' +
    '#imgv input[type=search]{flex:1;min-width:160px}' +
    '#imgv .ivlist{flex:1;overflow:auto;padding:8px 12px 20px}' +
    '#imgv .ivrow{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:11px 12px;margin:0 0 6px;border:1px solid #1e293b;border-radius:10px;background:#0f172a;color:#e2e8f0;cursor:pointer}' +
    '#imgv .ivrow:hover{border-color:#334155;background:#111c33}#imgv .ivrow .l{flex:1;min-width:0}#imgv .ivrow .d{color:#94a3b8;font-size:12.5px;margin-top:2px}' +
    '#imgv .pill{font-size:12px;padding:3px 8px;border-radius:999px;white-space:nowrap;background:#1e293b;color:#cbd5e1}#imgv .pill.ok{background:rgba(16,185,129,.18);color:#6ee7b7}#imgv .pill.wait{background:rgba(245,158,11,.16);color:#fcd34d}' +
    '#imgv .pri-STAT{color:#fca5a5;font-weight:700}#imgv .pri-Urgent{color:#fcd34d;font-weight:700}' +
    '#imgv .ivmsg{color:#94a3b8;padding:20px;text-align:center}' +
    '#imgv .ivstudy{flex:1;min-height:0;display:flex;flex-direction:column}' +
    '#imgv .ivtools{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #1e293b}' +
    '#imgv .ivtools label{display:flex;align-items:center;gap:4px;color:#94a3b8;font-size:12.5px}#imgv .ivtools input[type=range]{width:90px;margin:0}' +
    '#imgv .ivstage{position:relative;flex:1;min-height:0;overflow:hidden;background:#000;touch-action:none;cursor:grab}' +
    '#imgv .ivstage img{position:absolute;left:50%;top:50%;max-width:none;transform-origin:0 0;user-select:none;-webkit-user-drag:none}' +
    '#imgv .ivnav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:64px;border:0;border-radius:10px;background:rgba(15,23,42,.6);color:#fff;font-size:30px;cursor:pointer;z-index:2}' +
    '#imgv .ivl{left:8px}#imgv .ivr{right:8px}#imgv .ivstage .ivmsg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}' +
    '#imgv .ivfoot{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:8px 12px 12px;border-top:1px solid #1e293b}' +
    '#imgv .ivchip{min-width:34px;padding:5px 9px;border-radius:7px;border:1px solid #334155;background:#111827;color:#e2e8f0;cursor:pointer}#imgv .ivchip.on{background:#0f766e;border-color:#0f766e;color:#fff}' +
    '#imgv .ivres{margin-left:auto;color:#94a3b8;font-size:13px}' +
    '@media (max-width:600px){#imgv .ivtools label{display:none}#imgv .ivres{margin-left:0;width:100%}}';
  function build() {
    if ($('imgv')) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var d = document.createElement('div'); d.id = 'imgv'; d.className = 'hidden';
    d.innerHTML =
      '<div id="ivListView" style="display:flex;flex-direction:column;flex:1;min-height:0">' +
        '<div class="ivtop"><div class="ivt">🖼 X-ray images <span>view only</span></div><button class="ivb" onclick="IMGV.close()">Close ✕</button></div>' +
        '<div class="ivtop" style="border-bottom:0;padding-bottom:4px"><input type="search" id="ivQ" placeholder="Search name, ID no. or accession (last 30 days)" autocomplete="off">' +
          '<select id="ivDays"><option value="1">Today</option><option value="3" selected>Last 3 days</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>' +
          '<button class="ivb" onclick="IMGV.load()">↻</button></div>' +
        '<div class="ivlist" id="ivList"></div>' +
      '</div>' +
      '<div id="ivStudyView" class="ivstudy" style="display:none">' +
        '<div class="ivtop"><button class="ivb" onclick="IMGV.back()">← List</button><div class="ivt" id="ivTitle"></div><button class="ivb pri hidden" id="ivRes" onclick="IMGV.result()">📄 Result</button><button class="ivb" onclick="IMGV.close()">✕</button></div>' +
        '<div class="ivtools"><button class="ivb" onclick="IMGV.fit()">Fit</button><button class="ivb" onclick="IMGV.zoom(1.25)">+</button><button class="ivb" onclick="IMGV.zoom(0.8)">−</button>' +
          '<button class="ivb" id="ivInv" onclick="IMGV.invert()">Invert</button><label>Brightness <input type="range" id="ivBr" min="40" max="200" value="100"></label><label>Contrast <input type="range" id="ivCt" min="40" max="250" value="100"></label>' +
          '<button class="ivb" id="ivFull" onclick="IMGV.fullRes()" title="Load the original (bigger download) for fine detail">Full resolution</button><span id="ivNote" style="color:#94a3b8;font-size:12.5px"></span></div>' +
        '<div class="ivstage" id="ivStage"><img id="ivImg" alt="X-ray image"><div class="ivmsg" id="ivMsg"></div>' +
          '<button class="ivnav ivl" onclick="IMGV.step(-1)" aria-label="Previous image">‹</button><button class="ivnav ivr" onclick="IMGV.step(1)" aria-label="Next image">›</button></div>' +
        '<div class="ivfoot"><span id="ivChips"></span><span class="ivres" id="ivStatus"></span></div>' +
      '</div>';
    document.body.appendChild(d);
    var t = null; $('ivQ').addEventListener('input', function () { clearTimeout(t); t = setTimeout(load, 450); });
    $('ivDays').addEventListener('change', load);
    $('ivBr').addEventListener('input', function () { V.br = +this.value; paint(); }); $('ivCt').addEventListener('input', function () { V.ct = +this.value; paint(); });
    // zoom and pan: mouse wheel, drag, pinch (CSS transform only – no redrawing)
    var stg = $('ivStage'), ptrs = {}, pinch = 0;
    stg.addEventListener('wheel', function (e) { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.offsetX, e.offsetY); }, { passive: false });
    stg.addEventListener('pointerdown', function (e) { if (e.target.closest('.ivnav')) return; stg.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; });
    stg.addEventListener('pointerup', function (e) { delete ptrs[e.pointerId]; pinch = 0; });
    stg.addEventListener('pointercancel', function (e) { delete ptrs[e.pointerId]; pinch = 0; });
    stg.addEventListener('pointermove', function (e) {
      var p = ptrs[e.pointerId]; if (!p) return;
      var ids = Object.keys(ptrs);
      if (ids.length === 2) {
        var a = ptrs[ids[0]], b = ptrs[ids[1]]; p.x = e.clientX; p.y = e.clientY;
        var dist = Math.hypot(a.x - b.x, a.y - b.y), r = stg.getBoundingClientRect();
        if (pinch) zoomAt(dist / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); pinch = dist; return;
      }
      V.x += e.clientX - p.x; V.y += e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; paint();
    });
    stg.addEventListener('dblclick', function () { fit(); });
    document.addEventListener('keydown', function (e) {
      if ($('imgv').classList.contains('hidden') || $('ivStudyView').style.display === 'none' || /input|select|textarea/i.test(e.target.tagName)) return;
      if (document.getElementById('viewer') && document.getElementById('viewer').style.display === 'block') return;   // the result is open on top
      if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'Escape') back(); else if (e.key === 'i') invert();
    });
    window.addEventListener('resize', function () { if (V.st) fit(); });
  }
  /* ---- list ---- */
  function load() {
    var box = $('ivList'), q = $('ivQ').value.trim(), seq = ++V.seq;
    box.innerHTML = '<div class="ivmsg">Loading…</div>';
    run('imgList', token, q, $('ivDays').value).then(function (r) {
      if (seq !== V.seq) return;
      if (r.expired) { close(); return window.expired && window.expired(); }
      if (!r.ok) { box.innerHTML = '<div class="ivmsg">' + esc(r.msg) + '</div>'; return; }
      V.list = r.items;
      if (!r.items.length) { box.innerHTML = '<div class="ivmsg">' + (q ? 'No X-ray found for “' + esc(q) + '” in the last 30 days.' : 'No X-rays in this period.') + '</div>'; return; }
      box.innerHTML = r.items.map(function (x, k) {
        return '<button class="ivrow" onclick="IMGV.openIdx(' + k + ')"><div class="l"><b>' + esc(x.name) + '</b> · ' + esc([x.age, x.sex].filter(Boolean).join(' ')) +
          '<div class="d">' + (x.priority && x.priority !== 'Routine' ? '<span class="pri-' + esc(x.priority) + '">' + esc(x.priority) + '</span> · ' : '') + esc(x.exam) + ' · ' + x.images + ' image' + (x.images === 1 ? '' : 's') +
          ' · ' + esc(when(x.created)) + (x.hospNo ? ' · ID ' + esc(x.hospNo) : '') + '</div>' +
          (x.initial ? '<div class="d" style="color:#b45309;font-weight:600">PRELIMINARY – initial reading given to ' + esc(x.initial.to || '') + ' ' + esc(when(x.initial.at)) + '. Final report to follow.</div>' : '') +
          '</div><span class="pill ' + (x.final ? 'ok' : 'wait') + '">' + (x.initial && !x.final ? 'Preliminary' : esc(x.status)) + '</span></button>';
      }).join('') + (r.more ? '<div class="ivmsg">Showing the newest 80 – search by name to find older ones.</div>' : '');
    }).catch(function (e) { if (seq === V.seq) box.innerHTML = '<div class="ivmsg">Could not load: ' + esc((e && e.message) || e) + '</div>'; });
  }
  /* ---- one study ---- */
  function prelimImg(on) {   // ⛔ a study with only a preliminary (initial) reading: watermark over the image, printing blocked (v54)
    document.body.classList.toggle('prelim-img', !!on);
    var w = $('ivWm'); if (w) w.parentNode.removeChild(w);
    if (on && $('ivStage')) { w = document.createElement('div'); w.id = 'ivWm'; w.className = 'prelimWm'; w.innerHTML = '<span>PRELIMINARY<br>DO NOT PRINT</span>'; $('ivStage').appendChild(w); }
  }
  function openStudy(st) {
    release(); V.st = st; V.i = 0; V.full = false;
    prelimImg(st.initial && !st.final);
    $('ivListView').style.display = 'none'; $('ivStudyView').style.display = 'flex';
    $('ivTitle').innerHTML = esc(st.name) + '<span>' + esc([st.age, st.sex].filter(Boolean).join(' ')) + ' · ' + esc(st.exam) + ' · ' + esc(when(st.created)) + '</span>';
    $('ivRes').classList.toggle('hidden', !(st.final && st.reportId));
    $('ivStatus').textContent = st.final && st.reportId ? '✓ Result ready' + (st.readBy ? ' – read by ' + st.readBy : '') :
      st.initial ? 'PRELIMINARY – initial reading communicated to ' + (st.initial.to || '') + (st.initial.byName ? ' by ' + st.initial.byName : '') + ' (' + when(st.initial.at) + '). Final report to follow.' :
      st.status === 'Being read' ? 'The radiologist is reading this now – no result yet.' : 'No result yet – the radiologist hasn’t read this.';
    $('ivChips').innerHTML = st.ids.length > 1 ? st.ids.map(function (id, k) { return '<button class="ivchip" data-k="' + k + '" onclick="IMGV.show(' + k + ')">' + (k + 1) + '</button>'; }).join('') : '';
    Array.prototype.forEach.call(document.querySelectorAll('#ivStage .ivnav'), function (b) { b.style.display = st.ids.length > 1 ? '' : 'none'; });
    show(0);
  }
  function show(k) {
    var st = V.st; if (!st) return;
    k = Math.max(0, Math.min(st.ids.length - 1, k)); V.i = k;
    Array.prototype.forEach.call(document.querySelectorAll('#ivChips .ivchip'), function (b) { b.classList.toggle('on', +b.getAttribute('data-k') === k); });
    $('ivFull').classList.remove('on');
    var key = st.ids[k] + (V.full ? '|f' : '');
    get(st, k, V.full).then(function (o) {
      if (V.st !== st || V.i !== k) return;
      var im = $('ivImg'); im.onload = function () { if (V.st === st && V.i === k) { msg(''); fit(); } };
      im.onerror = function () {   // the small copy could not be shown: fall back to the original once
        if (V.st !== st || V.i !== k) return;
        if (o.screen) { delete V.cache[st.ids[k]]; V.full = true; show(k); V.full = false; } else msg('This image could not be shown.');
      };
      im.src = o.url; im.style.visibility = 'visible';
      $('ivFull').classList.toggle('on', !o.screen); $('ivFull').disabled = !o.screen;
      $('ivNote').textContent = (st.ids.length > 1 ? 'Image ' + (k + 1) + ' of ' + st.ids.length + ' · ' : '') + (o.screen ? 'screen size' : 'full resolution');
      if (st.ids[k + 1]) get(st, k + 1, false).catch(function () {});   // the next image loads in the background
    }).catch(function (e) { if (V.st === st && V.i === k) msg('Could not load this image: ' + ((e && e.message) || e)); });
    if (!V.cache[key]) { msg('Loading image ' + (k + 1) + '…'); $('ivImg').style.visibility = 'hidden'; }
  }
  function get(st, k, full) {
    var key = st.ids[k] + (full ? '|f' : '');
    if (V.cache[key]) { touch(key); return V.cache[key].p; }
    var p = run('imgImage', token, st.acc, st.ids[k], !!full).then(function (r) {
      if (r.expired) { close(); window.expired && window.expired(); throw new Error('session ended'); }
      if (!r.ok) throw new Error(r.msg);
      var bin = atob(r.b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      var o = { url: URL.createObjectURL(new Blob([u], { type: r.mime })), screen: !!r.screen };
      if (V.cache[key]) V.cache[key].url = o.url;
      if (!full && !r.screen) V.cache[st.ids[k] + '|f'] = { p: Promise.resolve(o), url: o.url, shared: true };   // the original came back anyway
      return o;
    });
    V.cache[key] = { p: p }; touch(key);
    p.catch(function () { delete V.cache[key]; });
    return p;
  }
  function touch(key) {   // keep only the last few images in memory
    V.order = V.order.filter(function (x) { return x !== key; }); V.order.push(key);
    while (V.order.length > KEEP) {
      var old = V.order.shift(), c = V.cache[old];
      if (c && c.url && !c.shared && $('ivImg').src !== c.url) URL.revokeObjectURL(c.url);
      delete V.cache[old];
    }
  }
  function release() {
    Object.keys(V.cache).forEach(function (k) { var c = V.cache[k]; if (c && c.url && !c.shared) try { URL.revokeObjectURL(c.url); } catch (e) {} });
    V.cache = {}; V.order = []; var im = $('ivImg'); if (im) { im.removeAttribute('src'); im.style.visibility = 'hidden'; }
  }
  function msg(t) { $('ivMsg').textContent = t || ''; $('ivMsg').style.display = t ? 'flex' : 'none'; }
  /* ---- zoom / pan / look ---- */
  function paint() {
    var im = $('ivImg');
    im.style.transform = 'translate(' + V.x + 'px,' + V.y + 'px) scale(' + V.z + ')';
    im.style.filter = (V.inv ? 'invert(1) ' : '') + 'brightness(' + V.br / 100 + ') contrast(' + V.ct / 100 + ')';
  }
  function fit() {
    var im = $('ivImg'), stg = $('ivStage'); if (!im.naturalWidth) return;
    var r = stg.getBoundingClientRect(), z = Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight) * 0.98;
    V.z = z; V.x = -im.naturalWidth * z / 2; V.y = -im.naturalHeight * z / 2; paint();
  }
  function zoomAt(f, ox, oy) {
    var stg = $('ivStage'), r = stg.getBoundingClientRect(), cx = ox - r.width / 2, cy = oy - r.height / 2, nz = Math.max(0.05, Math.min(20, V.z * f));
    f = nz / V.z; V.x = cx - (cx - V.x) * f; V.y = cy - (cy - V.y) * f; V.z = nz; paint();
  }
  /* ---- public ---- */
  function open(acc) {
    build(); $('imgv').classList.remove('hidden'); document.body.style.overflow = 'hidden';
    if (acc) return openAcc(acc);
    back(); if (!V.list.length) load();
  }
  function openAcc(acc) {
    $('ivListView').style.display = 'none'; $('ivStudyView').style.display = 'flex'; $('ivTitle').textContent = 'Loading…'; msg('Loading…'); $('ivChips').innerHTML = ''; $('ivRes').classList.add('hidden');
    run('imgStudy', token, acc).then(function (r) {
      if (r.expired) { close(); return window.expired && window.expired(); }
      if (!r.ok) { msg(r.msg); return; }
      openStudy(r.study);
    }).catch(function (e) { msg('Could not load: ' + ((e && e.message) || e)); });
  }
  function back() { release(); prelimImg(false); V.st = null; $('ivStudyView').style.display = 'none'; $('ivListView').style.display = 'flex'; if (!V.list.length && $('ivList').innerHTML === '') load(); }
  function close() { release(); prelimImg(false); V.st = null; V.list = []; if ($('imgv')) { $('imgv').classList.add('hidden'); $('ivList').innerHTML = ''; } document.body.style.overflow = ''; }
  function step(d) { if (V.st) show(V.i + d); }
  function invert() { V.inv = !V.inv; $('ivInv').classList.toggle('on', V.inv); paint(); }
  function fullRes() { if (!V.st) return; V.full = true; show(V.i); V.full = false; }
  function result() { var st = V.st; if (st && st.reportId && window.openFile) window.openFile({ id: st.reportId, name: st.reportName || (st.name + ' - XRAY ' + st.exam) }); }
  window.IMGV = { open: open, close: close, load: load, back: back, step: step, show: show, fit: fit, invert: invert, fullRes: fullRes, result: result,
    zoom: function (f) { var r = $('ivStage').getBoundingClientRect(); zoomAt(f, r.width / 2, r.height / 2); },
    openIdx: function (k) { if (V.list[k]) openStudy(V.list[k]); } };
})();
