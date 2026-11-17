/* ============================================================
   app.js — 启动、路由、全局交互（光标 / 粒子 / 行情 / 检索）
   ============================================================ */
import { loadDB, state, NAV, esc, safe, statusBase } from './data.js';
import { renderHome, renderCompanies, renderCompany, renderCases, renderCase,
  renderChain, renderPaths, renderSurvival, renderRegulations, renderSources, renderAbout,
  bindView } from './views.js';
import { initCharts, disposeCharts, resizeCharts } from './charts.js';

const ROUTES = NAV.map(n => n[0]);
const VALID = new Set([...ROUTES, 'company', 'case']);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const view = document.getElementById('view');

/* ---------- route ---------- */
function parseRoute(){
  const raw = location.hash.replace(/^#\/?/, '');
  const qi = raw.indexOf('?');
  const path = qi >= 0 ? raw.slice(0, qi) : raw;
  const params = new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : '');
  const segs = path.split('/').filter(Boolean);
  return { route: segs[0] || 'home', param: segs[1] ? decodeURIComponent(segs[1]) : null, params };
}

function titleFor(route, param){
  if (route === 'company' && state.db){
    const c = state.db.companies.find(x => x.id === param || x.code === param);
    if (c) return `${c.name} ${c.code} · 退市赔偿档案 · 退市到账`;
  }
  if (route === 'case' && state.db){
    const c = state.db.cases.find(x => x.id === param);
    if (c) return `${c.name} ${c.id} · 退市到账`;
  }
  const map = {
    home: '退市到账 · A股退市中小投资者赔偿兑现链数据平台',
    companies: '退市公司全景库 · 退市到账',
    cases: '赔偿案件主表 · 退市到账',
    chain: '兑现链透视：L·PEU·R · 退市到账',
    paths: '八条救济路径实效 · 退市到账',
    survival: '时间与生存分析 · 退市到账',
    regulations: '法规政策库 · 退市到账',
    sources: '数据来源与可核验性 · 退市到账',
    about: '关于项目 · 退市到账'
  };
  return map[route] || map.home;
}

function renderFor(route, param, params){
  switch(route){
    case 'companies': return renderCompanies(params);
    case 'company': return renderCompany(param);
    case 'cases': return renderCases(params);
    case 'case': return renderCase(param);
    case 'chain': return renderChain();
    case 'paths': return renderPaths();
    case 'survival': return renderSurvival();
    case 'regulations': return renderRegulations(params);
    case 'sources': return renderSources(params);
    case 'about': return renderAbout();
    default: return renderHome();
  }
}

let fieldRaf = 0, fieldCleanup = null;
function teardownView(){
  if (fieldRaf){ cancelAnimationFrame(fieldRaf); fieldRaf = 0; }
  if (fieldCleanup){ fieldCleanup(); fieldCleanup = null; }
  disposeCharts();
  stopTicker();
}

async function render(initial = false){
  teardownView();
  const { route, param, params } = parseRoute();
  const r = VALID.has(route) ? route : 'home';
  const html = renderFor(r, param, params);

  const commit = () => {
    view.innerHTML = html;
    window.scrollTo(0, 0);
    state.route = r;
    setActive(r);
    document.title = titleFor(r, param);
    try { bindView(r, param, params); } catch (e){ console.error('[bind]', e); }
    observeReveals();
    if (r === 'home'){ initField(); startTicker(); }
    view.classList.remove('view-enter');
    void view.offsetWidth;
    view.classList.add('view-enter');
  };

  if (!initial && !reduceMotion && document.startViewTransition){
    try { await document.startViewTransition(commit).finished; }
    catch(e){ commit(); }
  } else {
    commit();
  }
}

function setActive(route){
  const map = { company:'companies', case:'cases' };
  const key = map[route] || route;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.route === key));
  document.getElementById('nav').classList.remove('open');
  document.getElementById('menuBtn').setAttribute('aria-expanded', 'false');
}

/* ---------- reveal ---------- */
let revealIO = null;
function observeReveals(){
  if (revealIO) revealIO.disconnect();
  const els = document.querySelectorAll('.reveal, .stagger');
  if (reduceMotion){ els.forEach(e => e.classList.add('in')); return; }
  revealIO = new IntersectionObserver((entries) => {
    for (const en of entries){
      if (en.isIntersecting){
        en.target.classList.add('in');
        revealIO.unobserve(en.target);
      }
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  els.forEach((el, i) => {
    el.style.transitionDelay = Math.min(i % 6, 3) * 60 + 'ms';
    revealIO.observe(el);
  });
}

/* ---------- cursor + spotlight ---------- */
function initCursor(){
  if (window.matchMedia('(pointer: coarse)').matches || reduceMotion) return;
  document.body.classList.add('cursor-on');
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  const label = document.getElementById('cursorLabel');
  let mx = window.innerWidth/2, my = window.innerHeight/2;
  let rx = mx, ry = my;

  window.addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px,${my}px)`;
    document.documentElement.style.setProperty('--mx', (mx/window.innerWidth*100).toFixed(2)+'%');
    document.documentElement.style.setProperty('--my', (my/window.innerHeight*100).toFixed(2)+'%');
  }, { passive: true });

  (function loop(){
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.transform = `translate(${rx}px,${ry}px)`;
    requestAnimationFrame(loop);
  })();

  const interactive = 'a,button,input,select,textarea,[data-cursor],tr[data-href],.case-card,.year-card,.path-card-head,.chain-node,.portal,.src-link';
  document.addEventListener('mouseover', e => {
    const el = e.target.closest(interactive);
    if (!el){ ring.classList.remove('hover','label'); label.textContent=''; return; }
    const txt = el.getAttribute('data-cursor');
    if (txt){ ring.classList.add('label'); label.textContent = txt; }
    else { ring.classList.add('hover'); label.textContent=''; }
  });
  document.addEventListener('mouseout', e => {
    if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest(interactive)){
      ring.classList.remove('hover','label'); label.textContent='';
    }
  });
  document.addEventListener('pointerdown', () => ring.classList.add('press'));
  document.addEventListener('pointerup', () => ring.classList.remove('press'));
}

/* ---------- magnetic / tilt / spotlight ---------- */
function initMotion(){
  if (reduceMotion) return;
  document.addEventListener('pointermove', e => {
    document.querySelectorAll('.panel,.case-card,.year-card').forEach(el => {
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left-40 || e.clientX > r.right+40 || e.clientY < r.top-40 || e.clientY > r.bottom+40) return;
      el.style.setProperty('--mx', ((e.clientX-r.left)/r.width*100)+'%');
      el.style.setProperty('--my', ((e.clientY-r.top)/r.height*100)+'%');
    });
  }, { passive: true });

  const attachMagnetic = () => {
    document.querySelectorAll('.magnetic').forEach(el => {
      if (el.dataset.mag) return;
      el.dataset.mag = '1';
      el.addEventListener('pointermove', ev => {
        const r = el.getBoundingClientRect();
        const dx = ev.clientX - (r.left + r.width/2);
        const dy = ev.clientY - (r.top + r.height/2);
        el.style.transform = `translate(${dx*0.16}px,${dy*0.2}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    const tilt = document.getElementById('chainCard');
    if (tilt && !tilt.dataset.tilt){
      tilt.dataset.tilt = '1';
      tilt.addEventListener('pointermove', ev => {
        const r = tilt.getBoundingClientRect();
        const px = (ev.clientX - r.left)/r.width - .5;
        const py = (ev.clientY - r.top)/r.height - .5;
        tilt.style.transform = `perspective(1000px) rotateY(${px*4}deg) rotateX(${-py*4}deg)`;
      });
      tilt.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
    }
  };
  attachMagnetic();
  new MutationObserver(attachMagnetic).observe(document.body, { childList: true, subtree: true });
}

/* ---------- hero particle field ---------- */
function initField(){
  const canvas = document.getElementById('field');
  if (!canvas || reduceMotion) return;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  let parts = [];
  let mouse = { x: -9999, y: -9999, active: false };

  function resize(){
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    const count = Math.min(110, Math.max(38, Math.floor(W*H/16000)));
    parts = Array.from({ length: count }, () => ({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-.5)*0.32, vy: (Math.random()-.5)*0.32,
      r: Math.random()*1.6 + .4, a: Math.random()*0.5 + 0.2
    }));
  }
  resize();
  window.addEventListener('resize', resize);

  const onMove = e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
  };
  const onLeave = () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999; };
  canvas.parentElement.addEventListener('pointermove', onMove, { passive: true });
  canvas.parentElement.addEventListener('pointerleave', onLeave);

  function draw(){
    ctx.clearRect(0,0,W,H);
    for (const p of parts){
      p.x += p.vx; p.y += p.vy;
      if (p.x < -20) p.x = W+20; if (p.x > W+20) p.x = -20;
      if (p.y < -20) p.y = H+20; if (p.y > H+20) p.y = -20;
      if (mouse.active){
        const dx = p.x-mouse.x, dy = p.y-mouse.y;
        const d2 = dx*dx+dy*dy;
        if (d2 < 20000 && d2 > 1){
          const f = (20000-d2)/20000 * 0.028;
          p.x += dx*f; p.y += dy*f;
        }
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(120,230,255,${p.a})`;
      ctx.fill();
    }
    for (let i=0;i<parts.length;i++){
      for (let j=i+1;j<parts.length;j++){
        const a=parts[i], b=parts[j];
        const dx=a.x-b.x, dy=a.y-b.y, d=Math.sqrt(dx*dx+dy*dy);
        if (d < 118){
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
          ctx.strokeStyle = `rgba(90,160,255,${(1-d/118)*0.14})`;
          ctx.lineWidth = .7; ctx.stroke();
        }
      }
      if (mouse.active){
        const dx=parts[i].x-mouse.x, dy=parts[i].y-mouse.y, d=Math.sqrt(dx*dx+dy*dy);
        if (d < 170){
          ctx.beginPath(); ctx.moveTo(parts[i].x,parts[i].y); ctx.lineTo(mouse.x,mouse.y);
          ctx.strokeStyle = `rgba(56,242,255,${(1-d/170)*0.28})`;
          ctx.lineWidth = .8; ctx.stroke();
        }
      }
    }
    fieldRaf = requestAnimationFrame(draw);
  }
  draw();
  fieldCleanup = () => {
    window.removeEventListener('resize', resize);
    if (canvas.parentElement){
      canvas.parentElement.removeEventListener('pointermove', onMove);
      canvas.parentElement.removeEventListener('pointerleave', onLeave);
    }
  };
}

/* ---------- live ticker ---------- */
let tickerTimer = null, clockTimer = null;
const STATIC_TICKER = [
  ['数据库版本', 'v3.0 合并去重版'],
  ['主样本', '199 家纯A股'],
  ['唯一案件', '71 条'],
  ['来源台账', '87 条'],
  ['已验证回收', '5 起事件'],
  ['观察截止', '2026-11-14']
];

function liveClock(){
  const n = new Date();
  const t = n.toLocaleTimeString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
  return `北京时间 ${t}`;
}
function tickerHTML(indices){
  const items = [];
  for (const x of indices){
    const up = x.pct >= 0;
    items.push(`<div class="ticker-item"><span>${esc(x.name)}</span><b>${x.price.toFixed(2)}</b><span class="chg ${up?'up':'down'}">${up?'+':''}${x.pct.toFixed(2)}%</span></div>`);
  }
  items.push(`<div class="ticker-item"><span style="color:var(--cyan)">LIVE</span><b style="font-size:12px">${liveClock()}</b></div>`);
  for (const [k,v] of STATIC_TICKER){
    items.push(`<div class="ticker-item"><span>${k}</span><b>${v}</b></div>`);
  }
  return [...items, ...items].join('');
}
function renderTicker(indices){
  const track = document.getElementById('tickerTrack');
  if (!track) return;
  track.innerHTML = tickerHTML(indices);
}
function fetchQuotes(){
  return new Promise((resolve, reject) => {
    const cb = '__em' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let done = false;
    const cleanup = () => { if (script.parentNode) script.remove(); delete window[cb]; };
    const timer = setTimeout(() => { if (!done){ done = true; cleanup(); reject(new Error('timeout')); } }, 7000);
    window[cb] = (data) => {
      done = true; clearTimeout(timer);
      try {
        const diff = (data && data.data && data.data.diff) || [];
        resolve(diff.map(d => ({ name: d.f14, price: Number(d.f2), pct: Number(d.f3) })).filter(x => !isNaN(x.price)));
      } catch(e){ reject(e); }
      cleanup();
    };
    script.onerror = () => { if (!done){ done = true; clearTimeout(timer); cleanup(); reject(new Error('network')); } };
    script.src = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006&fields=f2,f3,f4,f12,f14&cb=${cb}`;
    document.head.appendChild(script);
  });
}
function startTicker(){
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    const el = document.querySelector('.ticker-item b');
    const track = document.getElementById('tickerTrack');
    if (!track) return;
    // 更新时间标记
    const nodes = track.querySelectorAll('.ticker-item');
    // 简单原地刷新：找到包含“北京时间”的项
    const liveItem = [...nodes].find(n => n.textContent.includes('北京时间'));
    if (liveItem) liveItem.querySelector('b').textContent = liveClock();
  }, 1000);

  if (tickerTimer) return;
  const update = () => {
    if (!document.getElementById('tickerTrack')) { stopTicker(); return; }
    fetchQuotes().then(list => {
      if (list.length) renderTicker(list);
      const lbl = document.querySelector('.ticker-label');
      if (lbl && !lbl.dataset.live){ lbl.dataset.live = '1'; }
    }).catch(() => { /* 离线时保留静态数据脉搏 */ });
  };
  update();
  tickerTimer = setInterval(update, 30000);
}
function stopTicker(){
  if (tickerTimer){ clearInterval(tickerTimer); tickerTimer = null; }
  if (clockTimer){ clearInterval(clockTimer); clockTimer = null; }
}

/* ---------- palette ---------- */
let pIndex = 0, pItems = [];
function openPalette(prefill = ''){
  const pal = document.getElementById('palette');
  const input = document.getElementById('paletteInput');
  pal.hidden = false;
  input.value = prefill;
  renderPalette(prefill);
  setTimeout(() => input.focus(), 30);
}
function closePalette(){
  document.getElementById('palette').hidden = true;
}
function renderPalette(q){
  const box = document.getElementById('paletteResults');
  const hint = document.getElementById('paletteHint');
  const query = (q || '').trim().toLowerCase();
  let items = [];
  if (!query){
    items = state.paletteIndex.slice(0, 12).map(x => ({...x, group:'推荐'}));
    hint.textContent = '支持 6 位代码、公司简称、CASE-xxx、法规或来源关键词';
  } else {
    const scored = [];
    for (const it of state.paletteIndex){
      let score = 0;
      if (it.key && it.key.toLowerCase() === query) score += 100;
      if (it.title.toLowerCase().includes(query)) score += 40;
      if (it.sub && it.sub.toLowerCase().includes(query)) score += 12;
      if (it.hay && it.hay.includes(query)) score += 8;
      if (query.length >= 2 && it.key && it.key.toLowerCase().startsWith(query)) score += 30;
      if (score > 0) scored.push({ ...it, score });
    }
    scored.sort((a,b) => b.score - a.score);
    items = scored.slice(0, 22);
    hint.textContent = scored.length ? `找到 ${scored.length} 条相关记录` : '没有匹配结果，试试公司简称或 6 位代码';
  }
  pItems = items; pIndex = 0;
  if (!items.length){ box.innerHTML = `<div class="p-empty">没有找到相关记录。<br>可尝试：<b>泽达</b> · <b>688555</b> · <b>CASE-920680</b> · <b>先行赔付</b></div>`; return; }
  let html = '', last = '';
  items.forEach((it, i) => {
    if (it.group && it.group !== last){ html += `<div class="p-group">${it.group}</div>`; last = it.group; }
    html += `<div class="p-item ${i===0?'sel':''}" data-i="${i}" data-href="${esc(it.href)}">
      <span class="tag">${esc(it.type)}</span>
      <span class="tx"><b>${esc(it.title)}</b><small>${esc(it.sub || '')}</small></span>
      <span class="go">↵</span></div>`;
  });
  box.innerHTML = html;
}
function movePalette(dir){
  const nodes = [...document.querySelectorAll('.p-item')];
  if (!nodes.length) return;
  pIndex = (pIndex + dir + nodes.length) % nodes.length;
  nodes.forEach((n,i) => n.classList.toggle('sel', i === pIndex));
  nodes[pIndex].scrollIntoView({ block: 'nearest' });
}
function goPalette(){
  const el = document.querySelector('.p-item.sel');
  if (!el) return;
  closePalette();
  location.hash = el.dataset.href;
}

function initPalette(){
  const pal = document.getElementById('palette');
  const input = document.getElementById('paletteInput');
  document.getElementById('searchTrigger').addEventListener('click', () => openPalette());
  pal.addEventListener('click', e => { if (e.target === pal) closePalette(); });
  input.addEventListener('input', () => renderPalette(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown'){ e.preventDefault(); movePalette(1); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); movePalette(-1); }
    else if (e.key === 'Enter'){ e.preventDefault(); goPalette(); }
    else if (e.key === 'Escape'){ closePalette(); }
  });
  document.getElementById('paletteResults').addEventListener('click', e => {
    const it = e.target.closest('.p-item');
    if (it){ closePalette(); location.hash = it.dataset.href; }
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); openPalette(); }
    else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){
      e.preventDefault(); openPalette();
    }
    else if (e.key === 'Escape'){ closePalette(); }
  });
  window.__openPalette = openPalette;
}

/* ---------- chrome ---------- */
function initChrome(){
  const menu = document.getElementById('menuBtn');
  menu.addEventListener('click', () => {
    const nav = document.getElementById('nav');
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  const toTop = document.getElementById('toTop');
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const prog = document.getElementById('scrollProgress');
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h > 0 ? window.scrollY / h : 0;
    prog.style.width = (p * 100).toFixed(2) + '%';
    toTop.classList.toggle('on', window.scrollY > 600);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { resizeCharts(); }, 160);
  });

  // 点击锚点后平滑滚动
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#/"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href === location.hash){ e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
}

/* ---------- boot ---------- */
async function boot(){
  try {
    await loadDB();
    initCharts();
    initCursor();
    initMotion();
    initPalette();
    initChrome();
    await render(true);
    window.addEventListener('hashchange', () => render());
    const bootEl = document.getElementById('boot');
    setTimeout(() => bootEl.classList.add('done'), 260);
    setTimeout(() => bootEl.remove(), 1200);
  } catch (err){
    console.error(err);
    document.getElementById('boot').innerHTML = `<div class="boot-inner" style="max-width:460px;padding:24px">
      <div class="eyebrow" style="justify-content:center">DATA LOAD ERROR</div>
      <h2 style="margin:18px 0 10px;font-size:22px">数据文件未能加载</h2>
      <p style="color:#8CA0BE;font-size:13px;line-height:1.8">${esc(err.message || String(err))}<br>
      请通过本地服务器访问（例如 <code>python -m http.server</code>），或确认 <code>data/</code> 目录已随站点发布。</p>
    </div>`;
  }
}

boot();
