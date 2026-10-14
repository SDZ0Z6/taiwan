(function () {
  'use strict';

  var T = window.TRIP;
  var PL = window.PLACES || { hotels: {}, days: {} };
  if (!T) return;

  // ---------- helpers ----------
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plain(html, n) {
    var t = String(html || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  }
  function mapUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function navLink(q, label) {
    if (!q) return '';
    return '<a class="navlink" href="' + mapUrl(q) + '" target="_blank" rel="noopener">' + (label || '导航') + ' ↗</a>';
  }
  var icon = window.iconSVG || function () { return ''; };
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function scrollToEl(el, block) {
    if (!el) return;
    el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: block || 'start' });
  }

  var CITY = { taipei: '台北', tainan: '台南' };
  var CITY_C = { taipei: 'var(--taipei)', tainan: 'var(--tainan)' };
  var KIND = {
    eat: ['美食', '#E5523F'], sweet: ['甜点', '#D9669A'], cafe: ['咖啡 · 茶', '#B5793F'], spot: ['景点', '#62AD49'],
    walk: ['散步', '#62AD49'], view: ['风景', '#E2A320'], love: ['浪漫', '#E5523F'], night: ['夜市', '#8B63C9'],
    bar: ['小酌', '#7B58C2'], move: ['交通', '#8C9099'], rest: ['休息', '#8C9099'], fly: ['航班', '#4568D8'],
    spa: ['泡汤', '#2E9E97'], shop: ['逛街', '#EE8A36']
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

  // ---------- merge map places into the trip data ----------
  var HOTEL = {};
  T.go.hotels.forEach(function (h, i) {
    var id = 'H' + (i + 1), p = PL.hotels[id] || {};
    h.id = id; h.geo = p.geo; h.short = p.short || h.name;
    HOTEL[id] = h;
  });
  T.days.forEach(function (d) {
    var p = PL.days[d.id] || {}, items = p.items || {}, seen = {};
    d.place = p;
    d.items.forEach(function (it) {
      var m = items[it.title];
      if (m) { it.geo = m.geo; it.via = m.via; seen[it.title] = 1; }
    });
    Object.keys(items).forEach(function (k) {
      if (!seen[k] && window.console) console.warn('places.js: ' + d.id + ' has no item titled', k);
    });
  });

  function hotelStop(id, via) {
    var h = HOTEL[id];
    if (!h || !h.geo) return null;
    return { at: h.geo, hotel: id, title: h.short, via: via || null, mapq: h.addr, blurb: h.name + ' · ' + h.dates };
  }
  function buildStops(d) {
    var stops = [], n = 0, p = d.place;
    if (p.from) { var a = hotelStop(p.from); if (a) stops.push(a); }
    d.items.forEach(function (it, i) {
      it._n = null; it._stop = null;
      if (!it.geo) return;
      var st;
      if (typeof it.geo === 'string') {
        st = hotelStop(it.geo, it.via);
        if (!st) return;
        st.title = it.title; st.time = it.time; st.item = i;
      } else {
        st = { at: it.geo, via: it.via || null, title: it.title, time: it.time, optional: !!it.optional,
          mapq: it.map, blurb: plain(it.desc || it.eat || '', 64), item: i, n: ++n };
        it._n = st.n;
      }
      it._stop = stops.length;
      stops.push(st);
    });
    if (p.to) { var b = hotelStop(p.to, p.toVia); if (b) stops.push(b); }
    return stops;
  }

  // ---------- dates (always Taiwan time) ----------
  function todayTW() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
      return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
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
  function md(iso) { var p = iso.split('-'); return (+p[1]) + '/' + (+p[2]); }
  var TODAY = todayTW();
  var FIRST = T.days[0].date, LAST = T.days[T.days.length - 1].date;

  function renderStatus() {
    var el = $('#status'), until = dayDiff(TODAY, FIRST);
    if (until > 1) el.textContent = '还有 ' + until + ' 天出发';
    else if (until === 1) el.textContent = '明天就出发了，护照带了吗？';
    else if (until === 0) el.textContent = '今天出发，一路平安';
    else if (dayDiff(TODAY, LAST) >= 0) el.textContent = '旅行第 ' + (1 - until) + ' 天';
    else el.textContent = '旅行结束了，回忆收好了';
  }

  // ---------- hero doodles ----------
  var HERO = [
    ['skylantern', 'a'], ['bubbletea', 'b'], ['lantern', 'c'], ['train', 'd'], ['heart', 'e'], ['sparkle', 'f'],
    ['sparkle', 'g'], ['squiggle', 'h'], ['tower101', 'i'], ['dotB', 'j'], ['dotG', 'k'], ['dashes', 'l'], ['temple', 'm']
  ];
  $('#hero-doodles').innerHTML = HERO.map(function (h) { return '<span class="hd hd-' + h[1] + '">' + icon(h[0], 64) + '</span>'; }).join('');
  $('#foot-doodle').innerHTML = icon('heart', 34);

  // ---------- tabs ----------
  var TABS = ['plan', 'food', 'spots', 'go', 'pack'];
  function showTab(name, push) {
    if (TABS.indexOf(name) < 0) name = 'plan';
    TABS.forEach(function (t) {
      $('#' + t).hidden = t !== name;
      $('#tab-' + t).setAttribute('aria-selected', String(t === name));
    });
    if (push) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* file:// */ } }
  }
  $$('.tab').forEach(function (b) {
    b.addEventListener('click', function () {
      showTab(b.dataset.tab, true);
      var top = $('main').getBoundingClientRect().top + window.scrollY - (window.innerWidth >= 900 ? 60 : 0);
      if (window.scrollY > top) window.scrollTo({ top: top });
    });
  });
  $('#cta').addEventListener('click', function (e) {
    e.preventDefault();
    showTab('plan', true);
    scrollToEl($('#route'));
  });

  // ---------- map ----------
  var tripMap = new window.TripMap($('#map'), {
    onBubble: function (id) { selectDay(id, true); },
    onDetail: function (itemIdx) {
      if (!currentDay || currentDay === 'all') return;
      var li = $('#tl-' + currentDay + '-' + itemIdx);
      if (!li) return;
      scrollToEl(li, 'center');
      li.classList.remove('is-flash'); void li.offsetWidth; li.classList.add('is-flash');
    }
  });

  // ---------- day picker ----------
  var currentDay = null;
  function dayById(id) { var r = null; T.days.forEach(function (d) { if (d.id === id) r = d; }); return r; }
  function renderDaybar() {
    var html = '<button type="button" role="tab" class="daypill" data-day="all"><span class="dp-dot"></span><b>全程</b><span class="dp-sub">8 天</span></button>';
    html += T.days.map(function (d) {
      var c = d.special ? 'c-special' : d.city === 'tainan' ? 'c-tainan' : 'c-taipei';
      return '<button type="button" role="tab" class="daypill" data-day="' + d.id + '">' +
        '<span class="dp-dot ' + c + '"></span><b>' + md(d.date) + '</b><span class="dp-sub">' + esc(d.short) + '</span>' +
        (d.date === TODAY ? '<em class="dp-today">今天</em>' : '') + '</button>';
    }).join('');
    $('#daybar').innerHTML = html;
    $$('.daypill').forEach(function (b) {
      b.addEventListener('click', function () { selectDay(b.dataset.day, true); });
    });
  }
  function selectDay(id, user) {
    if (id !== 'all' && !dayById(id)) id = 'all';
    currentDay = id;
    $$('.daypill').forEach(function (b) {
      var on = b.dataset.day === id;
      b.setAttribute('aria-selected', String(on));
      if (on) {
        var bar = $('#daybar');
        var left = b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2;
        bar.scrollTo({ left: Math.max(0, left), behavior: REDUCED ? 'auto' : 'smooth' });
      }
    });
    if (id === 'all') {
      tripMap.showJourney();
      renderOverview();
    } else {
      var d = dayById(id);
      d._stops = buildStops(d);
      tripMap.showDay({ stops: d._stops, flyIn: d.place.flyIn, flyOut: d.place.flyOut });
      renderDay(d);
    }
    if (user) { store.day = id; save(); }
  }

  function enter(view) {
    view.classList.remove('is-entering');
    void view.offsetWidth;
    view.classList.add('is-entering');
  }

  function renderOverview() {
    var view = $('#day-view');
    view.innerHTML =
      '<header>' +
        '<span class="step-pill"><i></i>全程 · 7 晚 8 天</span>' +
        '<h2 class="day-title">从吉隆坡出发，沿着台湾西边慢慢走</h2>' +
        '<p class="day-theme">台北 3 晚，搭高铁去台南住 3 晚，再回台北天母住最后 1 晚。点下面任何一天，或地图上的小标签。</p>' +
      '</header>' +
      '<div class="ov-grid">' + T.days.map(function (d, i) {
        return '<button type="button" class="ov-card" data-go="' + d.id + '">' +
          icon(d.place.icon || 'sparkle', 40) +
          '<span class="step-pill' + (d.special ? ' is-special' : '') + '"><i></i>DAY ' + (i + 1) + ' · ' + md(d.date) + ' ' + dowOf(d.date) + '</span>' +
          '<span class="ov-title">' + esc(d.title) + '</span>' +
          '<span class="ov-sub">' + esc(d.cityLabel) + '</span>' +
        '</button>';
      }).join('') + '</div>';
    $$('[data-go]', view).forEach(function (b) {
      b.addEventListener('click', function () { selectDay(b.dataset.go, true); scrollToEl($('#daybar'), 'start'); });
    });
    enter(view);
  }

  function itemHtml(d, it, i) {
    var k = KIND[it.kind] || KIND.spot;
    var badge = it._n ? '<span class="tl-num">' + it._n + '</span>' :
      typeof it.geo === 'string' ? '<span class="tl-num tl-home">' + icon('house', 24) + '</span>' :
      '<span class="tl-dot" style="--c:' + k[1] + '"></span>';
    var tags = (it.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    if (it.warn) tags += '<span class="tag is-warn">' + esc(it.warn) + '</span>';
    var actions = tags +
      (it._stop != null ? '<button type="button" class="btn btn-map" data-focus="' + it._stop + '">在地图上看</button>' : '') +
      navLink(it.map);
    return '<li class="tl' + (it.optional ? ' is-opt' : '') + '" id="tl-' + d.id + '-' + i + '">' +
      '<div class="tl-rail">' + badge + '</div>' +
      '<article class="tl-card">' +
        '<div class="tl-top">' +
          (it.time ? '<span class="tl-time">' + esc(it.time) + '</span>' : '') +
          '<span class="kchip"><i style="--c:' + k[1] + '"></i>' + k[0] + '</span>' +
          (it.optional ? '<span class="kchip is-opt">可选</span>' : '') +
        '</div>' +
        '<h3 class="tl-title">' + esc(it.title) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</h3>' +
        (it.desc ? '<p class="tl-desc">' + it.desc + '</p>' : '') +
        (it.eat ? '<p class="tl-eat"><b>点什么</b>' + it.eat + '</p>' : '') +
        (it.tip ? '<p class="tl-tip"><b>小提醒</b>' + it.tip + '</p>' : '') +
        (actions ? '<div class="tl-actions">' + actions + '</div>' : '') +
      '</article>' +
    '</li>';
  }

  function renderDay(d) {
    var idx = T.days.indexOf(d);
    var pills = (d.pills || []).map(function (x) {
      return '<span class="pill' + (x.special ? ' is-special' : '') + '">' + esc(x.text || x) + '</span>';
    }).join('');
    var moment = d.moment ?
      '<div class="moment' + (d.special ? ' is-special' : '') + '">' + icon(d.special ? 'cake' : 'heart', 44) +
        '<p class="moment-label">' + esc(d.moment.label || '今日浪漫时刻') + '</p><p>' + d.moment.text + '</p></div>' : '';
    var asides = (d.tips || d.planB) ? '<div class="aside-grid">' +
      (d.tips ? '<div class="aside-box"><h3>今天要记得</h3><ul>' + d.tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>' : '') +
      (d.planB ? '<div class="aside-box"><h3>' + esc(d.planBTitle || '下雨或累了的话') + '</h3><p>' + d.planB + '</p></div>' : '') +
      '</div>' : '';
    var prev = T.days[idx - 1], next = T.days[idx + 1];
    var nav = '<div class="day-nav">' +
      (prev ? '<button type="button" class="btn" data-go="' + prev.id + '">← ' + md(prev.date) + ' ' + esc(prev.short) + '</button>' : '<button type="button" class="btn" data-go="all">← 全程</button>') +
      (next ? '<button type="button" class="btn" data-go="' + next.id + '">' + md(next.date) + ' ' + esc(next.short) + ' →</button>' : '<span></span>') +
      '</div>';

    var view = $('#day-view');
    view.innerHTML =
      '<header>' +
        '<span class="step-pill' + (d.special ? ' is-special' : '') + '"><i></i>DAY ' + (idx + 1) + ' · ' + md(d.date) + ' ' + dowOf(d.date) + ' · ' + esc(d.cityLabel) + '</span>' +
        '<h2 class="day-title">' + esc(d.title) + '</h2>' +
        (d.theme ? '<p class="day-theme">' + d.theme + '</p>' : '') +
        (pills ? '<div class="pills">' + pills + '</div>' : '') +
      '</header>' +
      moment +
      '<ol class="timeline">' + d.items.map(function (it, i) { return itemHtml(d, it, i); }).join('') + '</ol>' +
      asides + nav;

    $$('[data-focus]', view).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.dataset.focus, mapEl = $('#map'), r = mapEl.getBoundingClientRect();
        var hidden = r.bottom < 80 || r.top > window.innerHeight - 80;
        if (hidden) { scrollToEl(mapEl, 'center'); setTimeout(function () { tripMap.focus(i); }, REDUCED ? 0 : 450); }
        else tripMap.focus(i);
      });
    });
    $$('[data-go]', view).forEach(function (b) {
      b.addEventListener('click', function () { selectDay(b.dataset.go, true); scrollToEl($('#daybar'), 'start'); });
    });
    enter(view);
  }

  // ---------- food & spots ----------
  var FOOD_CATS = [
    { id: 'all', label: '全部' },
    { id: 'snack', label: '小吃', c: '#E5523F' },
    { id: 'market', label: '夜市', c: '#8B63C9' },
    { id: 'sweet', label: '甜点咖啡', c: '#D9669A' },
    { id: 'bar', label: '酒吧', c: '#7B58C2' },
    { id: 'dine', label: '浪漫餐厅', c: '#E2A320' }
  ];
  var FOOD_ICON = { snack: 'bowl', market: 'lantern', sweet: 'bubbletea', bar: 'cocktail', dine: 'heartFill' };
  var CITIES = [{ id: 'all', label: '全部' }, { id: 'taipei', label: '台北', c: 'var(--taipei)' }, { id: 'tainan', label: '台南', c: 'var(--tainan)' }];
  var filt = { foodCity: 'all', foodCat: 'all', spotCity: 'all' };

  function chips(el, list, key, onChange) {
    el.innerHTML = list.map(function (c) {
      return '<button type="button" class="chip" data-v="' + c.id + '" aria-pressed="' + (filt[key] === c.id) + '">' +
        (c.c ? '<i style="--c:' + c.c + '"></i>' : '') + c.label + '</button>';
    }).join('');
    $$('.chip', el).forEach(function (b) {
      b.addEventListener('click', function () {
        filt[key] = b.dataset.v;
        $$('.chip', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        onChange();
      });
    });
  }

  function cardHtml(x, prefix, doneLabel, sealText) {
    var k = prefix + ':' + x.id, done = isDone(k), facts = [];
    if (x.hours) facts.push('<span>营业　' + esc(x.hours) + '</span>');
    if (x.price) facts.push('<span>人均　' + esc(x.price) + '</span>');
    if (x.fee) facts.push('<span>门票　' + esc(x.fee) + '</span>');
    var d = x.day ? dayById(x.day) : null;
    return '<article class="card' + (done ? ' is-done' : '') + '" id="card-' + prefix + '-' + x.id + '">' +
      '<div class="card-top"><h3>' + esc(x.name) + '</h3><span class="card-city"><i style="--c:' + CITY_C[x.city] + '"></i>' + CITY[x.city] + (x.catLabel ? ' · ' + x.catLabel : '') + '</span></div>' +
      (x.area ? '<p class="card-area">' + esc(x.area) + '</p>' : '') +
      (x.order ? '<p class="card-order"><b>必点</b>' + x.order + '</p>' : '') +
      (x.desc ? '<p class="card-order">' + x.desc + '</p>' : '') +
      (facts.length ? '<div class="card-facts">' + facts.join('') + '</div>' : '') +
      (x.note ? '<p class="card-note">' + x.note + '</p>' : '') +
      (x.warn ? '<p class="card-note is-warn">提醒：' + x.warn + '</p>' : '') +
      (done ? '<span class="done-seal" aria-hidden="true">' + sealText + '</span>' : '') +
      '<div class="card-actions">' +
        '<button type="button" class="btn check" aria-pressed="' + done + '" data-check="' + k + '">' + (done ? '✓ ' + doneLabel : doneLabel + '？') + '</button>' +
        navLink(x.map) +
        (d ? '<button type="button" class="btn btn-map" data-jump="' + d.id + '">排在 ' + md(d.date) + '</button>' : '') +
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
        scrollToEl($('#daybar'), 'start');
      });
    });
  }

  function renderMarquee() {
    function row(el, list) {
      var set = function (hide) {
        return '<div class="mq-set"' + (hide ? ' aria-hidden="true"' : '') + '>' + list.map(function (f) {
          return '<button type="button" class="mq-card" data-food="' + f.id + '"' + (hide ? ' tabindex="-1"' : '') + '>' +
            icon(FOOD_ICON[f.cat] || 'bowl', 44) +
            '<span class="mq-text"><b>' + esc(f.name) + '</b><small>' + esc(plain(f.order || f.area, 30)) + '</small></span></button>';
        }).join('') + '</div>';
      };
      el.innerHTML = '<div class="mq-track">' + set(false) + set(true) + '</div>';
    }
    var picks = T.food.filter(function (f) { return f.day; });
    row($('#marquee-a'), picks.filter(function (f) { return f.city === 'taipei'; }));
    row($('#marquee-b'), picks.filter(function (f) { return f.city === 'tainan'; }));
    $$('.mq-card').forEach(function (b) {
      b.addEventListener('click', function () {
        filt.foodCity = 'all'; filt.foodCat = 'all';
        chips($('#food-city'), CITIES, 'foodCity', renderFood);
        chips($('#food-cat'), FOOD_CATS, 'foodCat', renderFood);
        renderFood();
        var card = $('#card-food-' + b.dataset.food);
        if (!card) return;
        scrollToEl(card, 'center');
        card.classList.remove('is-flash'); void card.offsetWidth; card.classList.add('is-flash');
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
      var x = {};
      for (var k in f) x[k] = f[k];
      x.catLabel = catLabel[f.cat];
      return cardHtml(x, 'food', '吃过了', '吃过');
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

  // ---------- go ----------
  function renderGo() {
    var g = T.go;
    var flights = g.flights.map(function (f) {
      return '<div class="ticket">' +
        '<div><p class="ticket-label">' + esc(f.label) + '</p><p class="ticket-code">' + esc(f.code) + '</p></div>' +
        '<span class="pill">' + esc(f.date) + '</span>' +
        '<p class="ticket-route">' + esc(f.route) + '</p>' +
        (f.note ? '<p class="card-note">' + f.note + '</p>' : '') +
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
          var k = 'pack:' + gi + ':' + ii, id = 'pk-' + gi + '-' + ii;
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
    var reset = $('#pack-reset'), armed = false, timer = null;
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
    $('#offal-card').addEventListener('click', function (e) { openSheet(T.offal.kicker, T.offal.title, T.offal.body, e.currentTarget); });
    $$('[data-phrase]', $('#pack-content')).forEach(function (b) {
      b.addEventListener('click', function () { var p = T.phrases[+b.dataset.phrase]; openSheet(p.note, p.zh, '', b); });
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
  function closeSheet() { $('#sheet').hidden = true; if (lastFocus) lastFocus.focus(); }
  $('#sheet-close').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

  // ---------- boot ----------
  renderStatus();
  renderDaybar();
  chips($('#food-city'), CITIES, 'foodCity', renderFood);
  chips($('#food-cat'), FOOD_CATS, 'foodCat', renderFood);
  chips($('#spot-city'), CITIES, 'spotCity', renderSpots);
  renderMarquee();
  renderFood();
  renderSpots();
  renderGo();
  renderPack();

  var start = 'all';
  T.days.forEach(function (d) { if (d.date === TODAY) start = d.id; });
  if (start === 'all' && store.day && (store.day === 'all' || dayById(store.day))) start = store.day;
  selectDay(start, false);
  showTab((location.hash || '').replace('#', '') || 'plan', false);
  window.addEventListener('hashchange', function () { showTab((location.hash || '').replace('#', '') || 'plan', false); });
})();
