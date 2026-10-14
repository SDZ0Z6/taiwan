/* Illustrated trip map: SVG drawn in screen space every time the camera moves,
   so strokes, pins and doodles keep their size at any zoom. No libraries. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var K = Math.cos(24 * Math.PI / 180);
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var S_MIN = 0.03, S_MAX = 40;
  var PAD = { t: 60, r: 56, b: 70, l: 24 };

  // ---------- small helpers ----------
  function W(ll) { return [(ll[1] - 120) * K * 1000, (25.4 - ll[0]) * 1000]; }
  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mapUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }

  // Catmull-Rom through screen points -> cubic Bezier path
  function smooth(p, closed) {
    var n = p.length;
    if (n < 2) return '';
    var d = 'M' + r1(p[0][0]) + ' ' + r1(p[0][1]);
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = p[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      var p1 = p[i];
      var p2 = p[(i + 1) % n];
      var p3 = p[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
      d += 'C' + r1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + r1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        r1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + r1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' +
        r1(p2[0]) + ' ' + r1(p2[1]);
    }
    return closed ? d + 'Z' : d;
  }
  function poly(p) {
    var d = '';
    for (var i = 0; i < p.length; i++) d += (i ? 'L' : 'M') + r1(p[i][0]) + ' ' + r1(p[i][1]);
    return d;
  }
  // world-space Catmull-Rom sampling (open curve)
  function catmull(pts, per) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (var j = 0; j < per; j++) {
        var t = j / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(function (k) {
          return 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        }));
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function cumulative(p) {
    var c = [0];
    for (var i = 1; i < p.length; i++) c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    return c;
  }
  function pointAt(p, c, d) {
    if (p.length < 2) return [p[0][0], p[0][1], 0];
    d = clamp(d, 0, c[c.length - 1]);
    var i = 1;
    while (i < c.length - 1 && c[i] < d) i++;
    var seg = c[i] - c[i - 1] || 1, u = (d - c[i - 1]) / seg;
    var a = p[i - 1], b = p[i];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[1] - a[1], b[0] - a[0])];
  }
  function partial(p, c, d) {
    if (d <= 0) return [p[0], p[0]];
    if (d >= c[c.length - 1]) return p;
    var out = [p[0]];
    for (var i = 1; i < p.length; i++) {
      if (c[i] < d) { out.push(p[i]); continue; }
      var u = (d - c[i - 1]) / ((c[i] - c[i - 1]) || 1);
      out.push([p[i - 1][0] + (p[i][0] - p[i - 1][0]) * u, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u]);
      break;
    }
    return out;
  }
  function icon(name) { return (window.ICONS && window.ICONS[name]) || ''; }

  // ---------- the map ----------
  function TripMap(host, opts) {
    this.host = host;
    this.opts = opts || {};
    this.w = host.clientWidth || 360;
    this.h = host.clientHeight || 420;
    this.cam = { x: 900, y: 1750, s: 0.1 };
    this.camVer = 1;
    this.drawnVer = 0;
    this.view = null;
    this.visible = true;
    this.build();
    this.bind();
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }
  var P = TripMap.prototype;

  P.build = function () {
    var self = this, g = window.GEO;
    this.host.innerHTML = '';
    var svg = this.svg = mk('svg', { class: 'map-svg', role: 'img', 'aria-label': '台湾手绘行程地图' }, this.host);

    this.gLand = mk('g', { class: 'm-land' }, svg);
    this.landShadow = mk('path', { class: 'land-shadow' }, this.gLand);
    this.landFill = mk('path', { class: 'land-fill' }, this.gLand);
    this.coastB = mk('path', { class: 'coast coast-b' }, this.gLand);
    this.coastA = mk('path', { class: 'coast coast-a' }, this.gLand);
    this.coastW = g.coast.map(W);

    var gWater = mk('g', { class: 'm-water' }, svg);
    this.rivers = g.rivers.map(function (r) {
      var grp = mk('g', { class: 'river' }, gWater);
      return { w: r.pts.map(W), width: r.width, g: grp, edge: mk('path', { class: 'river-edge' }, grp), band: mk('path', { class: 'river-band' }, grp) };
    });

    var gRail = mk('g', { class: 'm-rail' }, svg);
    this.hsrW = g.hsr.map(function (s) { return W(s.at); });
    this.hsrBed = mk('path', { class: 'rail-bed' }, gRail);
    this.hsrTies = mk('path', { class: 'rail-ties' }, gRail);
    this.stations = g.hsr.map(function () { return mk('circle', { class: 'rail-stop', r: 3 }, gRail); });

    var gDeco = mk('g', { class: 'm-deco' }, svg);
    this.doodles = g.doodles.map(function (d) {
      var outer = mk('g', { class: 'deco' }, gDeco);
      var bob = mk('g', { class: d.float ? 'bob' : '' }, outer);
      var inner = mk('g', { class: 'ico' }, bob);
      inner.innerHTML = icon(d.icon);
      return { w: W(d.at), d: d, outer: outer, inner: inner };
    });

    var gLabels = mk('g', { class: 'm-labels' }, svg);
    this.labels = g.labels.map(function (l) {
      var t = mk('text', { class: 'lbl lbl-' + (l.cls || 'town'), 'text-anchor': 'middle' }, gLabels);
      t.textContent = l.t;
      return { w: W(l.at), l: l, el: t };
    });

    this.gRoute = mk('g', { class: 'm-route' }, svg);
    this.gNodes = mk('g', { class: 'm-nodes' }, svg);
    this.gTravel = mk('g', { class: 'traveler', style: 'display:none' }, svg);
    this.tvHeart = mk('g', { class: 'tv tv-heart' }, this.gTravel);
    mk('g', { class: 'ico', transform: 'scale(0.62)' }, this.tvHeart).innerHTML = icon('heartFill');
    this.tvTrain = mk('g', { class: 'tv tv-train' }, this.gTravel);
    mk('g', { class: 'ico', transform: 'scale(0.9)' }, this.tvTrain).innerHTML = icon('train');
    this.tvPlane = mk('g', { class: 'tv tv-plane' }, this.gTravel);
    mk('g', { class: 'ico', transform: 'scale(0.9)' }, this.tvPlane).innerHTML = icon('plane');
    this.gPins = mk('g', { class: 'm-pins' }, svg);
    this.gBubbles = mk('g', { class: 'm-bubbles' }, svg);

    var ui = this.ui = document.createElement('div');
    ui.className = 'map-ui';
    ui.innerHTML =
      '<div class="map-ctrl">' +
        '<button type="button" class="mc" data-z="in" aria-label="放大">+</button>' +
        '<button type="button" class="mc" data-z="out" aria-label="缩小">−</button>' +
        '<button type="button" class="mc mc-fit" data-z="fit" aria-label="看整段路线"><svg viewBox="-12 -12 24 24" width="18" height="18" aria-hidden="true"><path d="M-8-3V-8H-3M3-8H8V-3M8 3V8H3M-3 8H-8V3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '</div>' +
      '<div class="map-legend" aria-hidden="true">' +
        '<span><svg width="22" height="6"><path d="M1 3H21" class="lg lg-walk"/></svg>步行</span>' +
        '<span><svg width="22" height="6"><path d="M1 3H21" class="lg lg-car"/></svg>搭车</span>' +
        '<span><svg width="22" height="6"><path d="M1 3H21" class="lg lg-hsr"/></svg>高铁</span>' +
        '<span><svg width="22" height="6"><path d="M1 3H21" class="lg lg-fly"/></svg>飞机</span>' +
      '</div>' +
      '<div class="map-parts" hidden></div>' +
      '<p class="map-hint" hidden>用两只手指移动或缩放地图</p>' +
      '<div class="map-pop" role="dialog" aria-live="polite" hidden></div>';
    this.host.appendChild(ui);
    this.pop = ui.querySelector('.map-pop');
    this.parts = ui.querySelector('.map-parts');
    this.hint = ui.querySelector('.map-hint');
  };

  // ---------- camera ----------
  P.proj = function (w) {
    var c = this.cam;
    return [(w[0] - c.x) * c.s + this.w / 2, (w[1] - c.y) * c.s + this.h / 2];
  };
  P.setCam = function (c) { this.cam = c; this.camVer++; };
  P.zoomAt = function (f, sx, sy) {
    this.userMoved = true;
    var c = this.cam, ns = clamp(c.s * f, S_MIN, S_MAX);
    var wx = (sx - this.w / 2) / c.s + c.x, wy = (sy - this.h / 2) / c.s + c.y;
    this.setCam({ s: ns, x: wx - (sx - this.w / 2) / ns, y: wy - (sy - this.h / 2) / ns });
  };
  P.pan = function (dx, dy) {
    this.userMoved = true;
    var c = this.cam;
    this.setCam({ s: c.s, x: c.x - dx / c.s, y: c.y - dy / c.s });
  };
  P.fitTo = function (pts, maxS) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    var pad = this.w < 420 ? { t: 58, r: 52, b: 66, l: 20 } : PAD;
    var aw = Math.max(80, this.w - pad.l - pad.r), ah = Math.max(80, this.h - pad.t - pad.b);
    var s = Math.min(aw / Math.max(x1 - x0, 0.5), ah / Math.max(y1 - y0, 0.5));
    s = clamp(s, S_MIN, maxS || 26);
    var X0 = (pad.l + this.w - pad.r) / 2, Y0 = (pad.t + this.h - pad.b) / 2;
    return { s: s, x: (x0 + x1) / 2 - (X0 - this.w / 2) / s, y: (y0 + y1) / 2 - (Y0 - this.h / 2) / s };
  };
  P.flyTo = function (t, ms, done) {
    this.anim = null;
    this.userMoved = false;
    if (REDUCED || !ms) { this.setCam(t); if (done) done(); return; }
    var a = this.cam;
    var dist = Math.hypot(t.x - a.x, t.y - a.y);
    var sFit = Math.min(this.w, this.h) * 0.75 / Math.max(dist, 1e-6);
    var lo = Math.min(a.s, t.s);
    var bump = sFit < lo ? Math.log(lo / sFit) : 0;
    this.anim = { a: a, b: t, t0: performance.now(), ms: Math.min(ms + bump * 160, 1700), bump: bump, done: done };
  };
  P.stepAnim = function (now) {
    var an = this.anim;
    var p = clamp((now - an.t0) / an.ms, 0, 1), e = ease(p);
    var ls = Math.log(an.a.s) + (Math.log(an.b.s) - Math.log(an.a.s)) * e - an.bump * 4 * e * (1 - e);
    this.setCam({ s: Math.exp(ls), x: an.a.x + (an.b.x - an.a.x) * e, y: an.a.y + (an.b.y - an.a.y) * e });
    if (p >= 1) { this.anim = null; if (an.done) an.done(); }
  };

  // ---------- views ----------
  function segPoints(a, b, mode, k, hsrW) {
    if (mode === 'hsr') {
      var near = function (p) {
        var bi = 0, bd = Infinity;
        hsrW.forEach(function (q, i) { var d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; bi = i; } });
        return bi;
      };
      var ia = near(a), ib = near(b);
      var line = ia <= ib ? hsrW.slice(ia, ib + 1) : hsrW.slice(ib, ia + 1).reverse();
      line = [a].concat(line.slice(1, -1), [b]);
      return catmull(line, 8);
    }
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var bend = mode === 'fly' ? 0.22 : mode === 'walk' ? 0.1 : 0.16;
    var side = k % 2 ? -1 : 1;
    var cx = (a[0] + b[0]) / 2 - dy * bend * side, cy = (a[1] + b[1]) / 2 + dx * bend * side;
    var out = [];
    for (var i = 0; i <= 28; i++) {
      var t = i / 28, u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]);
    }
    return out;
  }

  P.clearView = function () {
    this.gRoute.innerHTML = '';
    this.gPins.innerHTML = '';
    this.gNodes.innerHTML = '';
    this.gBubbles.innerHTML = '';
    this.gTravel.style.display = 'none';
    this.parts.hidden = true;
    this.parts.innerHTML = '';
    this.closePop();
  };

  P.makeSegs = function (list, kulStart, kulEnd) {
    var self = this, segs = [], kul = W(window.GEO.kul);
    function add(ai, bi, a, b, mode) {
      var sg = { ai: ai, bi: bi, mode: mode, w: segPoints(a, b, mode, segs.length, self.hsrW) };
      sg.base = mk('path', { class: 'seg seg-' + mode }, self.gRoute);
      sg.flow = mk('path', { class: 'flow flow-' + mode }, self.gRoute);
      segs.push(sg);
    }
    if (kulStart && list.length) add(-1, list[0].i, kul, list[0].w, 'fly');
    for (var i = 1; i < list.length; i++) {
      var a = list[i - 1], b = list[i];
      var mode = b.via || (Math.hypot(b.w[0] - a.w[0], b.w[1] - a.w[1]) < 11 ? 'walk' : 'car');
      add(a.i, b.i, a.w, b.w, mode);
    }
    if (kulEnd && list.length) add(list[list.length - 1].i, -1, list[list.length - 1].w, kul, 'fly');
    return segs;
  };

  P.showJourney = function () {
    var self = this, g = window.GEO;
    this.clearView();
    var nodes = g.journey.map(function (n, i) { return { w: W(n.at), via: n.via, i: -1 }; });
    var segs = this.makeSegs(nodes, false, false);
    nodes.slice(1, -1).forEach(function (n) { n.dot = mk('circle', { class: 'node', r: 3.5 }, self.gNodes); });
    var bubbles = g.bubbles.map(function (b) {
      var grp = mk('g', { class: 'bubble', 'data-day': b.day, tabindex: 0, role: 'button', 'aria-label': b.t }, self.gBubbles);
      var leader = mk('path', { class: 'bubble-lead' }, grp);
      var rect = mk('rect', { class: 'bubble-bg', rx: 14, height: 28 }, grp);
      var dot = mk('circle', { class: 'bubble-dot', r: 3.5 }, grp);
      var text = mk('text', { class: 'bubble-t' }, grp);
      text.textContent = b.t;
      return { w: W(b.at), b: b, g: grp, leader: leader, rect: rect, dot: dot, text: text, tw: 0 };
    });
    this.view = { type: 'all', stops: [], nodes: nodes, segs: segs, bubbles: bubbles };
    this.view.fit = this.fitTo(this.coastW, 1);
    this.view.fitPts = this.coastW;
    this.startView(this.view.fit);
  };

  P.showDay = function (day) {
    var self = this;
    this.clearView();
    var stops = day.stops.map(function (s, i) {
      var o = {};
      for (var k in s) o[k] = s[k];
      o.w = W(s.at); o.i = i;
      return o;
    });
    // one pin per hotel even if the day passes it several times
    stops.forEach(function (s, i) {
      if (!s.hotel) return;
      for (var j = 0; j < i; j++) if (stops[j].hotel === s.hotel && stops[j].pinOf == null) { s.pinOf = j; break; }
    });
    var route = stops.filter(function (s) { return !s.optional; });
    var segs = this.makeSegs(route, day.flyIn, day.flyOut);
    stops.forEach(function (s, i) {
      if (s.pinOf != null) return;
      var g = s.el = mk('g', { class: 'pin' + (s.hotel ? ' pin-hotel' : '') + (s.optional ? ' pin-opt' : ''), 'data-pin': i, tabindex: 0, role: 'button', 'aria-label': (s.n ? s.n + ' ' : '') + s.title }, self.gPins);
      var inner = mk('g', { class: 'pin-in' }, g);
      if (s.hotel) {
        mk('circle', { class: 'pin-bg', r: 14 }, inner);
        mk('g', { class: 'ico', transform: 'scale(0.6)' }, inner).innerHTML = icon('house');
      } else {
        mk('circle', { class: 'pin-bg', r: 12.5 }, inner);
        var t = mk('text', { class: 'pin-n', 'text-anchor': 'middle', dy: '0.36em' }, inner);
        t.textContent = s.n;
      }
    });

    // travel days get "台北段 / 台南段" shortcuts
    var groups = [[]];
    route.forEach(function (s, i) {
      if (i && s.via === 'hsr') groups.push([]);
      groups[groups.length - 1].push(s);
    });
    if (groups.length > 1) {
      this.parts.innerHTML = groups.map(function (gr, k) {
        var lat = gr.reduce(function (a, s) { return a + s.at[0]; }, 0) / gr.length;
        var nums = gr.filter(function (s) { return s.n; }).map(function (s) { return s.n; });
        var range = nums.length ? ' ' + nums[0] + (nums.length > 1 ? '–' + nums[nums.length - 1] : '') : '';
        return '<button type="button" class="part" data-part="' + k + '">' + (lat > 24 ? '台北段' : '台南段') + range + '</button>';
      }).join('');
      this.parts.hidden = false;
    }

    this.view = { type: 'day', stops: stops, segs: segs, groups: groups };
    var pts = stops.map(function (s) { return s.w; });
    this.view.fitPts = pts;
    this.view.fit = this.fitTo(pts);
    this.startView(this.view.fit);
  };

  P.startView = function (target) {
    var self = this, v = this.view;
    v.drawing = false;
    v.segs.forEach(function (sg) { sg.p = 0; sg.lastP = -1; });
    if (v.stops) v.stops.forEach(function (s) { if (s.el) s.el.classList.remove('on'); });
    this.camVer++;
    this.flyTo(target, 950, function () { if (self.view === v) self.startDraw(); });
    if (this.anim) this.anim.toFit = true;
  };

  P.startDraw = function () {
    var v = this.view, self = this;
    this.layout();
    var t = 0;
    var arrive = {};
    var durs = v.segs.map(function (sg) { return REDUCED ? 0 : clamp(sg.len / 520, sg.mode === 'fly' ? 0.7 : 0.22, 1.1); });
    var sum = durs.reduce(function (a, b) { return a + b; }, 0);
    var squeeze = sum > 2.6 ? 2.6 / sum : 1;
    v.segs.forEach(function (sg, k) {
      var dur = durs[k] * squeeze;
      sg.t0 = t; sg.t1 = t + dur; t += dur;
      if (sg.bi >= 0) arrive[sg.bi] = arrive[sg.bi] == null ? sg.t1 : Math.min(arrive[sg.bi], sg.t1);
      if (sg.ai >= 0 && arrive[sg.ai] == null) arrive[sg.ai] = sg.t0;
    });
    v.drawTotal = t;
    v.drawT0 = performance.now();
    v.drawing = true;
    if (v.stops) v.stops.forEach(function (s, i) {
      if (!s.el) return;
      var at = arrive[i] != null ? arrive[i] : t;
      s.el.style.animationDelay = (REDUCED ? 0 : at) + 's';
      s.el.classList.add('on');
    });
    if (v.bubbles) v.bubbles.forEach(function (b, k) { b.g.style.animationDelay = (REDUCED ? 0 : t * 0.6 + k * 0.08) + 's'; b.g.classList.add('on'); });
  };

  // ---------- rendering ----------
  P.renderBase = function () {
    var self = this, s = this.cam.s, w = this.w, h = this.h;
    var coast = smooth(this.coastW.map(function (p) { return self.proj(p); }), true);
    this.landShadow.setAttribute('d', coast);
    this.landFill.setAttribute('d', coast);
    this.coastA.setAttribute('d', coast);
    this.coastB.setAttribute('d', coast);

    var showRiver = s > 0.45;
    this.rivers.forEach(function (r) {
      r.g.style.display = showRiver ? '' : 'none';
      if (!showRiver) return;
      var d = smooth(r.w.map(function (p) { return self.proj(p); }), false);
      var bw = clamp(s * r.width, 1.2, 70);
      r.band.setAttribute('d', d); r.edge.setAttribute('d', d);
      r.band.style.strokeWidth = bw;
      r.edge.style.strokeWidth = bw + 3;
    });

    var rail = smooth(this.hsrW.map(function (p) { return self.proj(p); }), false);
    this.hsrBed.setAttribute('d', rail);
    this.hsrTies.setAttribute('d', rail);
    this.hsrBed.parentNode.style.opacity = s > 6 ? 0.35 : 1;
    this.hsrW.forEach(function (p, i) {
      var q = self.proj(p);
      self.stations[i].setAttribute('cx', r1(q[0]));
      self.stations[i].setAttribute('cy', r1(q[1]));
    });

    var k = s < 0.5 ? 0.62 : s < 3 ? 0.82 : 0.95;
    this.doodles.forEach(function (d) {
      var on = s >= (d.d.min || 0) && s < (d.d.max || 99);
      var q = on ? self.proj(d.w) : null;
      if (q) { q[0] += d.d.dx || 0; q[1] += d.d.dy || 0; }
      if (!q || q[0] < -40 || q[1] < -40 || q[0] > w + 40 || q[1] > h + 40) { d.outer.style.display = 'none'; return; }
      d.outer.style.display = '';
      d.outer.setAttribute('transform', 'translate(' + r1(q[0]) + ' ' + r1(q[1]) + ')');
      d.inner.setAttribute('transform', 'scale(' + r1(k * (d.d.size || 1) * 100) / 100 + ')' + (d.d.rot ? ' rotate(' + d.d.rot + ')' : ''));
    });

    this.labels.forEach(function (l) {
      var on = s >= l.l.min && s < l.l.max;
      var q = on ? self.proj(l.w) : null;
      if (!q || q[0] < -80 || q[1] < -30 || q[0] > w + 80 || q[1] > h + 30) { l.el.style.display = 'none'; return; }
      l.el.style.display = '';
      l.el.setAttribute('x', r1(q[0] + (l.l.dx || 0)));
      l.el.setAttribute('y', r1(q[1] + (l.l.dy || 0)));
    });
  };

  P.layout = function () {
    var v = this.view, self = this;
    if (!v) return;
    // pins: true screen spots, then push apart so numbers never sit on top of each other
    var stops = v.stops || [];
    var own = stops.filter(function (s) { return s.pinOf == null; });
    own.forEach(function (s) { s.tp = self.proj(s.w); s.dp = [s.tp[0], s.tp[1]]; });
    var minD = 27;
    for (var it = 0; it < 8; it++) {
      for (var i = 0; i < own.length; i++) for (var j = i + 1; j < own.length; j++) {
        var a = own[i].dp, b = own[j].dp;
        var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
        if (d >= minD) continue;
        if (d < 0.01) { dx = Math.cos(j * 2.4); dy = Math.sin(j * 2.4); d = 1; }
        var push = (minD - d) / 2, ux = dx / d, uy = dy / d;
        a[0] -= ux * push; a[1] -= uy * push;
        b[0] += ux * push; b[1] += uy * push;
      }
    }
    stops.forEach(function (s) {
      if (s.pinOf != null) { s.tp = self.proj(s.w); s.dp = stops[s.pinOf].dp; }
      if (s.el) s.el.setAttribute('transform', 'translate(' + r1(s.dp[0]) + ' ' + r1(s.dp[1]) + ')');
    });

    // segments follow the pins that were nudged
    v.segs.forEach(function (sg) {
      var A = stops[sg.ai], B = stops[sg.bi];
      var oa = A ? [A.dp[0] - A.tp[0], A.dp[1] - A.tp[1]] : [0, 0];
      var ob = B ? [B.dp[0] - B.tp[0], B.dp[1] - B.tp[1]] : [0, 0];
      var n = sg.w.length - 1;
      sg.scr = sg.w.map(function (p, i) {
        var q = self.proj(p), u = i / n;
        return [q[0] + oa[0] * (1 - u) + ob[0] * u, q[1] + oa[1] * (1 - u) + ob[1] * u];
      });
      sg.cum = cumulative(sg.scr);
      sg.len = sg.cum[sg.cum.length - 1];
      sg.lastP = -1;
    });

    // one long path for the little traveller
    var all = [], modes = [], acc = 0;
    v.segs.forEach(function (sg) {
      modes.push({ from: acc, to: acc + sg.len, mode: sg.mode });
      acc += sg.len;
      all = all.concat(all.length ? sg.scr.slice(1) : sg.scr);
    });
    v.trip = all.length > 1 ? { p: all, c: cumulative(all), modes: modes } : null;

    if (v.nodes) v.nodes.forEach(function (n) {
      if (!n.dot) return;
      var q = self.proj(n.w);
      n.dot.setAttribute('cx', r1(q[0])); n.dot.setAttribute('cy', r1(q[1]));
    });
    if (v.bubbles) {
      var showB = this.cam.s < 0.6;
      this.gBubbles.style.display = showB ? '' : 'none';
      if (showB) v.bubbles.forEach(function (b) {
        if (!b.tw) {
          try { b.tw = b.text.getComputedTextLength(); } catch (e) { b.tw = 0; }
          if (!b.tw) b.tw = b.b.t.length * 11;
        }
        var a = self.proj(b.w);
        var bx = clamp(a[0] + b.b.dx, 6, self.w - b.tw - 38);
        var by = clamp(a[1] + b.b.dy, 6, self.h - 34);
        b.rect.setAttribute('x', r1(bx)); b.rect.setAttribute('y', r1(by)); b.rect.setAttribute('width', r1(b.tw + 32));
        b.dot.setAttribute('cx', r1(bx + 13)); b.dot.setAttribute('cy', r1(by + 14));
        b.text.setAttribute('x', r1(bx + 22)); b.text.setAttribute('y', r1(by + 18.5));
        var ex = bx + (b.tw + 32) / 2, ey = by + 14;
        b.leader.setAttribute('d', 'M' + r1(a[0]) + ' ' + r1(a[1]) + 'Q' + r1((a[0] + ex) / 2) + ' ' + r1(Math.min(a[1], ey) - 10) + ' ' + r1(ex) + ' ' + r1(ey));
      });
    }
    this.placePop();
  };

  P.renderRoute = function (now, force) {
    var v = this.view;
    if (!v || !v.segs.length) return;
    var el = v.drawing ? (now - v.drawT0) / 1000 : (v.drawT0 ? Infinity : -1);
    var done = true;
    v.segs.forEach(function (sg) {
      var p = el < 0 ? 0 : sg.t1 > sg.t0 ? clamp((el - sg.t0) / (sg.t1 - sg.t0), 0, 1) : (el >= sg.t0 ? 1 : 0);
      if (p < 1) done = false;
      if (!force && p === sg.lastP) return;
      sg.lastP = p;
      var d = p <= 0 ? '' : poly(p >= 1 ? sg.scr : partial(sg.scr, sg.cum, sg.len * ease(p)));
      sg.base.setAttribute('d', d);
      sg.flow.setAttribute('d', d);
    });
    if (v.drawing && done) {
      v.drawing = false;
      v.travelT0 = now;
      if (!REDUCED && v.trip) this.gTravel.style.display = '';
    }
  };

  P.renderTraveler = function (now) {
    var v = this.view;
    if (!v || !v.trip || v.drawing || REDUCED || this.gTravel.style.display === 'none') return;
    var L = v.trip.c[v.trip.c.length - 1];
    var period = clamp(L / 85, 6, 15) * 1000;
    var u = ((now - v.travelT0) % (period + 900)) / period;
    if (u > 1) u = 1;
    var d = ease(u) * L;
    var pt = pointAt(v.trip.p, v.trip.c, d);
    var mode = 'car';
    for (var i = 0; i < v.trip.modes.length; i++) if (d <= v.trip.modes[i].to + 0.01) { mode = v.trip.modes[i].mode; break; }
    var showT = mode === 'hsr', showP = mode === 'fly';
    this.tvTrain.style.display = showT ? '' : 'none';
    this.tvPlane.style.display = showP ? '' : 'none';
    this.tvHeart.style.display = showT || showP ? 'none' : '';
    var deg = pt[2] * 180 / Math.PI;
    var flip = Math.cos(pt[2]) < 0 ? ' scale(1 -1)' : '';
    var rot = showT ? ' rotate(' + r1(deg) + ')' + flip : showP ? ' rotate(' + r1(deg) + ')' : '';
    var bob = showT || showP ? 0 : Math.sin(now / 160) * 2;
    this.gTravel.setAttribute('transform', 'translate(' + r1(pt[0]) + ' ' + r1(pt[1] - 4 + bob) + ')' + rot);
  };

  P.tick = function (now) {
    requestAnimationFrame(this.tick);
    if (!this.visible) return;
    if (this.anim) this.stepAnim(now);
    var changed = this.camVer !== this.drawnVer;
    if (changed) {
      this.drawnVer = this.camVer;
      this.renderBase();
      this.layout();
    }
    if (this.view) {
      if (changed || this.view.drawing) this.renderRoute(now, changed);
      this.renderTraveler(now);
    }
  };

  // ---------- popover ----------
  P.openPop = function (i) {
    var v = this.view;
    if (!v || !v.stops[i]) return;
    var s = v.stops[i];
    var pinIdx = s.pinOf != null ? s.pinOf : i;
    this.popIdx = pinIdx;
    this.pop.innerHTML =
      '<button type="button" class="pop-x" aria-label="关闭">×</button>' +
      '<p class="pop-meta">' + (s.n ? '<span class="pop-n">' + s.n + '</span>' : '') + esc(s.time || (s.hotel ? '酒店' : '')) + '</p>' +
      '<p class="pop-title">' + esc(s.title) + '</p>' +
      (s.blurb ? '<p class="pop-text">' + esc(s.blurb) + '</p>' : '') +
      '<div class="pop-act">' +
        (s.mapq ? '<a class="pop-btn" href="' + mapUrl(s.mapq) + '" target="_blank" rel="noopener">导航 ↗</a>' : '') +
        (s.item != null ? '<button type="button" class="pop-btn pop-more" data-more="' + s.item + '">看行程卡</button>' : '') +
      '</div>';
    this.pop.hidden = false;
    this.gPins.querySelectorAll('.pin.is-active').forEach(function (p) { p.classList.remove('is-active'); });
    var el = v.stops[pinIdx].el;
    if (el) { el.classList.add('is-active'); el.parentNode.appendChild(el); }
    this.placePop();
  };
  P.closePop = function () {
    this.popIdx = null;
    if (this.pop) this.pop.hidden = true;
    if (this.gPins) this.gPins.querySelectorAll('.pin.is-active').forEach(function (p) { p.classList.remove('is-active'); });
  };
  P.placePop = function () {
    if (this.popIdx == null || !this.view || !this.view.stops[this.popIdx]) return;
    var s = this.view.stops[this.popIdx];
    if (!s.dp) return;
    var pw = this.pop.offsetWidth || 240, ph = this.pop.offsetHeight || 120;
    var x = clamp(s.dp[0] - pw / 2, 8, this.w - pw - 8);
    var y = s.dp[1] - ph - 22;
    if (y < 8) y = Math.min(s.dp[1] + 22, this.h - ph - 8);
    this.pop.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  };

  P.focus = function (i) {
    var v = this.view;
    if (!v || !v.stops[i]) return;
    var s = v.stops[i], self = this;
    var target = clamp(Math.max(v.fit.s * 1.7, 9), S_MIN, 28);
    this.closePop();
    this.flyTo({ s: target, x: s.w[0], y: s.w[1] - 46 / target }, 850, function () { self.openPop(i); });
  };
  P.fitView = function () {
    if (!this.view) return;
    this.closePop();
    this.flyTo(this.fitTo(this.view.fitPts, this.view.type === 'all' ? 1 : 26), 700);
  };

  // ---------- input ----------
  P.bind = function () {
    var self = this, svg = this.svg;

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        var w = self.host.clientWidth, h = self.host.clientHeight;
        if (!w || !h || (w === self.w && h === self.h)) return;
        self.w = w; self.h = h;
        // keep the framing until the person has moved the map themselves
        if (self.view && !self.userMoved && self.popIdx == null) {
          self.view.fit = self.fitTo(self.view.fitPts, self.view.type === 'all' ? 1 : 26);
          if (!self.anim) self.setCam(self.view.fit);
          else if (self.anim.toFit) self.anim.b = self.view.fit;
        }
        self.camVer++;
      }).observe(this.host);
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; }).observe(this.host);
    }

    // mouse / pen drag
    var drag = null;
    this.moved = false;
    svg.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, id: e.pointerId };
      self.moved = false;
    });
    svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (!self.moved) {
        if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) <= 5) return;
        // only a real drag captures the pointer, so a plain click still lands on the pin
        self.moved = true;
        self.anim = null;
        svg.classList.add('is-dragging');
        try { svg.setPointerCapture(drag.id); } catch (err) { /* ok */ }
      }
      self.pan(e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX; drag.y = e.clientY;
    });
    function endDrag() { drag = null; svg.classList.remove('is-dragging'); }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.anim = null;
      var r = svg.getBoundingClientRect();
      var f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      self.zoomAt(f, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    // touch: one finger scrolls the page, two fingers move the map
    var pinch = null, oneStart = null, hintTimer = null;
    function mid(t) { return [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2]; }
    function span(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    svg.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinch = { m: mid(e.touches), d: span(e.touches) };
        self.anim = null;
        self.moved = true;
        self.hint.hidden = true;
      } else if (e.touches.length === 1) {
        oneStart = [e.touches[0].clientX, e.touches[0].clientY];
        self.moved = false;
      }
    }, { passive: true });
    svg.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinch) {
        e.preventDefault();
        var r = svg.getBoundingClientRect();
        var m = mid(e.touches), d = span(e.touches);
        self.pan(m[0] - pinch.m[0], m[1] - pinch.m[1]);
        if (pinch.d > 0) self.zoomAt(d / pinch.d, m[0] - r.left, m[1] - r.top);
        pinch = { m: m, d: d };
      } else if (e.touches.length === 1 && oneStart) {
        var dx = e.touches[0].clientX - oneStart[0], dy = e.touches[0].clientY - oneStart[1];
        if (Math.abs(dx) + Math.abs(dy) > 8) self.moved = true;
        if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          self.hint.hidden = false;
          clearTimeout(hintTimer);
          hintTimer = setTimeout(function () { self.hint.hidden = true; }, 1600);
          oneStart = null;
        }
      }
    }, { passive: false });
    svg.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; if (!e.touches.length) oneStart = null; });

    // taps on pins and bubbles
    svg.addEventListener('click', function (e) {
      if (self.moved) { self.moved = false; return; }
      var pin = e.target.closest && e.target.closest('[data-pin]');
      if (pin) { self.openPop(+pin.getAttribute('data-pin')); return; }
      var b = e.target.closest && e.target.closest('[data-day]');
      if (b && self.opts.onBubble) { self.opts.onBubble(b.getAttribute('data-day')); return; }
      self.closePop();
    });
    svg.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var pin = e.target.closest && e.target.closest('[data-pin]');
      if (pin) { e.preventDefault(); self.openPop(+pin.getAttribute('data-pin')); return; }
      var b = e.target.closest && e.target.closest('[data-day]');
      if (b && self.opts.onBubble) { e.preventDefault(); self.opts.onBubble(b.getAttribute('data-day')); }
    });

    this.ui.addEventListener('click', function (e) {
      var z = e.target.closest('[data-z]');
      if (z) {
        var c = self.cam, kind = z.getAttribute('data-z');
        if (kind === 'fit') { self.fitView(); return; }
        var f = kind === 'in' ? 1.8 : 1 / 1.8;
        self.flyTo({ s: clamp(c.s * f, S_MIN, S_MAX), x: c.x, y: c.y }, 300);
        return;
      }
      var part = e.target.closest('[data-part]');
      if (part && self.view && self.view.groups) {
        var gr = self.view.groups[+part.getAttribute('data-part')];
        self.closePop();
        self.flyTo(self.fitTo(gr.map(function (s) { return s.w; })), 900);
        return;
      }
      if (e.target.closest('.pop-x')) { self.closePop(); return; }
      var more = e.target.closest('[data-more]');
      if (more && self.opts.onDetail) self.opts.onDetail(+more.getAttribute('data-more'));
    });
  };

  window.TripMap = TripMap;
})();
