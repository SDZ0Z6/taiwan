(function () {
  'use strict';

  var T = window.TRIP;
  if (!T) return;

  // ---------- helpers ----------
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mapUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function navLink(q, label) {
    if (!q) return '';
    return '<a class="navlink" href="' + mapUrl(q) + '" target="_blank" rel="noopener">' + (label || '导航') + ' ↗</a>';
  }

  var CITY = { taipei: '台北', tainan: '台南' };
  var STAMP = {
    eat: '吃', sweet: '甜', cafe: '茶', spot: '游', walk: '逛', move: '行', bar: '酒',
    rest: '歇', fly: '飞', spa: '泡', shop: '买', view: '景', love: '爱', night: '夜'
  };
  var DOW = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  // ---------- storage (per device; page works without it) ----------
  var KEY = 'tw-winter-2026';
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* storage blocked */ } }
  function isDone(k) { return !!(store.done && store.done[k]); }
  function setDone(k, v) {
    store.done = store.done || {};
    if (v) store.done[k] = 1; else delete store.done[k];
    save();
  }

  // ---------- dates (always Taiwan time) ----------
  function todayTW() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
      var d = new Date(Date.now() + 8 * 3600 * 1000);
      return d.toISOString().slice(0, 10);
    }
  }
  function dayDiff(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((Date.UTC(+pb[0], pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], pa[1] - 1, +pa[2])) / 86400000);
  }
  function dowOf(iso) {
    var p = iso.split('-');
    return DOW[new Date(Date.UTC(+p[0], p[1] - 1, +p[2])).getUTCDay()];
  }
  var TODAY = todayTW();
  var FIRST = T.days[0].date;
  var LAST = T.days[T.days.length - 1].date;

  function renderStatus() {
    var el = $('#status');
    var until = dayDiff(TODAY, FIRST);
    if (until > 1) el.textContent = '距离出发还有 ' + until + ' 天';
    else if (until === 1) el.textContent = '明天就出发了，护照带了吗？';
    else if (until === 0) el.textContent = '今天出发，一路平安';
    else if (dayDiff(TODAY, LAST) >= 0) el.textContent = '旅行第 ' + (1 - until) + ' 天 · 今天的行程已经帮你们打开';
    else el.textContent = '旅行结束了，回忆收好了';
  }

  // ---------- tabs ----------
  var TABS = ['plan', 'food', 'spots', 'go', 'pack'];
  function showTab(name, push) {
    if (TABS.indexOf(name) < 0) name = 'plan';
    TABS.forEach(function (t) {
      $('#' + t).hidden = t !== name;
      $('#tab-' + t).setAttribute('aria-selected', String(t === name));
    });
    if (push) {
      try { history.replaceState(null, '', '#' + name); } catch (e) { /* file:// in some browsers */ }
    }
  }
  $$('.tab').forEach(function (b) {
    b.addEventListener('click', function () {
      showTab(b.dataset.tab, true);
      var top = $('.tabs').getBoundingClientRect().top;
      if (window.innerWidth >= 900 && top <= 1) window.scrollTo({ top: $('main').offsetTop - 50 });
      else if (window.innerWidth < 900) window.scrollTo({ top: $('main').offsetTop - 8 });
    });
  });

  // ---------- itinerary ----------
  var currentDay = null;

  function renderPicker() {
    var html = T.days.map(function (d, i) {
      var p = d.date.split('-');
      var cityCls = d.city === 'tainan' ? 'c-tainan' : d.city === 'taipei' ? 'c-taipei' : '';
      var today = d.date === TODAY ? '<span class="stub-today">今天</span>' : '';
      return '<button type="button" role="tab" class="stub ' + cityCls + '" data-day="' + d.id + '" id="stub-' + d.id + '" aria-controls="day-view">' +
        today +
        '<span class="stub-dow">' + dowOf(d.date) + '</span>' +
        '<span class="stub-num">' + p[2] + '</span>' +
        '<span class="stub-city">' + esc(d.stubLabel || d.cityLabel) + '</span>' +
        '</button>';
    }).join('');
    $('#day-picker').innerHTML = html;
    $$('.stub').forEach(function (b) {
      b.addEventListener('click', function () { selectDay(b.dataset.day, true); });
    });
  }

  function itemHtml(it) {
    var kind = it.kind || 'spot';
    var cls = 'stop k-' + kind + (it.optional ? ' is-optional' : '');
    var tags = (it.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    if (it.optional) tags = '<span class="tag is-opt">可选</span>' + tags;
    if (it.warn) tags += '<span class="tag is-warn">' + esc(it.warn) + '</span>';
    return '<li class="' + cls + '">' +
      '<span class="stamp" aria-hidden="true">' + esc(it.stamp || STAMP[kind] || '游') + '</span>' +
      '<div class="stop-body">' +
        (it.time ? '<span class="stop-time">' + esc(it.time) + '</span>' : '') +
        '<h3 class="stop-title">' + esc(it.title) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</h3>' +
        (it.desc ? '<p class="stop-desc">' + it.desc + '</p>' : '') +
        (it.eat ? '<p class="stop-eat"><b>点什么</b>　' + it.eat + '</p>' : '') +
        (it.tip ? '<p class="stop-tip"><b>小提醒</b>　' + it.tip + '</p>' : '') +
        ((tags || it.map) ? '<div class="stop-actions">' + tags + navLink(it.map) + '</div>' : '') +
      '</div>' +
    '</li>';
  }

  function renderDay(id) {
    var idx = 0;
    T.days.forEach(function (d, i) { if (d.id === id) idx = i; });
    var d = T.days[idx];
    var kickerCity = d.city === 'tainan' ? 'k-tainan' : d.city === 'taipei' ? 'k-taipei' : '';
    var p = d.date.split('-');
    var pills = (d.pills || []).map(function (x) {
      return '<span class="pill' + (x.special ? ' is-special' : '') + '">' + esc(x.text || x) + '</span>';
    }).join('');
    var moment = d.moment ?
      '<div class="moment' + (d.special ? ' is-special' : '') + '">' +
        '<span class="seal" aria-hidden="true">' + esc(d.moment.seal || '缘') + '</span>' +
        '<div><p class="moment-label">' + esc(d.moment.label || '今日浪漫时刻') + '</p><p>' + d.moment.text + '</p></div>' +
      '</div>' : '';
    var asides = '';
    if (d.planB || d.tips) {
      asides = '<div class="aside-grid">' +
        (d.tips ? '<div class="aside-box"><h3>今天要记得</h3><ul>' + d.tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>' : '') +
        (d.planB ? '<div class="aside-box"><h3>' + esc(d.planBTitle || '下雨或累了的话') + '</h3><p>' + d.planB + '</p></div>' : '') +
      '</div>';
    }
    var prev = T.days[idx - 1], next = T.days[idx + 1];
    var nav = '<div class="day-nav">' +
      (prev ? '<button type="button" class="btn" data-go="' + prev.id + '">← ' + prev.date.slice(5).replace('-', '/') + ' ' + esc(prev.short || '') + '</button>' : '<span></span>') +
      (next ? '<button type="button" class="btn" data-go="' + next.id + '">' + next.date.slice(5).replace('-', '/') + ' ' + esc(next.short || '') + ' →</button>' : '<span></span>') +
      '</div>';

    var view = $('#day-view');
    view.innerHTML =
      '<header class="day-head">' +
        '<p class="day-kicker">第 ' + (idx + 1) + ' 天 · ' + (+p[1]) + '月' + (+p[2]) + '日 ' + dowOf(d.date) + ' · <b class="' + kickerCity + '">' + esc(d.cityLabel) + '</b></p>' +
        '<h2>' + esc(d.title) + '</h2>' +
        (d.theme ? '<p class="day-theme">' + d.theme + '</p>' : '') +
        (pills ? '<div class="pills">' + pills + '</div>' : '') +
      '</header>' +
      moment +
      '<ol class="thread">' + d.items.map(itemHtml).join('') + '</ol>' +
      asides + nav;

    $$('[data-go]', view).forEach(function (b) {
      b.addEventListener('click', function () {
        selectDay(b.dataset.go, true);
        var top = $('#plan').getBoundingClientRect().top + window.scrollY - (window.innerWidth >= 900 ? 60 : 8);
        window.scrollTo({ top: top });
      });
    });
    view.classList.remove('is-entering');
    void view.offsetWidth;
    view.classList.add('is-entering');
  }

  function selectDay(id, remember) {
    currentDay = id;
    $$('.stub').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.day === id)); });
    renderDay(id);
    if (remember) { store.day = id; save(); }
  }

  // ---------- checklists (food & spots) ----------
  var FOOD_CATS = [
    { id: 'all', label: '全部' },
    { id: 'snack', label: '小吃' },
    { id: 'market', label: '夜市' },
    { id: 'sweet', label: '甜点咖啡' },
    { id: 'bar', label: '酒吧' },
    { id: 'dine', label: '浪漫餐厅' }
  ];
  var CITIES = [{ id: 'all', label: '全部' }, { id: 'taipei', label: '台北' }, { id: 'tainan', label: '台南' }];
  var filt = { foodCity: 'all', foodCat: 'all', spotCity: 'all' };

  function chips(el, list, key, onChange) {
    el.innerHTML = list.map(function (c) {
      return '<button type="button" class="chip" data-v="' + c.id + '" aria-pressed="' + (filt[key] === c.id) + '">' + c.label + '</button>';
    }).join('');
    $$('.chip', el).forEach(function (b) {
      b.addEventListener('click', function () {
        filt[key] = b.dataset.v;
        $$('.chip', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        onChange();
      });
    });
  }

  function dayRef(id) {
    var d = null;
    T.days.forEach(function (x) { if (x.id === id) d = x; });
    if (!d) return '';
    return '<button type="button" class="btn" data-jump="' + d.id + '">排在 ' + d.date.slice(5).replace('-', '/') + '</button>';
  }

  function cardHtml(x, prefix, doneLabel, sealText) {
    var k = prefix + ':' + x.id;
    var done = isDone(k);
    var facts = [];
    if (x.hours) facts.push('<span>营业 ' + esc(x.hours) + '</span>');
    if (x.price) facts.push('<span>人均 ' + esc(x.price) + '</span>');
    if (x.fee) facts.push('<span>门票 ' + esc(x.fee) + '</span>');
    return '<article class="card' + (done ? ' is-done' : '') + '" data-key="' + k + '">' +
      '<div class="card-top"><h3>' + esc(x.name) + '</h3><span class="card-city c-' + x.city + '">' + CITY[x.city] + (x.catLabel ? ' · ' + x.catLabel : '') + '</span></div>' +
      (x.area ? '<p class="card-area">' + esc(x.area) + '</p>' : '') +
      (x.order ? '<p class="card-order"><b>必点</b>　' + x.order + '</p>' : '') +
      (x.desc ? '<p class="card-order">' + x.desc + '</p>' : '') +
      (facts.length ? '<div class="card-facts">' + facts.join('') + '</div>' : '') +
      (x.note ? '<p class="card-note">' + x.note + '</p>' : '') +
      (x.warn ? '<p class="card-note is-warn">提醒：' + x.warn + '</p>' : '') +
      (done ? '<span class="done-seal" aria-hidden="true">' + sealText + '</span>' : '') +
      '<div class="card-actions">' +
        '<button type="button" class="btn check" aria-pressed="' + done + '" data-check="' + k + '">' + (done ? '✓ ' + doneLabel : doneLabel + '？') + '</button>' +
        navLink(x.map) + (x.day ? dayRef(x.day) : '') +
      '</div>' +
    '</article>';
  }

  function wireCards(listEl, rerender) {
    $$('[data-check]', listEl).forEach(function (b) {
      b.addEventListener('click', function () {
        setDone(b.dataset.check, !isDone(b.dataset.check));
        rerender();
        var again = $('[data-check="' + b.dataset.check + '"]', listEl);
        if (again) again.focus();
      });
    });
    $$('[data-jump]', listEl).forEach(function (b) {
      b.addEventListener('click', function () {
        showTab('plan', true);
        selectDay(b.dataset.jump, true);
        window.scrollTo({ top: $('#plan').getBoundingClientRect().top + window.scrollY - 60 });
      });
    });
  }

  function renderFood() {
    var catLabel = {};
    FOOD_CATS.forEach(function (c) { catLabel[c.id] = c.label; });
    var list = T.food.filter(function (f) {
      return (filt.foodCity === 'all' || f.city === filt.foodCity) && (filt.foodCat === 'all' || f.cat === filt.foodCat);
    });
    var el = $('#food-list');
    el.innerHTML = list.length ? list.map(function (f) {
      return cardHtml(Object.assign({ catLabel: catLabel[f.cat] }, f), 'food', '吃过了', '吃过');
    }).join('') : '<p class="empty">这个组合下没有推荐，换个筛选看看。</p>';
    var done = T.food.filter(function (f) { return isDone('food:' + f.id); }).length;
    $('#food-progress').textContent = '已经吃过 ' + done + ' / ' + T.food.length;
    wireCards(el, renderFood);
  }

  function renderSpots() {
    var list = T.spots.filter(function (s) { return filt.spotCity === 'all' || s.city === filt.spotCity; });
    var el = $('#spot-list');
    el.innerHTML = list.map(function (s) { return cardHtml(s, 'spot', '去过了', '到此'); }).join('');
    var done = T.spots.filter(function (s) { return isDone('spot:' + s.id); }).length;
    $('#spot-progress').textContent = '已经去过 ' + done + ' / ' + T.spots.length;
    wireCards(el, renderSpots);
  }

  // ---------- go (flights, hotels, transport, info) ----------
  function renderGo() {
    var g = T.go;
    var flights = g.flights.map(function (f) {
      return '<div class="ticket">' +
        '<div><p class="ticket-label">' + esc(f.label) + '</p><p class="ticket-code">' + esc(f.code) + '</p></div>' +
        '<span class="pill">' + esc(f.date) + '</span>' +
        '<p class="ticket-route">' + esc(f.route) + '</p>' +
        (f.note ? '<p class="card-note" style="grid-column:1/-1">' + f.note + '</p>' : '') +
      '</div>';
    }).join('');
    var hotels = g.hotels.map(function (h, i) {
      return '<div class="hotel">' +
        '<p class="hotel-dates">' + esc(h.dates) + '</p>' +
        '<h4>' + esc(h.name) + '</h4>' +
        '<p class="hotel-addr">' + esc(h.addr) + '</p>' +
        (h.note ? '<p class="card-note">' + h.note + '</p>' : '') +
        '<div class="card-actions">' +
          '<button type="button" class="btn is-primary" data-driver="' + i + '">给司机看地址</button>' +
          navLink(h.map || h.addr) +
        '</div>' +
      '</div>';
    }).join('');
    var howtos = g.howtos.map(function (h) {
      return '<div class="howto">' +
        '<h4>' + esc(h.title) + '</h4>' +
        (h.meta ? '<p class="howto-meta">' + esc(h.meta) + '</p>' : '') +
        '<ol class="steps">' + h.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
        (h.tip ? '<p class="card-note">' + h.tip + '</p>' : '') +
      '</div>';
    }).join('');
    var info = g.info.map(function (x) {
      return '<div class="info"><h4>' + esc(x.title) + '</h4>' +
        (x.items ? '<ul>' + x.items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' : '<p>' + x.text + '</p>') +
      '</div>';
    }).join('');

    $('#go-content').innerHTML =
      '<section class="block"><h3>航班</h3><div class="aside-grid">' + flights + '</div></section>' +
      '<section class="block"><h3>酒店</h3><p class="block-sub">按「给司机看地址」会放大显示繁体地址，Uber 或计程车司机一看就懂。</p><div class="aside-grid">' + hotels + '</div></section>' +
      '<section class="block"><h3>怎么去</h3><div class="aside-grid">' + howtos + '</div></section>' +
      '<section class="block"><h3>实用信息</h3><div class="info-grid">' + info + '</div></section>';

    $$('[data-driver]', $('#go-content')).forEach(function (b) {
      b.addEventListener('click', function () {
        var h = g.hotels[+b.dataset.driver];
        openSheet('司机您好，麻烦送我们到：', h.name, h.addr, b);
      });
    });
  }

  // ---------- pack ----------
  function renderPack() {
    var groups = T.packing.map(function (g, gi) {
      return '<div class="check-group"><h4>' + esc(g.group) + '</h4>' +
        g.items.map(function (it, ii) {
          var k = 'pack:' + gi + ':' + ii;
          var id = 'pk-' + gi + '-' + ii;
          return '<label class="check-row" for="' + id + '"><input type="checkbox" id="' + id + '" data-k="' + k + '"' + (isDone(k) ? ' checked' : '') + '>' +
            '<span>' + esc(it.t) + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</span></label>';
        }).join('') +
      '</div>';
    }).join('');

    var phrases = T.phrases.map(function (p, i) {
      return '<div class="phrase"><span class="phrase-zh">' + esc(p.zh) + '</span>' +
        '<span class="phrase-note">' + esc(p.note) + '</span>' +
        '<button type="button" class="btn" data-phrase="' + i + '">放大</button></div>';
    }).join('');

    $('#pack-content').innerHTML =
      '<section class="block"><div class="checklist">' + groups + '</div>' +
        '<div><button type="button" class="btn" id="pack-reset">清空勾选</button></div></section>' +
      '<section class="block"><h3>点餐用得上的话</h3>' +
        '<p class="block-sub">台湾用繁体字，下面都写成店家熟悉的说法。按「放大」可以直接把手机给老板看。</p>' +
        '<div><button type="button" class="btn is-primary" id="offal-card">给老板看：我们不吃内脏</button></div>' +
        '<div class="phrases">' + phrases + '</div></section>';

    function count() {
      var total = 0, done = 0;
      T.packing.forEach(function (g, gi) { g.items.forEach(function (_, ii) { total++; if (isDone('pack:' + gi + ':' + ii)) done++; }); });
      $('#pack-progress').textContent = '已经装好 ' + done + ' / ' + total;
    }
    $$('input[data-k]', $('#pack-content')).forEach(function (c) {
      c.addEventListener('change', function () { setDone(c.dataset.k, c.checked); count(); });
    });
    var reset = $('#pack-reset');
    var armed = false, timer = null;
    reset.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        reset.textContent = '再按一次确认清空';
        timer = setTimeout(function () { armed = false; reset.textContent = '清空勾选'; }, 3000);
        return;
      }
      clearTimeout(timer);
      armed = false;
      Object.keys(store.done || {}).forEach(function (k) { if (k.indexOf('pack:') === 0) delete store.done[k]; });
      save();
      renderPack();
    });
    $('#offal-card').addEventListener('click', function (e) {
      openSheet(T.offal.kicker, T.offal.title, T.offal.body, e.currentTarget);
    });
    $$('[data-phrase]', $('#pack-content')).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = T.phrases[+b.dataset.phrase];
        openSheet(p.note, p.zh, '', b);
      });
    });
    count();
  }

  // ---------- sheet ----------
  var lastFocus = null;
  function openSheet(kicker, title, body, from) {
    lastFocus = from || null;
    $('#sheet-kicker').textContent = kicker || '';
    $('#sheet-title').textContent = title || '';
    $('#sheet-body').textContent = body || '';
    $('#sheet-body').hidden = !body;
    $('#sheet').hidden = false;
    $('#sheet-close').focus();
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    if (lastFocus) lastFocus.focus();
  }
  $('#sheet-close').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

  // ---------- boot ----------
  renderStatus();
  renderPicker();
  chips($('#food-city'), CITIES, 'foodCity', renderFood);
  chips($('#food-cat'), FOOD_CATS, 'foodCat', renderFood);
  chips($('#spot-city'), CITIES, 'spotCity', renderSpots);
  renderFood();
  renderSpots();
  renderGo();
  renderPack();

  var startDay = T.days[0].id;
  T.days.forEach(function (d) { if (d.date === TODAY) startDay = d.id; });
  if (startDay === T.days[0].id && store.day && dayDiff(TODAY, FIRST) > 0) {
    T.days.forEach(function (d) { if (d.id === store.day) startDay = d.id; });
  }
  selectDay(startDay, false);
  showTab((location.hash || '').replace('#', '') || 'plan', false);
  window.addEventListener('hashchange', function () {
    showTab((location.hash || '').replace('#', '') || 'plan', false);
  });
})();
