/* ============================================================
   views.js — 各视图渲染与交互绑定
   ============================================================ */
import {
  state, esc, safe, NAV, statusMeta, statusBase, statusPill, fmtInt, fmtMoney, fmtPct,
  evidenceLevel, evidenceBadge, extLinks, exchLink, marketPrefix, shortDate
} from './data.js';
import {
  yearChart, statusChart, recoveryChart, kmChart, eventChart, readinessDonut, track
} from './charts.js';

const db = () => state.db;

/* ---------------- shared bits ---------------- */
function sectionHead(eyebrow, title, desc, moreHref, moreLabel){
  return `<div class="section-head reveal">
    <div>
      <div class="eyebrow muted">${eyebrow}</div>
      <h2>${title}</h2>
      ${desc ? `<p>${desc}</p>` : ''}
    </div>
    ${moreHref ? `<a class="link-more" href="${moreHref}" data-cursor="前往">${moreLabel || '查看全部'}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>` : ''}
  </div>`;
}
function emptyState(msg){
  return `<div class="empty">${msg}</div>`;
}
function statusLegend(onclick=true){
  const d = db();
  const keys = Object.keys(d.statusDict);
  const counts = {};
  for (const [k,v] of Object.entries(d.stats.statusDist)) counts[k.split('/')[0]] = (counts[k.split('/')[0]]||0)+v;
  return `<div class="status-list">${keys.map(k => {
    const m = d.statusDict[k];
    return `<button class="status-row" data-status="${k}" ${onclick?'data-cursor="筛选"':''}>
      <span class="s-code" style="color:${m.color};border-color:${m.color}33;background:${m.color}12">${k}</span>
      <span class="s-main"><b>${m.label}</b><em>${m.def}</em></span>
      <span class="s-n">${counts[k]||0}</span>
    </button>`;
  }).join('')}</div>`;
}
function extGrid(code, name){
  const links = extLinks(code, name);
  const ex = exchLink(code);
  const all = [{ k: ex.k, s:'交易所公告', u: ex.u }, ...links];
  return `<div class="src-grid">${all.map(l =>
    `<a class="src-link" href="${l.u}" target="_blank" rel="noopener noreferrer" data-cursor="核查">
      <span class="dot"></span><span>${esc(l.k)}<small>${esc(l.s)}</small></span>
      <svg style="margin-left:auto;opacity:.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M9 7h8v8"/></svg>
    </a>`).join('')}</div>`;
}

/* ============================================================
   HOME
   ============================================================ */
export function renderHome(){
  const d = db(); const s = d.stats;
  const yearMax = Math.max(...d.yearly.map(y => y.aShare || 0));
  const tickerItems = [
    ['数据库版本', 'v3.0 合并去重版', ''],
    ['主样本', s.companies + ' 家公司', ''],
    ['唯一案件', s.cases + ' 条', ''],
    ['来源台账', s.sources + ' 条', ''],
    ['已验证回收', s.recoveryEvents + ' 起事件', ''],
    ['观察截止', '2026-11-14', '']
  ];

  return `
  <div class="hero">
    <canvas id="field" aria-hidden="true"></canvas>
    <div class="shell hero-grid">
      <div class="hero-left">
        <div class="eyebrow reveal">A股退市 · 中小投资者赔偿兑现链</div>
        <h1 class="hero-title reveal">退市之后，<br><span class="grad">钱到账了吗？</span></h1>
        <p class="hero-sub reveal">我们不只统计“有没有起诉、有没有胜诉”，而是把一笔损失从
          <b>法律确认</b> 追到 <b>账户到账</b>：199 家纯 A 股退市公司、71 条赔偿案件、87 条可溯源来源，
          用统一口径回答 <b>“谁赔、赔多少、卡在哪一段”</b>。</p>
        <form class="hero-search reveal" id="heroSearch" role="search">
          ${iconSearch()}
          <input id="heroInput" type="text" placeholder="输入证券代码 / 简称 / CASE-ID，立即查询" autocomplete="off" spellcheck="false" aria-label="检索退市公司或案件">
          <kbd>⌘K</kbd>
          <button class="go" type="submit" aria-label="检索">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </form>
        <div class="hero-actions reveal">
          <a class="btn btn-primary magnetic" href="#/companies" data-cursor="进入">进入退市公司库
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          <a class="btn btn-ghost magnetic" href="#/chain" data-cursor="了解">看懂 L → PEU → R</a>
        </div>
        <div class="hero-meta reveal">
          <span><i></i>观察截止 2026-11-14</span>
          <span><i></i>证据分级 高 / 中 / 低</span>
          <span><i></i>空白 ≠ 0，表示待核实</span>
        </div>
      </div>

      <div class="hero-right reveal">
        <div class="panel chain-card tilt" id="chainCard">
          <div class="panel-hair"></div>
          <div class="chain-head">
            <div>
              <div class="tag">Recovery Chain · v3.0</div>
              <h3>一笔损失的六道关</h3>
            </div>
            <span class="badge cyan">2022—2026</span>
          </div>
          <div class="chain-flow">
            ${[
              ['01','损失暴露 L','可识别的投资者损失规模','loss'],
              ['02','责任主体','向谁追偿 · 发行人 / 实控人 / 中介','party'],
              ['03','责任财产','从什么财产中实现 · 权属与优先受偿','property'],
              ['04','救济程序','先行赔付 / 代表人诉讼 / 调解 / 破产','procedure'],
              ['05','执行','权利如何转化为实际执行','execute'],
              ['06','实际到账 R','经可靠证据确认的现金回收','recovery']
            ].map(([i,t,q,k],idx) => `
              <div class="chain-node ${idx===0||idx===5?'hot':''}" data-chain="${k}" data-cursor="${idx===0||idx===5?'查看':'了解'}">
                <span class="idx">${i}</span>
                <span class="lbl">${t}<small>${q}</small></span>
                <span class="dot"></span>
              </div>`).join('')}
          </div>
          <div class="chain-foot"><span>L − PEU = 资产天花板</span><span>PEU − R = 兑现缺口</span></div>
        </div>
      </div>
    </div>
  </div>

  <div class="shell">
    <div class="stats-strip reveal">
      ${[
        [s.companies, '家', '退市公司主表', '含 4 只 B 股并列'],
        [s.companiesMain, '家', '纯 A 股主样本', '2022—2026'],
        [s.cases, '条', '唯一赔偿案件', 'v1 45 + v2 47 − 重复 21'],
        [s.sources, '条', '来源台账', '官方 / 媒体 / UGC 分级'],
        [s.recoveryEvents, '起', '已验证回收事件', 'KM 事件 · 47 右删失']
      ].map(([v,u,k,sub]) => `
        <div class="stat-item">
          <div class="k"><i></i>${k}</div>
          <div class="v num" data-count="${v}">${typeof v === 'number' ? v : v}<small>${u}</small></div>
          <div class="s">${sub}</div>
        </div>`).join('')}
    </div>
  </div>

  <div class="ticker" aria-label="实时行情与数据脉搏">
    <div class="ticker-label"><i></i>LIVE · 行情</div>
    <div class="ticker-track" id="tickerTrack">
      ${[...tickerItems, ...tickerItems].map(([k,v]) =>
        `<div class="ticker-item"><span>${k}</span><b>${v}</b></div>`).join('')}
    </div>
  </div>

  <section class="section">
    <div class="shell">
      ${sectionHead('01 / DELISTING STRUCTURE', '退市在提速，结构在换挡',
        '2022—2026 年 A 股退市从“财务类为主”走向“面值退潮”，再切换到“重大违法与主动退市并行”。家数按本研究规范化口径重算，2026 年为未完结年度。', '#/companies', '按年度筛选公司')}
      <div class="panel panel-pad reveal">
        <div class="panel-head">
          <div class="panel-title">年度退市结构 · 规范化分类</div>
          <div class="tag-row">
            <span class="badge">主口径 纯A股</span><span class="badge gold">2026 未完结</span>
          </div>
        </div>
        <div class="chart" id="chartYear"></div>
        <div class="chart-legend">
          ${[['交易类','#38F2FF'],['财务类','#5B7CFF'],['规范类','#A855F7'],['重大违法类','#FFCB6B'],['主动退市','#2DE2A8'],['重组退市','#818CF8'],['其他强制退市','#FB7185']]
            .map(([n,color]) => `<span class="legend-item"><i style="background:${color}"></i>${n}</span>`).join('')}
        </div>
      </div>
      <div class="year-grid">
        ${d.yearly.map(y => `
          <a class="year-card" href="#/companies?y=${y.year}" data-cursor="筛选">
            <div class="y">${y.year}</div>
            <div class="n num">${y.aShare}<small>家</small></div>
            <div class="bar"><i style="--w:${Math.round((y.aShare/yearMax)*100)}%"></i></div>
            <div class="t">${esc(y.state === '未完结（截至2026-11-14）' ? '未完结 · 截至 2026-11-14' : y.state)}</div>
          </a>`).join('')}
      </div>
      <div class="note mt-3">口径提示：2024 年面值退市 39 家为阶段性高点；2026 年财务类 13 家成为主通道。外部口径（Wind / 中上协 / iFinD）并列于数据库，不强行统一。</div>
    </div>
  </section>

  <section class="section">
    <div class="shell">
      ${sectionHead('02 / STATUS SPECTRUM', '“进入程序”不等于“钱已到账”',
        '71 条案件分布在从“仅征集”到“已实际赔付”的完整光谱上。每一个状态码都有严格定义，不把律师征集当成受理，也不把生效判决当成到账。', '#/cases', '打开案件库')}
      <div class="grid-2" style="grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);align-items:center">
        <div class="panel panel-pad reveal" style="padding:18px">
          <div class="panel-title" style="margin-bottom:6px">公司赔偿状态 · 203 家</div>
          <div class="chart" id="chartStatus"></div>
        </div>
        <div class="reveal">
          ${statusLegend()}
          <div class="note mt-2">点击任意状态可进入对应公司清单。${statusPill('A')} 表示有资金实际到账证据；${statusPill('B')} 仅表示裁判已形成，执行仍可能不完整。C、D 计数含复合状态 C/E 1 家、D/E 2 家。</div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="shell">
      ${sectionHead('03 / THREE ACCOUNTS', '三个账户，把“赔偿难”拆开',
        '损失 L 回答“理论上涉及多少”；PEU 回答“责任主体与可执行财产约束下最多能赔多少”；R 回答“最终真正到账多少”。两段差值，分别对应资产约束与程序损耗。', '#/chain', '进入兑现链透视')}
      <div class="formula">
        <div class="formula-card reveal">
          <div class="sym">L</div>
          <h3>损失暴露 · Loss Exposure</h3>
          <p>在当前证据框架下可识别的投资者损失或赔偿请求规模。它不等于判决金额，更不等于到账金额。</p>
          <div class="eq">L = Σ 可识别损失暴露</div>
        </div>
        <div class="formula-card p reveal">
          <div class="sym">PEU</div>
          <h3>赔偿可实现容量</h3>
          <p>在已识别责任主体与可执行责任财产约束下，客观上存在的赔偿实现空间。公司总资产 ≠ 责任财产。</p>
          <div class="eq">PEU = min(L, 可执行责任财产)</div>
        </div>
        <div class="formula-card r reveal">
          <div class="sym">R</div>
          <h3>实际到账 · Recovery</h3>
          <p>有可靠证据支持、能够确认已经发生的现金回收。生效判决、债权确认、律师招募均不等同于 R。</p>
          <div class="eq">R = Σ 已验证实际回收</div>
        </div>
      </div>
      <div class="grid-2 mt-3" style="align-items:start">
        <div class="panel panel-pad reveal">
          <div class="panel-title">缺口分解</div>
          <div class="prose mt-1">
            <p><b>L − PEU：资产天花板。</b>主要观察客观赔偿能力不足——责任财产本身就不够，再高效的程序也无法变出钱来。</p>
            <p><b>PEU − R：制度兑现缺口。</b>已有可实现空间却没有充分转化为真实到账，问题更可能出在程序组织、执行与信息披露。</p>
            <p class="warn mt-2">当前数据库的 PEU 字段仍为“待采集”：1,950 行责任财产骨架中，金额采集 0 条。本站如实展示这一缺口，而不以估算填充。</p>
          </div>
        </div>
        <div class="panel panel-pad reveal">
          <div class="panel-title">当前可计算性 · 就绪度</div>
          <div class="readiness mt-2" id="homeReadiness">
            ${[
              ['损失暴露金额', s.amountCoverage.withLoss, s.companies, 'warn'],
              ['责任财产金额', 0, 1950, 'zero'],
              ['PEU 可计算公司', 0, 199, 'zero'],
              ['已验证回收（正金额）', s.amountCoverage.withFinal, s.companies, 'warn']
            ].map(([label, a, b, cls]) => `
              <div class="readiness-item">
                <span class="lbl">${label}</span><span class="val">${a} / ${b}</span>
                <div class="readiness-bar ${cls}"><i data-w="${b?a/b:0}"></i></div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="shell">
      ${sectionHead('04 / PATH EFFECT', '八条路径，同一个终点',
        '不预设哪一种诉讼更优。先行赔付、特别代表人诉讼、示范判决、破产债权申报……比较的终点只有一个：实际到账。', '#/paths', '查看八条路径')}
      <div class="path-preview">
        ${d.paths.slice(0,4).map((p,i) => `
          <a class="path-mini reveal" href="#/paths" data-cursor="查看">
            <span class="pm-i">${String(i+1).padStart(2,'0')}</span>
            <h4>${esc(p.path)}</h4>
            <p>${esc(p.cases)}</p>
            <div class="pm-r">${esc(p.result)}</div>
          </a>`).join('')}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="shell">
      ${sectionHead('05 / PROVENANCE', '每一条结论，都能回到原件',
        '来源按权威性与可核验程度分为三级。低等级材料只作线索，不单独支撑金额与到账结论；每条记录保留观察截止日。', '#/sources', '打开来源台账')}
      <div class="grade-3">
        <div class="grade-card h reveal"><div class="g">高</div><h4>官方文书 / 法院公告 / 公司公告</h4><p>可作定量依据，优先采用。含证监会与派出机构处罚、交易所纪律处分、裁判文书、上市公司公告、投保基金公告。</p></div>
        <div class="grade-card m reveal"><div class="g">中</div><h4>权威媒体 / 投保机构披露</h4><p>交叉核对后补充时间线。含证券时报、证券日报、第一财经、澎湃、新华等对案件的报道。</p></div>
        <div class="grade-card l reveal"><div class="g">低</div><h4>律师征集 / 股吧 / 视频</h4><p>仅质性证据，不单独支撑金额。用于识别投资者信息不对称与程序体验，不指认具体公司。</p></div>
      </div>
      <div class="portal-grid mt-3">
        ${[
          ['证监会','行政处罚与监管要闻','GOV','http://www.csrc.gov.cn/'],
          ['巨潮资讯','上市公司公告全文','DISCLOSURE','http://www.cninfo.com.cn/'],
          ['上交所','终止上市与纪律处分','EXCHANGE','https://www.sse.com.cn/'],
          ['深交所','退市与纪律处分','EXCHANGE','https://www.szse.cn/'],
          ['中国裁判文书网','裁判文书公开','JUDICIAL','https://wenshu.court.gov.cn/'],
          ['破产重整案件信息网','破产与重整公告','JUDICIAL','https://pccz.court.gov.cn/'],
          ['投保基金','先行赔付基金','INVESTOR','https://www.sipf.com.cn/'],
          ['中证投服中心','代表人诉讼与支持诉讼','INVESTOR','http://www.isc.com.cn/']
        ].map(([n,d,t,u]) => `<a class="portal reveal" href="${u}" target="_blank" rel="noopener noreferrer" data-cursor="跳转">
          <div class="top"><h4>${n}</h4><span class="tag">${t}</span></div><p>${d}</p><span class="u">${u.replace(/^https?:\/\//,'')}</span></a>`).join('')}
      </div>
    </div>
  </section>

  <section class="section" style="padding-bottom:120px">
    <div class="shell">
      <div class="cta reveal">
        <div class="cta-glow"></div>
        <div class="eyebrow">START HERE</div>
        <h2>先查公司，再看案件，最后看缺口。</h2>
        <p>输入任意一家退市公司的代码，得到它的退市类型、赔偿状态、关联案件、责任主体、时间轴与全部可核查来源。</p>
        <div class="hero-actions" style="justify-content:center">
          <a class="btn btn-primary magnetic" href="#/companies" data-cursor="进入">开始查询</a>
          <a class="btn btn-ghost magnetic" href="#/survival" data-cursor="了解">看首次回收要等多久</a>
        </div>
      </div>
    </div>
  </section>`;
}

function iconSearch(){
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>`;
}

/* ============================================================
   COMPANIES
   ============================================================ */
export function renderCompanies(params){
  const d = db(); const s = d.stats;
  const years = [...new Set(d.companies.map(c => c.year))].sort();
  const boards = [...new Set(d.companies.map(c => c.board))].sort();
  const cats = [...new Set(d.companies.map(c => c.category))].filter(Boolean).sort();
  const y = params.get('y') || 'all';
  const b = params.get('b') || 'all';
  const c = params.get('c') || 'all';
  const st = params.get('s') || 'all';
  const q = params.get('q') || '';

  return `<section class="section" style="padding-top:44px">
    <div class="shell">
      ${sectionHead('DATABASE 01', '退市公司全景库',
        `${s.companies} 行公司主表，其中 ${s.companiesMain} 家纯 A 股主样本、4 只 B 股并列。可按年度、板块、退市类型与赔偿状态交叉筛选，点击任意行进入赔偿档案。`, null)}
      <div class="toolbar reveal">
        <div class="field grow">
          ${iconSearch()}
          <input id="coSearch" type="text" placeholder="搜索代码 / 简称 / 违法事实关键词" value="${esc(q)}" autocomplete="off">
        </div>
        <div class="field" style="padding-right:6px">
          <select id="coSort" aria-label="排序方式">
            <option value="year-desc">年度 ↓ 最新</option>
            <option value="year-asc">年度 ↑ 最早</option>
            <option value="code">代码 A→Z</option>
            <option value="complete">字段完整度 ↓</option>
            <option value="recovery">已验证回收 ↓</option>
          </select>
          <svg class="caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div class="toolbar-right">
          <span class="result-count">命中 <b id="coCount">0</b> / ${s.companies}</span>
          <button class="btn btn-ghost btn-sm" id="coExport">导出 CSV</button>
        </div>
      </div>

      <div class="chip-row filter-scroll reveal" id="yearChips">
        <button class="chip ${y==='all'?'on':''}" data-y="all">全部年度 <b>${s.companies}</b></button>
        ${years.map(yy => {
          const n = d.companies.filter(x => x.year === yy).length;
          return `<button class="chip ${String(y)===String(yy)?'on':''}" data-y="${yy}">${yy} <b>${n}</b></button>`;
        }).join('')}
      </div>
      <div class="chip-row filter-scroll reveal mt-1" id="catChips">
        <button class="chip ${c==='all'?'on':''}" data-c="all">全部退市类型</button>
        ${cats.map(cc => `<button class="chip ${c===cc?'on':''}" data-c="${esc(cc)}">${esc(cc)}</button>`).join('')}
        <span style="width:8px"></span>
        <select class="filter-select" id="boardSelect" aria-label="交易所板块">
          <option value="all">全部板块</option>
          ${boards.map(bb => `<option value="${esc(bb)}" ${b===bb?'selected':''}>${esc(bb)}</option>`).join('')}
        </select>
        <select class="filter-select" id="statusSelect" aria-label="赔偿状态">
          <option value="all">全部赔偿状态</option>
          ${Object.entries(d.statusDict).map(([k,m]) => `<option value="${k}" ${st===k?'selected':''}>${k} · ${m.label}</option>`).join('')}
        </select>
        <button class="chip" id="coReset" style="margin-left:auto">重置筛选</button>
      </div>

      <div class="table-wrap reveal mt-2">
        <div class="table-scroll">
          <table class="data" id="coTable">
            <thead><tr>
              <th>证券代码 / 简称</th><th>年度</th><th>交易所 / 板块</th><th>退市类型</th>
              <th>摘牌日</th><th>赔偿状态</th><th>救济路径</th><th>关联案件</th><th>完整度</th>
            </tr></thead>
            <tbody id="coBody"></tbody>
          </table>
        </div>
        <div class="table-foot" id="coFoot"></div>
      </div>
      <div class="note mt-2">完整度 = 该行关键字段的填充比例，越高代表可核验信息越完整；空白字段在详情页统一显示为“— / 待核实”，不以 0 或推测替代。</div>
    </div>
  </section>`;
}

/* ============================================================
   COMPANY DETAIL
   ============================================================ */
export function renderCompany(id){
  const d = db();
  const c = d.companies.find(x => x.id === id || x.code === id);
  if (!c) return `<section class="section"><div class="shell">${emptyState('未找到该公司记录。')}<a class="btn btn-ghost mt-2" href="#/companies">返回公司库</a></div></section>`;
  const cases = c.cases.map(cid => d.cases.find(x => x.id === cid)).filter(Boolean);
  const parties = d.parties.filter(p => p.companyId === c.id || (c.caseId && p.caseId === c.caseId));
  const events = d.events.filter(e => e.companyId === c.id || e.code === c.code);
  const m = statusMeta(c.status);
  const stages = companyStages(c);
  const ex = exchLink(c.code);
  const completeness = c.completeness === null ? null : Math.round((c.completeness || 0) * 100);

  return `
  <div class="detail-hero">
    <div class="shell">
      <div class="crumb">
        <a href="#/companies">退市公司库</a><i>/</i><span>${esc(c.year)}</span><i>/</i><span>${esc(c.code)}</span>
      </div>
      <div class="detail-title-row">
        <h1>${esc(splitName(c.name).main)}${splitName(c.name).alias ? `<em>${esc(splitName(c.name).alias)}</em>` : ''}</h1>
        <div class="detail-code">${esc(c.code)}</div>
      </div>
      <div class="detail-badges">
        ${statusPill(c.status, {long:true})}
        <span class="badge ${c.tier === '纯A股主样本' ? 'cyan' : ''}">${esc(c.tier)}</span>
        <span class="badge">${esc(c.board)}</span>
        <span class="badge">${esc(c.category)} · ${esc(c.subtype)}</span>
        <span class="badge gold">摘牌 ${esc(shortDate(c.delistDate || c.delistDateExact))}</span>
      </div>
      <p class="detail-sub">${esc(c.fact || '数据库未记录退市事实摘要。')}</p>
    </div>
  </div>

  <section class="section" style="padding-top:34px">
    <div class="shell">
      <div class="grid-2" style="grid-template-columns:1.55fr .85fr;align-items:start">
        <div>
          <div class="panel panel-pad reveal">
            <div class="panel-head"><div class="panel-title">赔偿兑现进度</div>
              <span class="badge" style="color:${m.color};border-color:${m.color}44">状态 ${esc(c.status)} · ${esc(m.label)}</span></div>
            <div class="steps">
              ${stages.map(s => `<div class="step ${s.done?'done':''} ${s.now?'now':''} ${!s.done&&!s.now?'inactive':''}">
                <span class="pt"><i></i></span><span>${s.t}</span></div>`).join('')}
            </div>
            <div class="note mt-3">“裁决/调解”与“实际到账”分开记录：即使已有生效判决，只要没有可靠到账证据，R 仍保持为空。${c.bankruptcy ? `当前破产/重整状态：${esc(c.bankruptcy)}。` : ''}</div>
          </div>

          <div class="panel panel-pad mt-2 reveal">
            <div class="panel-title">退市与处罚</div>
            <div class="kv mt-1">
              ${kvRow('退市大类', c.category)}
              ${kvRow('退市细类', c.subtype)}
              ${kvRow('交易类细分', c.tradeSub || '—')}
              ${kvRow('是否强制退市', c.mandatory)}
              ${kvRow('摘牌日（精确）', c.delistDateExact || c.delistDate)}
              ${kvRow('处罚状态', c.penaltyStatus)}
              ${kvRow('处罚机关 / 文号 / 日期', c.penaltyAuthority)}
              ${kvRow('处罚日（精确）', c.penaltyDate || '—')}
              ${kvRow('适格投资者数', c.investors || '—')}
              ${kvRow('数据截止日', c.asOf)}
            </div>
            ${c.fact ? `<hr class="hr"><div class="prose"><b>主要违法或退市事实</b><br>${esc(c.fact)}</div>` : ''}
            ${c.note ? `<div class="note mt-2">${esc(c.note)}</div>` : ''}
          </div>

          <div class="panel panel-pad mt-2 reveal">
            <div class="panel-head"><div class="panel-title">救济时间轴</div><span class="badge">${events.length} 条事件</span></div>
            ${events.length ? `<div class="tl">${events.sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(e => `
              <div class="tl-item">
                <div class="d">${esc(eventDate(e))} · ${esc(e.precision || '')}</div>
                <div class="t">${esc(e.type)}</div>
                <div class="m">${esc(e.meaning || '')}${e.source ? ` · 来源：${esc(e.source)}` : ''}</div>
              </div>`).join('')}</div>`
              : `<div class="empty">该案暂无结构化事件记录；时间轴仍在逐案补录中。</div>`}
          </div>

          <div class="panel panel-pad mt-2 reveal">
            <div class="panel-title">数据完整度</div>
            <div class="readiness mt-2">
              <div class="readiness-item"><span class="lbl">关键字段填充</span><span class="val">${completeness===null?'—':completeness+'%'}</span>
                <div class="readiness-bar ${completeness>70?'':completeness>40?'warn':'zero'}"><i data-w="${(completeness||0)/100}"></i></div></div>
            </div>
            <div class="kv mt-1">
              ${kvRow('主要来源', c.source || '—')}
              ${kvRow('PEU 准备状态', c.peuStatus || '—')}
            </div>
          </div>
        </div>

        <div>
          <div class="panel panel-pad reveal" style="border-color:${m.color}33">
            <div class="panel-title">赔偿结果</div>
            <div class="metric-stack">
              ${metric('投资者损失暴露 L', c.loss || '待核实', '原始口径')}
              ${metric('诉争 / 请求金额', c.claim || '待核实', '原始口径')}
              ${metric('法院 / 调解确认金额', c.award || '待核实', '原始口径')}
              ${metric('最终已验证实际回收 R', c.recoveryN ? fmtMoney(c.recoveryN) + '元' : (c.recovery || '待核实'), '经证据确认')}
              ${metric('首次已验证支付', c.firstPayN ? fmtMoney(c.firstPayN) + '元' : (c.firstPay || '—'), c.firstDatePrecision || '')}
            </div>
            <div class="note mt-2">${esc(c.recoveryBasis || '回收口径以数据库 04/06 表为准。')}</div>
          </div>

          <div class="panel panel-pad mt-2 reveal">
            <div class="panel-title">关联赔偿案件</div>
            ${cases.length ? cases.map(cs => `
              <a class="mini-case" href="#/case/${encodeURIComponent(cs.id)}" data-cursor="打开">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
                  <b>${esc(cs.id)}</b>${statusPill(cs.status)}
                </div>
                <p>${esc(cs.path || '路径未记录')}</p>
                <small>${esc(cs.court || '—')} · ${esc(cs.docNo || '文书待补')}</small>
              </a>`).join('')
              : `<div class="empty">未关联到案件库记录（${esc(c.statusNote || c.status)}）。</div>`}
          </div>

          <div class="panel panel-pad mt-2 reveal">
            <div class="panel-head"><div class="panel-title">责任主体</div><span class="badge">${parties.length}</span></div>
            ${parties.length ? parties.map(p => `
              <div class="party">
                <div class="party-head"><b>${esc(p.summary ? '责任结构' : '责任主体')}</b><span class="badge">清晰度 ${p.clarity===null?'—':p.clarity}/3</span></div>
                <div class="tag-row mt-1">
                  ${p.issuer && p.issuer!=='0' ? `<span class="badge cyan">发行人</span>` : ''}
                  ${p.controller && p.controller!=='0' ? `<span class="badge cyan">实控人/控股股东</span>` : ''}
                  ${p.executives && p.executives!=='0' ? `<span class="badge">董监高</span>` : ''}
                  ${p.underwriter && p.underwriter!=='0' ? `<span class="badge gold">保荐/承销</span>` : ''}
                  ${p.accountant && p.accountant!=='0' ? `<span class="badge gold">会计师</span>` : ''}
                  ${p.lawyer && p.lawyer!=='0' ? `<span class="badge gold">律师</span>` : ''}
                  ${p.other && p.other!=='0' ? `<span class="badge">其他第三方</span>` : ''}
                </div>
                <p class="prose small mt-1">${esc(p.summary)}</p>
              </div>`).join('')
              : `<div class="empty">该案责任主体仍待逐案核验。</div>`}
          </div>
        </div>
      </div>

      <div class="panel panel-pad mt-3 reveal">
        <div class="panel-head"><div class="panel-title">外部核查入口</div><span class="badge">新窗口打开 · 官方/公开站点</span></div>
        ${extGrid(c.code, c.name)}
        <div class="note mt-2">本站只做结构化引用与跳转，不镜像第三方受版权或授权限制的数据。核查时请以${esc(ex.k)}、巨潮资讯原始公告与法院文书为准。</div>
      </div>

      <div class="detail-nav">
        <a class="btn btn-ghost btn-sm" href="#/companies">← 返回公司库</a>
        ${cases[0] ? `<a class="btn btn-ghost btn-sm" href="#/case/${encodeURIComponent(cases[0].id)}">查看关联案件 →</a>` : ''}
        <a class="btn btn-ghost btn-sm" href="#/chain">兑现链方法论</a>
      </div>
    </div>
  </section>`;
}

function companyStages(c){
  const s = statusBase(c.status);
  const hasPenalty = !!c.penaltyDate || (c.penaltyStatus && !/^无|—$/.test(c.penaltyStatus));
  let done = [true, false, false, false, false, false];
  let now = -1;
  if (hasPenalty) done[1] = true;
  if (s === 'A'){ done = [true,true,true,true,true,true]; now = 5; }
  else if (s === 'B'){ done = [true,true,true,true,false,false]; now = 4; }
  else if (s === 'C'){ done = [true,true,true,false,false,false]; now = 3; }
  else if (s === 'D'){ done = [true,hasPenalty,false,false,false,false]; now = 2; }
  else if (s === 'E'){ done = [true,hasPenalty,true,false,true,false]; now = 4; }
  else if (s === 'F'){ done = [true,hasPenalty,true,false,false,false]; now = 2; }
  else if (s === 'R'){ done = [true,false,false,false,false,false]; now = -1; }
  else { done = [true,hasPenalty,false,false,false,false]; now = -1; }
  return ['退市摘牌','行政处罚','救济启动','裁判 / 调解','执行程序','实际到账'].map((t,i) => ({ t, done: done[i], now: i === now }));
}
function kvRow(k, v){
  return `<div class="row"><span class="k">${esc(k)}</span><span class="v">${safe(v)}</span></div>`;
}
function clip(s, n){
  const t = String(s || '');
  return t.length > n ? t.slice(0, n).replace(/[，,、；;：:（(]$/,'') + '…' : t;
}
function eventDate(e){
  if (e.date) return shortDate(e.date);
  if (e.lower || e.upper) return `${shortDate(e.lower) || '?'} ~ ${shortDate(e.upper) || '?'}`;
  return '日期待核';
}
function splitName(n){
  const m = String(n || '').match(/^([^（(]+)[（(](.+?)[）)]\s*$/);
  return m ? { main: m[1].trim(), alias: m[2].trim() } : { main: n, alias: '' };
}
function metric(k, v, sub){
  return `<div class="metric"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>${sub?`<div class="s">${esc(sub)}</div>`:''}</div>`;
}

/* ============================================================
   CASES
   ============================================================ */
export function renderCases(params){
  const d = db(); const s = d.stats;
  const st = params.get('s') || 'all';
  const q = params.get('q') || '';
  const counts = {};
  for (const c of d.cases){ const b = statusBase(c.status); counts[b] = (counts[b]||0)+1; }

  return `<section class="section" style="padding-top:44px">
    <div class="shell">
      ${sectionHead('DATABASE 02', '赔偿案件主表',
        `${s.cases} 条唯一案件：v1 45 条 + v2 47 条 − 重复 21 条。v1-only 记录保留 2024-01-01 观察截止日，不冒充 2026 年进展。`, null)}
      <div class="toolbar reveal">
        <div class="field grow">${iconSearch()}
          <input id="caseSearch" type="text" placeholder="搜索公司 / Case ID / 案号 / 法院" value="${esc(q)}" autocomplete="off">
        </div>
        <div class="toolbar-right"><span class="result-count">命中 <b id="caseCount">0</b> / ${s.cases}</span></div>
      </div>
      <div class="chip-row filter-scroll reveal" id="caseChips">
        <button class="chip ${st==='all'?'on':''}" data-s="all">全部状态 <b>${s.cases}</b></button>
        ${Object.entries(d.statusDict).map(([k,m]) => counts[k] ? `<button class="chip ${st===k?'on':''}" data-s="${k}">
          <span style="color:${m.color}">${k}</span> ${m.short} <b>${counts[k]}</b></button>` : '').join('')}
      </div>
      <div class="case-grid mt-2" id="caseGrid"></div>
      <div class="note mt-3">状态码严格区分：D 仅代表律师征集/材料递交，不等于法院受理；B 代表生效裁判或调解，不等于全额到账；A 代表已有资金到账证据，但不必然覆盖全部适格投资者。</div>
    </div>
  </section>`;
}

/* ============================================================
   CASE DETAIL
   ============================================================ */
export function renderCase(id){
  const d = db();
  const c = d.cases.find(x => x.id === id);
  if (!c) return `<section class="section"><div class="shell">${emptyState('未找到该案件。')}<a class="btn btn-ghost mt-2" href="#/cases">返回案件库</a></div></section>`;
  const co = d.companies.find(x => x.id === c.companyId) || d.companies.find(x => x.code === c.code);
  const parties = d.parties.filter(p => p.caseId === c.id);
  const events = d.events.filter(e => e.caseId === c.id).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const sv = d.survival.find(s => s.caseId === c.id);

  return `
  <div class="detail-hero">
    <div class="shell">
      <div class="crumb"><a href="#/cases">赔偿案件</a><i>/</i><span>${esc(c.id)}</span></div>
      <div class="detail-title-row">
        <h1 style="font-size:clamp(28px,3.6vw,46px)">${esc(c.name)}</h1>
        <div class="detail-code">${esc(c.id)}</div>
      </div>
      <div class="detail-badges">
        ${statusPill(c.status, {long:true})}
        ${c.tier ? `<span class="badge ${/主样本/.test(c.tier)?'cyan':''}">${esc(c.tier)}</span>` : ''}
        <span class="badge">数据版本 ${esc(c.version || '—')}</span>
        <span class="badge gold">观察截止 ${esc(c.asOf || '—')}</span>
      </div>
      <p class="detail-sub">${esc(c.path || '救济路径未记录')}</p>
    </div>
  </div>

  <section class="section" style="padding-top:32px">
    <div class="shell">
      <div class="metric-row">
        ${metric('诉争金额', c.claim || '—', '原始口径')}
        ${metric('判赔 / 赔付金额', c.award || '—', '原始口径')}
        ${metric('适格 / 涉案人数', c.parties || '—', '以官方公告为准')}
        ${metric('赔付完成度', c.completion || '—', '按人数/金额分别判断')}
      </div>

      <div class="grid-2 mt-3" style="grid-template-columns:1.5fr .9fr;align-items:start">
        <div>
          <div class="panel panel-pad reveal">
            <div class="panel-title">案件概览</div>
            <div class="kv mt-1">
              ${kvRow('行政处罚 / 处理', c.penalty)}
              ${kvRow('受理法院', c.court)}
              ${kvRow('案号 / 文书', c.docNo)}
              ${kvRow('索赔区间（权利人范围）', c.scope)}
              ${kvRow('责任分担', c.liability)}
              ${kvRow('时间周期', c.duration)}
              ${kvRow('执行 / 到账情况', c.execution)}
              ${kvRow('是否计入主样本比较', c.inComparison)}
            </div>
          </div>

          <div class="panel panel-pad mt-2 reveal">
            <div class="panel-head"><div class="panel-title">案件时间轴</div><span class="badge">${events.length} 条</span></div>
            ${events.length ? `<div class="tl">${events.map(e => `
              <div class="tl-item"><div class="d">${esc(eventDate(e))} · ${esc(e.precision)}</div>
              <div class="t">${esc(e.type)}</div><div class="m">${esc(e.meaning)}${e.source ? ' · '+esc(e.source) : ''}</div></div>`).join('')}</div>`
              : `<div class="empty">该案时间事件仍在补录。</div>`}
            ${sv ? `<div class="note mt-2">生存分析：起算 ${esc(sv.start)}（${esc(sv.startBasis)}）；${sv.event ? '已发生首次回收事件' : '截至观察日右删失'}；保守持续 ${sv.daysCons ?? '—'} 天。</div>` : ''}
          </div>
        </div>

        <div>
          <div class="panel panel-pad reveal">
            <div class="panel-head"><div class="panel-title">责任主体</div><span class="badge">${parties.length}</span></div>
            ${parties.length ? parties.map(p => `
              <div class="party">
                <div class="party-head"><b>责任清晰度 ${p.clarity===null?'—':p.clarity}/3</b>
                  <span class="badge">${p.issuer==='1'?'发行人担责': p.issuer==='0'?'发行人未列':''}</span></div>
                <p class="prose small mt-1">${esc(p.summary)}</p>
                ${p.source ? `<div class="note mt-1">来源：${esc(p.source)}</div>` : ''}
              </div>`).join('')
              : `<div class="empty">责任主体结构待核验。</div>`}
          </div>

          <div class="panel panel-pad mt-2 reveal">
            <div class="panel-title">来源与核查</div>
            <div class="prose small mt-1">${esc(c.source || '来源待补充')}</div>
            ${c.note ? `<div class="note mt-2">${esc(c.note)}</div>` : ''}
            ${co ? `<a class="btn btn-ghost btn-sm mt-2" href="#/company/${encodeURIComponent(co.id)}" data-cursor="打开">查看公司档案 ${esc(co.name)} →</a>` : ''}
          </div>

          <div class="panel panel-pad mt-2 reveal">
            <div class="panel-title">外部核查入口</div>
            <div class="src-grid mt-1">
              ${extLinks(c.code, c.name).slice(0,6).map(l => `<a class="src-link" href="${l.u}" target="_blank" rel="noopener noreferrer" data-cursor="核查">
                <span class="dot"></span><span>${esc(l.k)}<small>${esc(l.s)}</small></span></a>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="detail-nav">
        <a class="btn btn-ghost btn-sm" href="#/cases">← 返回案件库</a>
        ${co ? `<a class="btn btn-ghost btn-sm" href="#/company/${encodeURIComponent(co.id)}">公司档案 →</a>` : ''}
      </div>
    </div>
  </section>`;
}

/* ============================================================
   CHAIN
   ============================================================ */
export function renderChain(){
  const d = db(); const s = d.stats;
  const recoveries = d.companies.filter(c => c.recoveryN > 0);
  const gaps = d.dashboard.filter(x => /Research gap/i.test(x.metric));
  return `<section class="section" style="padding-top:44px">
    <div class="shell">
      ${sectionHead('METHOD · 核心框架', '兑现链：一笔损失要过六道关',
        '项目不比较“哪种诉讼更好”，而比较“同样进入赔偿过程，为什么到账结果不同”。把 L、PEU、R 三个量分开，是把“赔不起”与“没赔到”分开的前提。', null)}
      <div class="flow-diagram reveal">
        ${[['01','损失 L','发生了多少损失？'],['02','责任主体','向谁追偿？'],['03','责任财产','从什么财产中实现？'],['04','救济程序','通过什么程序取得权利？'],['05','执行','权利如何转化为执行？'],['06','到账 R','最后真正回收多少？']]
          .map(([n,t,q],i) => `<div class="flow-step ${i===0||i===5?'hl':''}"><div class="n">${n}</div><div class="t">${t}</div><div class="q">${q}</div></div>`).join('')}
      </div>

      <div class="formula mt-3">
        <div class="formula-card reveal"><div class="sym">L</div><h3>损失暴露</h3><p>证据框架下可识别的损失或请求规模。不是判决金额，也不是到账金额。</p><div class="eq">L = Σ 可识别损失暴露</div></div>
        <div class="formula-card p reveal"><div class="sym">PEU</div><h3>赔偿可实现容量</h3><p>在责任主体与可执行财产约束下的客观实现空间。公司总资产 ≠ 责任财产。</p><div class="eq">PEU = min(L, Σ 经核验可执行贡献)</div></div>
        <div class="formula-card r reveal"><div class="sym">R</div><h3>实际到账</h3><p>经可靠证据确认的现金回收。判决、调解、债权确认都只是中间节点。</p><div class="eq">缺口 = PEU − R</div></div>
      </div>

      <div class="grid-2 mt-3" style="align-items:start">
        <div class="panel panel-pad reveal">
          <div class="panel-title">数据就绪度 · 真实进度</div>
          <p class="prose small mt-1">截至 2026-11-14，PEU 仍未进入可计算阶段：责任财产 1,950 行骨架中金额采集为 0。项目选择如实展示断点，而不是用估值制造一个看似完整的数字。</p>
          <div class="readiness mt-2">
            ${[
              ['公司主表', s.companies, s.companies, ''],
              ['唯一赔偿案件', s.cases, s.cases, ''],
              ['责任财产明细行', 1950, 1950, ''],
              ['责任财产金额已采集', 0, 1950, 'zero'],
              ['PEU 可计算公司', 0, s.companiesMain, 'zero'],
              ['实际回收金额已核验', s.recoveryKnown, s.companies, 'warn'],
              ['精确首次回收日期', 1, s.survival, 'zero']
            ].map(([label,a,b,cls]) => `
              <div class="readiness-item"><span class="lbl">${label}</span><span class="val">${a} / ${b}</span>
                <div class="readiness-bar ${cls}"><i data-w="${b?a/b:0}"></i></div></div>`).join('')}
          </div>
        </div>
        <div class="panel panel-pad reveal">
          <div class="panel-title">四个研究断点</div>
          <div class="gap-list mt-1">
            ${gaps.map(g => { const n = (g.metric.match(/(\d+)/) || [,''])[1];
              return `<div class="gap-item"><span class="badge red">GAP ${esc(n)}</span><div><b>研究断点 ${esc(n)}</b><p>${esc(g.note)}</p></div></div>`; }).join('')}
          </div>
        </div>
      </div>

      <div class="panel panel-pad mt-3 reveal">
        <div class="panel-head">
          <div class="panel-title">已验证实际回收 · 仅列有可靠金额证据的个案</div>
          <span class="badge green">${recoveries.length} 家</span>
        </div>
        <div class="chart chart-sm" id="chartRecovery"></div>
        <div class="note mt-1">金额为项目数据库“最终已验证实际回收_CNY”字段，均已回链公司公告或监管典型案例。样本极少，仅作个案观察，不代表全市场兑现率。</div>
      </div>

      <div class="panel panel-pad mt-2 reveal">
        <div class="panel-title">为什么不能直接拿“总资产”算 PEU</div>
        <div class="grid-3 mt-2">
          ${[
            ['权属','资产是否属于可追偿范围；被查封、质押或已转移的资产贡献有限。'],
            ['优先受偿','担保债权、职工债权、税款等顺位在前，普通证券赔偿债权可能排在后面。'],
            ['变现条件','账面价值不等于可执行现金；折价、周期与流动性决定最终贡献。']
          ].map(([t,p]) => `<div><h4 style="font-size:14px;margin-bottom:6px">${t}</h4><p class="prose small">${p}</p></div>`).join('')}
        </div>
      </div>
    </div>
  </section>`;
}

/* ============================================================
   PATHS
   ============================================================ */
export function renderPaths(){
  const d = db();
  return `<section class="section" style="padding-top:44px">
    <div class="shell">
      ${sectionHead('ANALYSIS · 路径实效', '八条救济路径的“到账结果”对照',
        '同一组案件，按救济路径分组比较覆盖广度、回款深度、兑现周期与执行到位。项目不预设路径优劣，只记录实际结果与约束条件。', null)}
      <div class="path-list">
        ${d.paths.map((p,i) => `
          <div class="path-card reveal" data-path>
            <div class="path-card-head" data-cursor="展开">
              <div style="display:flex;align-items:center"><span class="idx">${String(i+1).padStart(2,'0')}</span><h3>${esc(p.path)}</h3></div>
              <span class="plus"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span>
            </div>
            <div class="path-card-body"><div class="path-card-inner">
              <div class="path-field wide"><div class="k">代表案例</div><div class="v">${esc(p.cases)}</div></div>
              <div class="path-field"><div class="k">样本层级</div><div class="v">${esc(p.tier)}</div></div>
              <div class="path-field"><div class="k">规模与金额</div><div class="v">${esc(p.scale)}</div></div>
              <div class="path-field"><div class="k">周期</div><div class="v">${esc(p.cycle)}</div></div>
              <div class="path-field"><div class="k">实际获赔 / 结果</div><div class="v">${esc(p.result)}</div></div>
              <div class="path-field"><div class="k">核心实效变量</div><div class="v">${esc(p.variables)}</div></div>
              <div class="path-field"><div class="k">适用条件 / 局限</div><div class="v">${esc(p.limits)}</div></div>
              <div class="path-field wide"><div class="k">证据基准</div><div class="v">${esc(p.evidence)}${p.note?` · ${esc(p.note)}`:''}</div></div>
            </div></div>
          </div>`).join('')}
      </div>
      <div class="note mt-3">“高覆盖”与“执行难”可以同时存在：先行赔付与特别代表人诉讼在覆盖面上表现突出，但依赖责任主体出资能力与责任财产；破产债权申报即便确认债权，普通债权首次分配仍可能零清偿。</div>
    </div>
  </section>`;
}

/* ============================================================
   SURVIVAL
   ============================================================ */
export function renderSurvival(){
  const d = db(); const km = d.km;
  const maxDays = km.maxDays || 0;
  const rows = d.survival.filter(s => s.kmUsable === '是').sort((a,b) => (b.daysCons||0)-(a.daysCons||0));
  return `<section class="section" style="padding-top:44px">
    <div class="shell">
      ${sectionHead('ANALYSIS · 时间维度', '从处罚到首次回收，要等多久？',
        '以行政处罚日为主要起算原点，把“首次经权威证据确认的现金回收”作为事件，尚未发生的案件作右删失处理。事件稀疏，结果仅作描述性、探索性分析。', null)}
      <div class="metric-row four">
        ${metric('可做 KM 的案件', String(km.n), '有精确处罚日')}
        ${metric('回收事件', String(km.events), '已发生首次回收')}
        ${metric('右删失', String(km.censored), '截至观察日未观察到')}
        ${metric('中位回款时间', km.medianReached ? '已达到' : '未达到', '事件稀疏，不作推断')}
      </div>

      <div class="grid-2 mt-3" style="grid-template-columns:1.25fr .75fr;align-items:start">
        <div class="panel panel-pad reveal">
          <div class="panel-head"><div class="panel-title">Kaplan–Meier 生存曲线 · 描述性</div><span class="badge gold">保守口径</span></div>
          <div class="chart chart-lg" id="chartKM"></div>
          <div class="note mt-1">阶梯下降代表发生首次回收事件；曲线尾部未触及 50% 中位线，说明在现有观察窗口内，中位回款时间尚未出现。47 条右删失不能被当作“最终失败”。</div>
        </div>
        <div class="panel panel-pad reveal">
          <div class="panel-title">观察窗口</div>
          <div class="kv mt-1">
            ${kvRow('起算依据', '行政处罚日期')}
            ${kvRow('最长观察天数', maxDays + ' 天')}
            ${kvRow('约合月数', (maxDays/30.44).toFixed(1) + ' 个月')}
            ${kvRow('事件定义', '首次可验证现金回收')}
            ${kvRow('删失定义', '截至观察日未观察到')}
            ${kvRow('统计边界', '不作因果 / 路径排名')}
          </div>
          <div class="note mt-2">生存分析的价值不在于给出一个漂亮的中位数，而在于把“尚未发生”与“最终不会发生”分开——这是退市赔偿研究里最容易被混淆的两件事。</div>
        </div>
      </div>

      <div class="panel panel-pad mt-3 reveal">
        <div class="panel-head"><div class="panel-title">57 条救济时间轴事件</div><span class="badge">按事件发生年份</span></div>
        <div class="chart chart-sm" id="chartEvents"></div>
      </div>

      <div class="panel mt-3 reveal">
        <div class="panel-head panel-pad" style="margin:0;padding-bottom:0"><div class="panel-title">生存分析输入明细 · ${rows.length} 条</div><span class="badge">按保守持续天数降序</span></div>
        <div class="table-scroll" style="max-height:520px">
          <table class="data" style="min-width:820px">
            <thead><tr><th>公司</th><th>路径</th><th>起算日</th><th>事件</th><th>保守天数</th><th>删失原因</th></tr></thead>
            <tbody>
              ${rows.map(s => `<tr>
                <td><span class="name">${esc(s.name)}</span><span class="code">${esc(s.code)}</span></td>
                <td>${esc(s.path)}</td>
                <td class="date">${esc(shortDate(s.start))}</td>
                <td>${s.event ? '<span class="badge green">已回收</span>' : '<span class="badge">右删失</span>'}</td>
                <td class="num">${s.daysCons ?? '—'}</td>
                <td class="small">${esc(s.censorReason || '—')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>`;
}

/* ============================================================
   REGULATIONS
   ============================================================ */
export function renderRegulations(params){
  const d = db();
  const q = params.get('q') || '';
  const levels = [...new Set(d.regs.map(r => r.level))];
  return `<section class="section" style="padding-top:44px">
    <div class="shell">
      ${sectionHead('LIBRARY · 法规政策', '制度在变，兑现链的规则也在变',
        '24 条与退市及投资者赔偿直接相关的法规、司法解释与监管文件，保留官方来源链接与口径备注。', null)}
      <div class="toolbar reveal">
        <div class="field grow">${iconSearch()}
          <input id="regSearch" type="text" placeholder="搜索法规名称、文号、核心内容" value="${esc(q)}" autocomplete="off">
        </div>
        <div class="toolbar-right"><span class="result-count">命中 <b id="regCount">${d.regs.length}</b> / ${d.regs.length}</span></div>
      </div>
      <div class="chip-row filter-scroll reveal" id="regChips">
        <button class="chip on" data-l="all">全部层级</button>
        ${levels.map(l => `<button class="chip" data-l="${esc(l)}">${esc(l)}</button>`).join('')}
      </div>
      <div class="reg-list mt-2" id="regList">
        ${d.regs.map(r => `<details class="reg-item" data-l="${esc(r.level)}" data-hay="${esc((r.name+' '+(r.issuer||'')+' '+(r.content||'')).toLowerCase())}">
          <summary>
            <span class="lvl">${esc(r.level)}</span>
            <span class="nm">${esc(r.name)}<small>${esc(r.issuer || '')}</small></span>
            <span class="dt">${esc(r.date || '')}</span>
          </summary>
          <div class="reg-body">
            <p>${esc(r.content || '核心内容待补。')}</p>
            ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
            <div class="tag-row mt-2">
              ${r.url ? `<a class="btn btn-ghost btn-sm" href="${r.url}" target="_blank" rel="noopener noreferrer" data-cursor="原文">官方原文 ↗</a>` : '<span class="badge red">原文链接待补</span>'}
              <span class="badge">${esc(r.nature || '—')}</span>
              <span class="badge">${esc(r.version || '')}</span>
            </div>
          </div>
        </details>`).join('')}
      </div>
    </div>
  </section>`;
}

/* ============================================================
   SOURCES
   ============================================================ */
export function renderSources(params){
  const d = db();
  const q = params.get('q') || '';
  const portals = [
    ['中国证监会','行政处罚决定、监管要闻、新闻发布会','GOV','http://www.csrc.gov.cn/','退市与处罚的第一手依据'],
    ['上海证券交易所','终止上市决定、纪律处分、公告','EXCHANGE','https://www.sse.com.cn/','退市决定与监管措施'],
    ['深圳证券交易所','退市、纪律处分、公告','EXCHANGE','https://www.szse.cn/','退市决定与监管措施'],
    ['北京证券交易所','退市与监管信息','EXCHANGE','https://www.bse.cn/','北交所退市样本'],
    ['巨潮资讯网','上市公司公告全文披露','DISCLOSURE','http://www.cninfo.com.cn/','先行赔付、重整、诉讼公告'],
    ['中国裁判文书网','裁判文书公开','JUDICIAL','https://wenshu.court.gov.cn/','判决、调解、执行裁定'],
    ['全国企业破产重整案件信息网','破产与重整公告','JUDICIAL','https://pccz.court.gov.cn/','债权申报与清偿'],
    ['中国投资者网','投资者保护信息与案例','INVESTOR','https://www.investor.org.cn/','典型案例与投保动态'],
    ['中国证券投资者保护基金','先行赔付基金、投保数据','INVESTOR','https://www.sipf.com.cn/','基金设立与赔付进度'],
    ['中证中小投资者服务中心','特别代表人诉讼、支持诉讼','INVESTOR','http://www.isc.com.cn/','代表人诉讼原告名单'],
    ['财联社','电报与深度报道','FINMEDIA','https://www.cls.cn/','时效性线索，需交叉核验'],
    ['同花顺','个股资料与公告聚合','FINMEDIA','http://stockpage.10jqka.com.cn/','行情与公司资料参考'],
    ['东方财富','个股行情与公告','FINMEDIA','https://quote.eastmoney.com/','行情与公开资讯'],
    ['万得 Wind','专业金融终端（需授权）','LICENSED','https://www.wind.com.cn/','不镜像数据，仅提供字段对接说明']
  ];
  return `<section class="section" style="padding-top:44px">
    <div class="shell">
      ${sectionHead('PROVENANCE · 可核验性', '数据从哪来，为什么可信',
        `来源台账 ${d.sources.length} 条，按权威性与可核验程度分级；每条结论都能回到原件、发布机构、日期与观察截止日。`, null)}
      <div class="grade-3">
        <div class="grade-card h reveal"><div class="g">高</div><h4>官方文书 / 法院公告 / 公司公告</h4><p>可作定量依据，优先采用。</p></div>
        <div class="grade-card m reveal"><div class="g">中</div><h4>权威媒体 / 投保机构披露</h4><p>交叉核对后补充时间线。</p></div>
        <div class="grade-card l reveal"><div class="g">低</div><h4>律师征集 / 股吧 / 视频</h4><p>仅质性证据，不单独支撑金额。</p></div>
      </div>

      <div class="panel panel-pad mt-3 reveal">
        <div class="panel-head"><div class="panel-title">官方与公开数据门户</div><span class="badge">新窗口打开</span></div>
        <div class="portal-grid">
          ${portals.map(([n,dsc,t,u,use]) => `<a class="portal" href="${u}" target="_blank" rel="noopener noreferrer" data-cursor="跳转">
            <div class="top"><h4>${n}</h4><span class="tag">${t}</span></div>
            <p>${dsc}</p><span class="u">${u.replace(/^https?:\/\//,'')}</span>
            <p style="margin-top:4px;color:#7C8DA8">用途：${use}</p></a>`).join('')}
        </div>
        <div class="note mt-2">“链接”不是“镜像”：本站仅对公开页面做结构化引用与跳转。万得（Wind）、同花顺 iFinD 等为商业授权终端，本站不转载其数据；如需机构级字段，请通过授权账号访问，或按本站的 JSON 字段规范自行对接。</div>
      </div>

      <div class="panel mt-3 reveal">
        <div class="panel-head panel-pad" style="margin:0;padding-bottom:14px">
          <div class="panel-title">来源台账明细 · ${d.sources.length} 条</div>
          <div class="field" style="height:34px;min-width:260px">${iconSearch()}
            <input id="srcSearch" type="text" placeholder="搜索来源名称 / 机构 / 用途" value="${esc(q)}" autocomplete="off">
          </div>
        </div>
        <div class="table-scroll" style="max-height:560px">
          <table class="data" style="min-width:1000px">
            <thead><tr><th>#</th><th>来源类型</th><th>名称 / 文件</th><th>发布机构</th><th>日期</th><th>用途</th><th>分级</th><th>链接</th></tr></thead>
            <tbody id="srcBody">
              ${d.sources.map(s => {
                const lvl = evidenceLevel(s.type, s.publisher);
                const isUrl = /^https?:\/\//.test(s.url || '');
                return `<tr data-hay="${esc(((s.name||'')+' '+(s.publisher||'')+' '+(s.usage||'')+' '+(s.type||'')).toLowerCase())}">
                  <td class="code">${esc(s.no)}</td>
                  <td>${esc(s.type)}</td>
                  <td><span class="name" style="font-size:12.5px">${esc(s.name)}</span></td>
                  <td>${esc(s.publisher)}</td>
                  <td class="date">${esc(s.date)}</td>
                  <td class="small">${esc(s.usage)}</td>
                  <td>${lvl==='high'?'<span class="badge green">高</span>':lvl==='mid'?'<span class="badge gold">中</span>':'<span class="badge red">低</span>'}</td>
                  <td>${isUrl ? `<a href="${s.url}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan);font-size:11px">打开 ↗</a>` : '<span class="dim">本地存档</span>'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-2 mt-3">
        <div class="panel panel-pad reveal">
          <div class="panel-title">数据使用与免责</div>
          <div class="prose small mt-1">
            <p>本站为学术研究展示，不构成投资建议、法律意见或赔偿预测。所有金额、状态均以官方原始文书为准；空白字段表示尚未完成核验，不以推测填充。</p>
            <p>UGC（股吧、雪球、视频）仅作质性材料，匿名信息不得指认具体公司；与官方口径冲突时标注“存疑”。</p>
            <p>引用本站数据请注明：四象求真队《退市投资者赔偿主数据库 v3.0》，观察截止 2026-11-14。</p>
          </div>
        </div>
        <div class="panel panel-pad reveal">
          <div class="panel-title">开放接口</div>
          <div class="prose small mt-1">
            <p>本站数据以静态 JSON 发布，字段与数据库表一一对应，可直接对接机构系统或复现研究。</p>
            <div class="code-block">GET /data/companies.json<br>GET /data/cases.json<br>GET /data/meta.json</div>
            <p class="mt-1">字段字典见数据库 <b>13_口径字典</b>；金额单位统一为人民币元，空值为 null。</p>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

/* ============================================================
   ABOUT
   ============================================================ */
export function renderAbout(){
  const d = db(); const s = d.stats;
  return `<section class="about-hero">
    <div class="shell">
      <div class="eyebrow reveal">ABOUT THE PROJECT</div>
      <h1 class="reveal">退市赔偿，<br><em>钱到账了吗？</em></h1>
      <p class="lede reveal" style="max-width:760px;margin-top:22px">A股退市下中小投资者赔偿兑现过程与实效研究。我们不预设哪一种救济路径天然更优，而是把“实际到账”作为重要结果端点，追踪损失、责任主体、责任财产、救济程序、执行与实际回收之间的连接关系。</p>
      <div class="detail-badges reveal">
        <span class="badge cyan">华东政法大学 · 四象求真队</span>
        <span class="badge">第二十届“挑战杯”校内孵化赛</span>
        <span class="badge">哲学社会科学类社会调查报告</span>
        <span class="badge gold">指导老师 卞钰祥 副教授</span>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:24px">
    <div class="shell">
      <div class="grid-2">
        <div class="panel panel-pad reveal">
          <div class="panel-title">核心问题</div>
          <div class="prose mt-1">
            <p><b>问题一：</b>退市投资者赔偿的“实际兑现率”究竟是多少？不是制度有没有，而是多少钱最终到账。</p>
            <p><b>问题二：</b>哪些因素造成“理论损失”与“实际到账”之间的差距？责任主体、财产、程序、执行。</p>
            <p><b>问题三：</b>在最终判决出现之前，能否识别一个案件的赔偿兑现容量？这正是 PEU 出现的地方。</p>
          </div>
        </div>
        <div class="panel panel-pad reveal">
          <div class="panel-title">与既有研究的差别</div>
          <div class="prose mt-1">
            <p>已有研究多比较“有没有救济渠道”“哪种诉讼更好”。本项目把观察终点推进到<b>实际到账</b>，并在损失与到账之间加入 <b>PEU</b>，从而区分“客观上赔不起”与“有条件但没有充分赔到”。</p>
            <p>我们不把 REI 包装成已经完成的成熟指数：它属于后续评价工具，需要在数据库、PEU 与实际回收数据更成熟后，再确定权重并做稳健性回测。</p>
          </div>
        </div>
      </div>

      <div class="grid-4 mt-3">
        ${[
          ['L','损失暴露','可识别的损失或请求规模'],
          ['PEU','赔偿可实现容量','责任主体 + 可执行财产约束'],
          ['R','实际到账','经证据确认的现金回收'],
          ['GAP','兑现缺口','PEU − R，程序与执行损耗']
        ].map(([sym,t,p]) => `<div class="formula-card reveal"><div class="sym" style="font-size:40px">${sym}</div><h3>${t}</h3><p>${p}</p></div>`).join('')}
      </div>

      <div class="panel panel-pad mt-3 reveal" id="rei">
        <div class="panel-head"><div class="panel-title">REI · 赔偿实效评价框架（拟建）</div><span class="badge gold">规划中 · 非现成指数</span></div>
        <div class="grid-4 mt-1">
          ${[['赔付深度','最终到账相对损失或可实现空间的深度'],['时间效率','从责任确定到实际回收的时长'],['投资者成本','维权所付出的时间与程序成本'],['覆盖程度','实际受益投资者的覆盖面']].map(([t,p]) => `<div><h4 style="font-size:13.5px">${t}</h4><p class="prose small" style="margin-top:6px">${p}</p></div>`).join('')}
        </div>
        <div class="note mt-2">PEU 作为中间工具不计入评分向量。当前不输出数值评分，不作赔偿预测或机构绩效排名。</div>
      </div>

      <div class="grid-2 mt-3">
        <div class="panel panel-pad reveal">
          <div class="panel-title">研究方法</div>
          <div class="prose mt-1">
            <p><b>规范研究：</b>文献研究、比较分析、因素分析、归纳总结，梳理退市赔偿的制度约束与实务堵点。</p>
            <p><b>定量分析：</b>PEU 测算（自建中间工具）、REI 框架（拟建）、Kaplan–Meier 生存分析（右删失处理），并以典型案例做回测。</p>
          </div>
        </div>
        <div class="panel panel-pad reveal" id="limits">
          <div class="panel-title">口径与边界</div>
          <div class="prose mt-1">
            <p>公司数 / 案件数 / 责任主体数 / 投资者数分列统计，不混用；U 与 N、C 与 B、确认债权与实际受偿不得混用。</p>
            <p>v1-only 记录保留 2024-01-01 截止日；2026 年为未完结年度。证据支持到哪里，结论就推进到哪里。</p>
          </div>
        </div>
      </div>

      <div class="panel panel-pad mt-3 reveal" id="team">
        <div class="panel-title">团队</div>
        <div class="team-grid mt-2">
          ${[['许博林','项目负责人 · 金融学（数量金融）'],['薛一凝','成员'],['宋兴皖','成员'],['左宸宇','成员']].map(([n,r]) => `<div class="team-card"><b>${n}</b><span>${r}</span></div>`).join('')}
        </div>
        <div class="kv mt-2">
          ${kvRow('指导教师', '卞钰祥 · 副教授 · 华东政法大学商学院')}
          ${kvRow('所属院校', '华东政法大学 商学院')}
          ${kvRow('数据版本', 'v3.0 合并去重版 · 生成 2026-11-14')}
          ${kvRow('观察截止', '2026-11-14（v1-only 记录保留 2024-01-01）')}
          ${kvRow('唯一案件', s.cases + ' 条（v1 45 + v2 47 − 重复 21）')}
          ${kvRow('来源台账', s.sources + ' 条 · 高/中/低三级')}
        </div>
      </div>

      <div class="panel panel-pad mt-3 reveal">
        <div class="panel-title">更新日志</div>
        <div class="tl mt-2">
          <div class="tl-item"><div class="d">2026-11-14</div><div class="t">v3.0 合并去重版</div><div class="m">30 张旧表合并为 16 张；补录 2026-10-02 后摘牌的 5 家；恢复 24 条 v1 案件记录。</div></div>
          <div class="tl-item"><div class="d">2026-10</div><div class="t">2026-11 关键增量</div><div class="m">清越科技第 6 单先行赔付基金设立；证监会《先行赔付指导意见（征求意见稿）》发布。</div></div>
          <div class="tl-item"><div class="d">2026-10-02</div><div class="t">v2 扩展窗口</div><div class="m">样本扩展至 2022—2026，案件库扩至 47 条，新增生存分析与 PEU 结构。</div></div>
          <div class="tl-item"><div class="d">2024-01-01</div><div class="t">v1 基线</div><div class="m">2022—2023 窗口，45 条案件，93 家退市公司。</div></div>
        </div>
      </div>

      <div class="note mt-3">免责声明：本站为大学生课外学术科技作品的研究展示平台，不构成投资建议、法律意见或赔偿预测。数据引用请以官方原始文书为准。引用格式：四象求真队《退市投资者赔偿主数据库 v3.0》，观察截止 2026-11-14。</div>
    </div>
  </section>`;
}

/* ============================================================
   BINDERS
   ============================================================ */
export function bindView(route, param, params){
  if (route === 'home') bindHome();
  else if (route === 'companies') bindCompanies();
  else if (route === 'cases') bindCases(params);
  else if (route === 'chain') bindChain();
  else if (route === 'paths') bindPaths();
  else if (route === 'survival') bindSurvival();
  else if (route === 'regulations') bindRegulations();
  else if (route === 'sources') bindSources();
  animateBars();
}

function animateBars(){
  requestAnimationFrame(() => {
    document.querySelectorAll('[data-w]').forEach(el => {
      const w = parseFloat(el.dataset.w) || 0;
      el.style.width = Math.max(0, Math.min(1, w)) * 100 + '%';
    });
  });
}

function bindHome(){
  const d = db();
  yearChart(document.getElementById('chartYear'));
  statusChart(document.getElementById('chartStatus'), code => {
    location.hash = '#/companies?s=' + encodeURIComponent(code);
  });
  const form = document.getElementById('heroSearch');
  if (form){
    form.addEventListener('submit', e => {
      e.preventDefault();
      const q = document.getElementById('heroInput').value.trim();
      if (!q) return;
      window.__openPalette && window.__openPalette(q);
    });
  }
  document.querySelectorAll('[data-chain]').forEach(n => {
    n.addEventListener('click', () => { location.hash = '#/chain'; });
  });
  // count-up
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count);
    if (isNaN(target)) return;
    const dur = 1100; const start = performance.now();
    function tick(now){
      const p = Math.min(1, (now-start)/dur);
      const eased = 1 - Math.pow(1-p, 3);
      const val = Math.round(target * eased);
      el.childNodes[0].nodeValue = val.toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(tick);
      else { el.childNodes[0].nodeValue = target.toLocaleString('en-US'); }
    }
    requestAnimationFrame(tick);
  });
  document.querySelectorAll('.status-row').forEach(r => {
    r.addEventListener('click', () => { location.hash = '#/companies?s=' + encodeURIComponent(r.dataset.status); });
  });
}

function bindCompanies(){
  const d = db();
  let stateF = {
    q: new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '',
    y: new URLSearchParams(location.hash.split('?')[1] || '').get('y') || 'all',
    b: new URLSearchParams(location.hash.split('?')[1] || '').get('b') || 'all',
    c: new URLSearchParams(location.hash.split('?')[1] || '').get('c') || 'all',
    s: new URLSearchParams(location.hash.split('?')[1] || '').get('s') || 'all',
    sort: 'year-desc'
  };
  const body = document.getElementById('coBody');
  const count = document.getElementById('coCount');
  const foot = document.getElementById('coFoot');
  let filtered = [];

  function apply(){
    const q = stateF.q.trim().toLowerCase();
    filtered = d.companies.filter(c => {
      if (stateF.y !== 'all' && String(c.year) !== String(stateF.y)) return false;
      if (stateF.b !== 'all' && c.board !== stateF.b) return false;
      if (stateF.c !== 'all' && c.category !== stateF.c) return false;
      if (stateF.s !== 'all' && statusBase(c.status) !== stateF.s) return false;
      if (q){
        const hay = `${c.code} ${c.name} ${c.board} ${c.category} ${c.subtype} ${c.fact} ${c.statusNote} ${c.penaltyAuthority}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const cmp = {
      'year-desc': (a,b) => (b.year||0)-(a.year||0) || a.code.localeCompare(b.code),
      'year-asc': (a,b) => (a.year||0)-(b.year||0) || a.code.localeCompare(b.code),
      'code': (a,b) => a.code.localeCompare(b.code),
      'complete': (a,b) => (b.completeness||0)-(a.completeness||0),
      'recovery': (a,b) => (b.recoveryN||0)-(a.recoveryN||0)
    }[stateF.sort];
    filtered.sort(cmp);
    renderRows();
    syncURL();
  }

  function renderRows(){
    if (!filtered.length){
      body.innerHTML = `<tr><td colspan="9">${emptyState('没有符合条件的公司，试试放宽筛选。')}</td></tr>`;
    } else {
      body.innerHTML = filtered.map(c => {
        const comp = c.completeness === null ? '—' : Math.round(c.completeness*100) + '%';
        return `<tr data-href="#/company/${encodeURIComponent(c.id)}" data-cursor="查看">
          <td><span class="name">${esc(c.name)}</span><span class="code">${esc(c.code)}</span></td>
          <td class="num">${c.year || '—'}</td>
          <td>${esc(c.board)}</td>
          <td>${esc(c.category)}${c.subtype && c.subtype !== c.category ? `<span class="dim small"> · ${esc(c.subtype)}</span>` : ''}</td>
          <td class="date">${esc(shortDate(c.delistDate || c.delistDateExact))}</td>
          <td>${statusPill(c.status)}</td>
          <td class="small">${esc(c.path || '—')}</td>
          <td>${c.cases.length ? `<span class="badge cyan">${c.cases.length}</span>` : '<span class="dim">—</span>'}</td>
          <td class="num">${comp}</td>
        </tr>`;
      }).join('');
    }
    count.textContent = filtered.length;
    foot.innerHTML = `<div class="table-foot-inner"><span>显示 ${filtered.length} 条 · 点击行进入赔偿档案</span><span class="mono">DATA v3.0 · 2026-11-14</span></div>`;
  }

  function syncURL(){
    const p = new URLSearchParams();
    if (stateF.q) p.set('q', stateF.q);
    if (stateF.y !== 'all') p.set('y', stateF.y);
    if (stateF.b !== 'all') p.set('b', stateF.b);
    if (stateF.c !== 'all') p.set('c', stateF.c);
    if (stateF.s !== 'all') p.set('s', stateF.s);
    const qs = p.toString();
    history.replaceState(null, '', '#/companies' + (qs ? '?' + qs : ''));
  }

  const input = document.getElementById('coSearch');
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { stateF.q = input.value; apply(); }, 120);
  });
  document.querySelectorAll('#yearChips .chip').forEach(ch => ch.addEventListener('click', () => {
    stateF.y = ch.dataset.y;
    document.querySelectorAll('#yearChips .chip').forEach(x => x.classList.toggle('on', x === ch));
    apply();
  }));
  document.querySelectorAll('#catChips [data-c]').forEach(ch => ch.addEventListener('click', () => {
    stateF.c = ch.dataset.c;
    document.querySelectorAll('#catChips [data-c]').forEach(x => x.classList.toggle('on', x === ch));
    apply();
  }));
  document.getElementById('boardSelect').addEventListener('change', e => { stateF.b = e.target.value; apply(); });
  document.getElementById('statusSelect').addEventListener('change', e => { stateF.s = e.target.value; apply(); });
  document.getElementById('coSort').addEventListener('change', e => { stateF.sort = e.target.value; apply(); });
  document.getElementById('coReset').addEventListener('click', () => {
    stateF = { q:'', y:'all', b:'all', c:'all', s:'all', sort:'year-desc' };
    input.value = '';
    document.querySelectorAll('#yearChips .chip').forEach(x => x.classList.toggle('on', x.dataset.y === 'all'));
    document.querySelectorAll('#catChips [data-c]').forEach(x => x.classList.toggle('on', x.dataset.c === 'all'));
    document.getElementById('boardSelect').value = 'all';
    document.getElementById('statusSelect').value = 'all';
    document.getElementById('coSort').value = 'year-desc';
    apply();
  });
  document.getElementById('coExport').addEventListener('click', () => {
    const cols = ['证券代码','证券简称','年度','交易所/板块','退市大类','退市细类','摘牌日','赔偿状态码','赔偿状态说明','救济路径','适格投资者数','最终已验证实际回收_CNY','数据截止日','主要来源'];
    const lines = [cols.join(',')];
    for (const c of filtered){
      const row = [c.code, c.name, c.year, c.board, c.category, c.subtype, c.delistDate, c.status, c.statusNote, c.path, c.investors, c.recoveryN || '', c.asOf, c.source];
      lines.push(row.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(','));
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `退市公司_${filtered.length}条_2026-11-14.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  });
  body.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-href]');
    if (tr) location.hash = tr.dataset.href;
  });
  apply();
}

function bindCases(params){
  const d = db();
  const st0 = params.get('s') || 'all';
  const q0 = params.get('q') || '';
  let st = st0, q = q0;
  const grid = document.getElementById('caseGrid');
  const count = document.getElementById('caseCount');
  function apply(){
    const qq = q.trim().toLowerCase();
    const rows = d.cases.filter(c => {
      if (st !== 'all' && statusBase(c.status) !== st) return false;
      if (qq){
        const hay = `${c.id} ${c.code} ${c.name} ${c.path} ${c.court} ${c.docNo} ${c.penalty}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
    count.textContent = rows.length;
    grid.innerHTML = rows.length ? rows.map(c => {
      const m = statusMeta(c.status);
      return `<div class="case-card" data-href="#/case/${encodeURIComponent(c.id)}" data-cursor="打开">
        <span class="corner"></span>
        <div class="case-card-top">
          <div><h3>${esc(c.name)}</h3><div class="cid">${esc(c.id)} · ${esc(c.code)}</div></div>
          ${statusPill(c.status)}
        </div>
        <div class="path">${esc(c.path || '救济路径未记录')}</div>
        <div class="meta">
          <div>判赔 / 赔付<b>${esc(clip(c.award || '—', 42))}</b></div>
          <div>适格 / 涉案<b>${esc(clip(c.parties || '—', 30))}</b></div>
        </div>
        <div class="case-foot">
          <span class="court">${esc(c.court || '—')}</span><span>观察 ${esc(c.asOf || '—')}</span>
        </div>
      </div>`;
    }).join('') : emptyState('没有符合条件的案件。');
  }
  const input = document.getElementById('caseSearch');
  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { q = input.value; apply(); }, 120); });
  document.querySelectorAll('#caseChips .chip').forEach(ch => ch.addEventListener('click', () => {
    st = ch.dataset.s;
    document.querySelectorAll('#caseChips .chip').forEach(x => x.classList.toggle('on', x === ch));
    apply();
  }));
  grid.addEventListener('click', e => {
    const card = e.target.closest('[data-href]');
    if (card) location.hash = card.dataset.href;
  });
  apply();
}

function bindChain(){
  recoveryChart(document.getElementById('chartRecovery'));
}

function bindPaths(){
  document.querySelectorAll('[data-path]').forEach(card => {
    card.querySelector('.path-card-head').addEventListener('click', () => card.classList.toggle('open'));
  });
  // open first by default
  const first = document.querySelector('[data-path]');
  if (first) first.classList.add('open');
}

function bindSurvival(){
  kmChart(document.getElementById('chartKM'));
  eventChart(document.getElementById('chartEvents'));
}

function bindRegulations(){
  const list = document.getElementById('regList');
  const items = [...list.querySelectorAll('.reg-item')];
  const count = document.getElementById('regCount');
  let lvl = 'all', q = '';
  function apply(){
    let n = 0;
    for (const it of items){
      const okL = lvl === 'all' || it.dataset.l === lvl;
      const okQ = !q || (it.dataset.hay || '').includes(q);
      const show = okL && okQ;
      it.style.display = show ? '' : 'none';
      if (show) n++;
    }
    count.textContent = n;
  }
  const input = document.getElementById('regSearch');
  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { q = input.value.trim().toLowerCase(); apply(); }, 120); });
  document.querySelectorAll('#regChips .chip').forEach(ch => ch.addEventListener('click', () => {
    lvl = ch.dataset.l;
    document.querySelectorAll('#regChips .chip').forEach(x => x.classList.toggle('on', x === ch));
    apply();
  }));
  apply();
}

function bindSources(){
  const body = document.getElementById('srcBody');
  const rows = [...body.querySelectorAll('tr')];
  const input = document.getElementById('srcSearch');
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const q = input.value.trim().toLowerCase();
      for (const r of rows) r.style.display = !q || (r.dataset.hay||'').includes(q) ? '' : 'none';
    }, 120);
  });
}
