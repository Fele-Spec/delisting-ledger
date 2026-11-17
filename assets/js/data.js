/* ============================================================
   data.js — 数据加载、格式化、外部核查链接
   ============================================================ */
export const ROUTES = ['home','companies','cases','chain','paths','survival','regulations','sources','about'];

export const NAV = [
  ['home','总览'],['companies','退市公司库'],['cases','赔偿案件'],['chain','兑现链'],
  ['paths','路径实效'],['survival','时间与生存'],['regulations','法规'],['sources','数据源'],['about','关于']
];

export const state = {
  db: null,
  charts: [],
  route: null,
  paletteIndex: null,
};

const escMap = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
export function esc(s){
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => escMap[c]);
}
export function safe(s, fallback='—'){
  const v = esc(s).trim();
  return v === '' ? fallback : v;
}
export function arr(v){
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined || v === '') return [];
  return [v];
}

/* ---------- format ---------- */
export function fmtInt(n){
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}
export function fmtMoney(n, digits=2){
  if (n === null || n === undefined || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e8) return (n/1e8).toFixed(digits).replace(/\.?0+$/,'') + ' 亿';
  if (a >= 1e4) return (n/1e4).toFixed(digits).replace(/\.?0+$/,'') + ' 万';
  return fmtInt(n);
}
export function fmtPct(n, digits=1){
  if (n === null || n === undefined || isNaN(n)) return '—';
  return (n*100).toFixed(digits) + '%';
}
export function shortDate(s){
  return (s || '').toString().slice(0,10).replace(/-/g,'.');
}
export function yearOf(s){ return (s||'').toString().slice(0,4); }

/* ---------- status ---------- */
export function statusBase(code){
  if (!code) return 'U';
  const s = String(code).trim();
  if (s.includes('/')) return s.split('/')[0];
  const m = s.match(/^[A-Z]/);
  return m ? m[0] : 'U';
}
export function statusMeta(code){
  const db = state.db;
  const base = statusBase(code);
  const d = db && db.statusDict[base];
  if (d) return { code: base, ...d };
  return { code: base, label: '待核/未确认', short: '待核', color: '#CBD5E1', def: '公开渠道未能确认是否存在有效救济或进展' };
}
export function statusPill(code, opts={}){
  const m = statusMeta(code);
  const label = opts.long ? `${m.code} · ${m.label}` : `${m.code} ${m.short}`;
  return `<span class="status-pill" style="color:${m.color};border-color:${hexA(m.color,.28)};background:${hexA(m.color,.08)}" title="${esc(m.def)}"><i style="color:${m.color}"></i>${esc(label)}</span>`;
}
export function hexA(hex, a){
  const h = hex.replace('#','');
  const n = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

/* ---------- evidence ---------- */
export function evidenceLevel(type, name=''){
  const t = (type||'') + ' ' + (name||'');
  if (/行政处罚|证监会|交易所|法院|裁判|判决书|公告|监管|典型案例|投保基金|投服/.test(t)) return 'high';
  if (/媒体|报道|证券时报|证券日报|第一财经|财经|澎湃|新华|央广|中国证券报|上海证券报/.test(t)) return 'mid';
  if (/律师|征集|股吧|雪球|视频|自媒体|UGC/.test(t)) return 'low';
  return 'mid';
}
export function evidenceBadge(type, name=''){
  const lvl = evidenceLevel(type, name);
  const meta = {
    high: ['高','green','官方文书 / 法院公告 / 公司公告'],
    mid: ['中','gold','权威媒体 / 投保机构披露'],
    low: ['低','red','律师征集 / 股吧 / 视频']
  }[lvl];
  return `<span class="badge ${meta[1]}" title="证据分级：${meta[2]}">证据${meta[0]}</span>`;
}

/* ---------- links ---------- */
export function marketPrefix(code){
  const c = String(code||'');
  if (/^(6)/.test(c)) return 'sh';
  if (/^(0|3)/.test(c)) return 'sz';
  if (/^(4|8|92)/.test(c)) return 'bj';
  if (/^(900)/.test(c)) return 'sh';
  if (/^(200)/.test(c)) return 'sz';
  return 'sh';
}
export function codeOrgPrefix(code){
  const c = String(code||'');
  if (/^(6|9)/.test(c)) return 'sh';
  if (/^(4|8)/.test(c)) return 'bj';
  return 'sz';
}
export function extLinks(code, name=''){
  const c = encodeURIComponent(code||'');
  const p = marketPrefix(code);
  const q = encodeURIComponent(name || code || '');
  return [
    { k:'巨潮资讯', s:'公告全文检索', u:`http://www.cninfo.com.cn/new/fulltextSearch?notautosubmit=&keyWord=${c}` },
    { k:'东方财富', s:'个股与行情', u:`https://quote.eastmoney.com/${p}${c}.html` },
    { k:'同花顺', s:'个股资料页', u:`http://stockpage.10jqka.com.cn/${c}/` },
    { k:'财联社', s:'电报与报道', u:`https://www.cls.cn/searchPage?keyword=${q}` },
    { k:'新浪财经', s:'公司档案', u:`https://finance.sina.com.cn/realstock/company/${p}${c}/nc.shtml` },
    { k:'中国裁判文书网', s:'裁判文书检索', u:`https://wenshu.court.gov.cn/` },
    { k:'证监会', s:'行政处罚决定', u:`http://www.csrc.gov.cn/csrc/c101928/common_list.shtml` },
    { k:'全国企业破产重整案件信息网', s:'破产/重整公告', u:`https://pccz.court.gov.cn/pcajxxw/index/xxwsy` },
    { k:'中国投资者网', s:'投资者保护信息', u:`https://www.investor.org.cn/` },
    { k:'投保基金', s:'先行赔付基金', u:`https://www.sipf.com.cn/` }
  ];
}
export function exchLink(code){
  const c = String(code||'');
  if (/^(6|9)/.test(c)) return { k:'上交所', u:`https://www.sse.com.cn/assortment/stock/list/info/announcement/index.shtml?productId=${c}` };
  if (/^(4|8)/.test(c)) return { k:'北交所', u:`https://www.bse.cn/disclosure/announcement.html` };
  return { k:'深交所', u:`https://www.szse.cn/disclosure/listed/notice/index.html?stock=${c}` };
}

/* ---------- data load ---------- */
const FILES = ['meta','companies','cases','parties','events','survival','peu','regs','sources','ugc','paths','yearly','dictionary','audit','completeness','dashboard'];
export async function loadDB(){
  const base = new URL('../../data/', import.meta.url);
  const results = await Promise.all(FILES.map(f =>
    fetch(new URL(f + '.json', base), { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error(`数据文件加载失败：${f}.json (${r.status})`);
      return r.json();
    })
  ));
  const db = {};
  FILES.forEach((f,i) => db[f] = results[i]);
  const head = results[0];
  db.meta = head.meta;
  db.stats = head.stats;
  db.statusDict = head.statusDict;
  db.km = head.km;
  db.generatedAt = head.generatedAt;
  state.db = db;
  buildPaletteIndex();
  return db;
}

/* ---------- palette index ---------- */
function buildPaletteIndex(){
  const db = state.db;
  const idx = [];
  for (const c of db.companies){
    idx.push({ type:'公司', key:c.code, title:`${c.name}  ${c.code}`, sub:`${c.year||''} · ${c.board||''} · ${c.subtype||''}`,
      hay:`${c.name} ${c.code} ${c.board} ${c.subtype} ${c.fact} ${c.statusNote}`.toLowerCase(), href:`#/company/${encodeURIComponent(c.id)}` });
  }
  for (const c of db.cases){
    idx.push({ type:'案件', key:c.id, title:`${c.name} · ${c.id}`, sub:`${c.status} · ${c.path||''}`,
      hay:`${c.id} ${c.name} ${c.code} ${c.path} ${c.court} ${c.docNo}`.toLowerCase(), href:`#/case/${encodeURIComponent(c.id)}` });
  }
  for (const r of db.regs){
    idx.push({ type:'法规', key:r.name, title:r.name, sub:`${r.issuer||''} ${r.date||''}`,
      hay:`${r.name} ${r.issuer} ${r.content}`.toLowerCase(), href:`#/regulations?q=${encodeURIComponent(r.name.slice(0,12))}` });
  }
  for (const s of db.sources){
    idx.push({ type:'来源', key:s.no, title:s.name, sub:`${s.publisher||''} ${s.date||''}`,
      hay:`${s.name} ${s.publisher} ${s.usage}`.toLowerCase(), href:`#/sources?q=${encodeURIComponent((s.name||'').slice(0,12))}` });
  }
  state.paletteIndex = idx;
}
