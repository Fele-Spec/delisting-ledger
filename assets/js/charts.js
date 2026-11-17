/* ============================================================
   charts.js — ECharts 封装（统一深空金融主题）
   ============================================================ */
import { state, fmtMoney, fmtInt, esc } from './data.js';

const C = {
  cyan:'#38F2FF', blue:'#5B7CFF', violet:'#A855F7', green:'#2DE2A8',
  gold:'#FFCB6B', red:'#FB7185', slate:'#94A3B8', text:'#E7EEFA',
  muted:'#8CA0BE', dim:'#5F7392', line:'rgba(126,166,255,.10)'
};
const PALETTE = [C.cyan, C.blue, C.violet, C.gold, C.green, C.red, '#818CF8', C.slate, '#64748B'];

export function initCharts(){
  if (!window.echarts) return;
  echarts.registerTheme('ledger', {
    color: PALETTE,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: '"Inter","PingFang SC","Microsoft YaHei",sans-serif', color: C.muted },
    title: { textStyle: { color: C.text, fontWeight: 600 } },
    legend: { textStyle: { color: C.muted } },
    tooltip: {
      backgroundColor: 'rgba(8,13,23,.94)',
      borderColor: 'rgba(126,166,255,.24)',
      borderWidth: 1,
      textStyle: { color: C.text, fontSize: 12 },
      extraCssText: 'backdrop-filter:blur(10px);box-shadow:0 18px 50px rgba(0,0,0,.5);border-radius:10px;padding:10px 12px;'
    },
    grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true }
  });
}

export function track(chart){
  if (!chart) return chart;
  state.charts.push(chart);
  return chart;
}
export function disposeCharts(){
  for (const c of state.charts){ try { c.dispose(); } catch(e){} }
  state.charts.length = 0;
}
export function resizeCharts(){
  for (const c of state.charts){ try { c.resize(); } catch(e){} }
}

function baseAxis(){
  return {
    axisLine: { show: true, lineStyle: { color: 'rgba(126,166,255,.14)' } },
    axisTick: { show: false },
    axisLabel: { color: C.dim, fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace' },
    splitLine: { lineStyle: { color: C.line, type: [3,4] } }
  };
}
function grid(pad){
  return Object.assign({ left: 10, right: 18, top: 24, bottom: 6, containLabel: true }, pad || {});
}

/* ---------------- 年度退市结构 ---------------- */
export function yearChart(el){
  if (!el) return;
  const db = state.db;
  const years = db.yearly.map(y => String(y.year));
  const keys = [
    ['trade','交易类'],['finance','财务类'],['norm','规范类'],
    ['major','重大违法类'],['active','主动退市'],['restructure','重组退市'],['other','其他强制退市']
  ];
  const colors = [C.cyan, C.blue, C.violet, C.gold, C.green, '#818CF8', C.red];
  const series = keys.map(([k,name],i) => ({
    name, type: 'bar', stack: 'total', barWidth: '46%',
    itemStyle: { color: colors[i], borderRadius: i === keys.length-1 ? [4,4,0,0] : 0, borderColor: 'rgba(5,8,15,.6)', borderWidth: 1 },
    emphasis: { focus: 'series', itemStyle: { shadowBlur: 18, shadowColor: colors[i] } },
    data: db.yearly.map(y => y[k] || 0),
    label: i === 3 ? {
      show: true, position: 'inside', color: '#1A1206', fontSize: 10, fontWeight: 600,
      formatter: p => p.value > 0 ? p.value : ''
    } : { show: false }
  }));
  const chart = echarts.init(el, 'ledger', { renderer: 'canvas' });
  chart.setOption({
    grid: grid({ top: 18, bottom: 4 }),
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(56,242,255,.05)' } },
      formatter: (ps) => {
        const t = ps[0].axisValue;
        const y = db.yearly.find(x => String(x.year) === t) || {};
        let rows = ps.filter(p => p.value > 0).map(p =>
          `<div style="display:flex;justify-content:space-between;gap:22px;margin-top:4px"><span style="color:#8CA0BE">${p.marker}${p.seriesName}</span><b style="color:#E7EEFA;font-family:Bahnschrift">${p.value}</b></div>`
        ).join('');
        return `<div style="min-width:190px"><div style="font-family:Bahnschrift;font-size:15px;color:#E7EEFA">${t} 年 · ${y.state||''}</div>${rows}
          <div style="border-top:1px dashed rgba(126,166,255,.15);margin-top:6px;padding-top:5px;font-size:10.5px;color:#5F7392;max-width:230px;line-height:1.5">${esc(y.feature||'')}</div></div>`;
      }
    },
    xAxis: Object.assign(baseAxis(), { type: 'category', data: years, splitLine: { show: false }, axisLabel: { color: C.muted, fontSize: 12, fontFamily: 'Bahnschrift' } }),
    yAxis: Object.assign(baseAxis(), { type: 'value', max: 60, splitNumber: 3 }),
    series
  });
  return track(chart);
}

/* ---------------- 赔偿状态分布 ---------------- */
export function statusChart(el, onSelect){
  if (!el) return;
  const db = state.db;
  const entries = Object.entries(db.stats.statusDist)
    .map(([code, n]) => {
      const base = code.split('/')[0];
      const m = db.statusDict[base] || { label: '其他', color: '#64748B' };
      return { code, base, n, color: m.color, label: m.label };
    });
  // 合并同一基础状态的复合码
  const grouped = {};
  for (const e of entries){
    if (!grouped[e.base]) grouped[e.base] = { code: e.base, n: 0, color: e.color, label: e.label };
    grouped[e.base].n += e.n;
  }
  const data = Object.values(grouped).sort((a,b) => b.n - a.n).map(d => ({
    name: `${d.code} ${d.label}`, value: d.n, code: d.code,
    itemStyle: { color: d.color, borderColor: '#070C16', borderWidth: 2 }
  }));
  const chart = echarts.init(el, 'ledger');
  chart.setOption({
    tooltip: { trigger: 'item', formatter: p => `<b style="color:#E7EEFA">${p.name}</b><br><span style="color:#8CA0BE">${p.value} 家 · ${p.percent}%</span>` },
    series: [{
      type: 'pie', radius: ['62%', '86%'], center: ['50%', '50%'],
      avoidLabelOverlap: true, padAngle: 1.5,
      itemStyle: { borderRadius: 4 },
      label: { show: false }, labelLine: { show: false },
      emphasis: { scale: true, scaleSize: 6, itemStyle: { shadowBlur: 24, shadowColor: 'rgba(0,0,0,.6)' } },
      data
    }],
    graphic: [
      { type: 'text', left: 'center', top: '43%', style: { text: String(db.stats.companies), fill: '#E7EEFA', fontSize: 34, fontFamily: 'Bahnschrift', fontWeight: 600 } },
      { type: 'text', left: 'center', top: '57%', style: { text: '退市公司', fill: '#5F7392', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2 } }
    ]
  });
  if (onSelect) chart.on('click', p => onSelect(p.data.code));
  return track(chart);
}

/* ---------------- 回收金额 ---------------- */
export function recoveryChart(el){
  if (!el) return;
  const db = state.db;
  const rows = db.companies.filter(c => c.recoveryN > 0).sort((a,b) => a.recoveryN - b.recoveryN);
  const chart = echarts.init(el, 'ledger');
  chart.setOption({
    grid: { left: 10, right: 76, top: 14, bottom: 6, containLabel: true },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(45,226,168,.05)' } },
      formatter: p => {
        const r = rows[p[0].dataIndex];
        return `<b style="color:#E7EEFA">${esc(r.name)} ${r.code}</b><br><span style="color:#8CA0BE">已验证实际回收：</span><b style="color:#2DE2A8">${fmtMoney(r.recoveryN)}元</b><br><span style="color:#5F7392;font-size:10.5px">来源：${esc(r.source||'见公司档案')}</span>`;
      }
    },
    xAxis: Object.assign(baseAxis(), { type: 'value', splitNumber: 3, axisLabel: { color: C.dim, fontSize: 10, formatter: v => fmtMoney(v,0) } }),
    yAxis: Object.assign(baseAxis(), { type: 'category', data: rows.map(r => r.name), splitLine: { show: false }, axisLabel: { color: C.muted, fontSize: 11.5 } }),
    series: [{
      type: 'bar', barWidth: 14,
      data: rows.map(r => ({ value: r.recoveryN, itemStyle: { color: new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'rgba(45,226,168,.35)'},{offset:1,color:'#2DE2A8'}]), borderRadius: [0,4,4,0] } })),
      label: { show: true, position: 'right', color: '#E7EEFA', fontSize: 11, fontFamily: 'Bahnschrift', formatter: p => fmtMoney(p.value) + '元' }
    }]
  });
  return track(chart);
}

/* ---------------- KM 生存曲线 ---------------- */
export function kmChart(el){
  if (!el) return;
  const km = state.db.km;
  const maxT = km.maxDays || 1300;
  const points = km.points.slice();
  // 构建阶梯数据
  const step = [];
  for (let i=0;i<points.length;i++){
    const [t,s] = points[i];
    if (i>0) step.push([t, points[i-1][1]]);
    step.push([t, s]);
  }
  step.push([maxT, step.length ? step[step.length-1][1] : 1]);
  const chart = echarts.init(el, 'ledger');
  chart.setOption({
    grid: { left: 10, right: 24, top: 30, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: ps => {
        const t = ps[0].axisValue;
        return `<b style="color:#E7EEFA">观察 ${Math.round(t)} 天</b><br><span style="color:#8CA0BE">未发生回收比例 S(t) = </span><b style="color:#38F2FF;font-family:Bahnschrift">${(ps[0].value[1]*100).toFixed(1)}%</b>`;
      }
    },
    xAxis: Object.assign(baseAxis(), { type: 'value', max: maxT, name: '距行政处罚日（天）', nameTextStyle: { color: C.dim, fontSize: 10, fontFamily: 'JetBrains Mono' }, nameGap: 22 }),
    yAxis: Object.assign(baseAxis(), { type: 'value', min: 0.4, max: 1.02, splitNumber: 4, axisLabel: { color: C.dim, fontSize: 10, formatter: v => (v*100).toFixed(0)+'%' } }),
    series: [{
      type: 'line', step: 'end', symbol: 'none', smooth: false,
      lineStyle: { width: 2, color: C.cyan, shadowBlur: 14, shadowColor: 'rgba(56,242,255,.5)' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(56,242,255,.20)'},{offset:1,color:'rgba(56,242,255,0)'}]) },
      data: step,
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: 'rgba(255,203,107,.55)', type: 'dashed' },
        label: { formatter: '中位线 50%', color: C.gold, fontSize: 10, fontFamily: 'JetBrains Mono', position: 'insideEndTop' },
        data: [{ yAxis: 0.5 }]
      },
      markPoint: {
        symbolSize: 22, label: { show: false },
        itemStyle: { color: C.gold, shadowBlur: 12, shadowColor: C.gold },
        data: km.steps.map(s => ({ coord: [s.t, s.s], value: s.d }))
      }
    }, {
      type: 'scatter', symbol: 'rect', symbolSize: [1.6, 9], z: 5,
      itemStyle: { color: 'rgba(255,203,107,.55)' },
      tooltip: { show: false },
      data: (km.censors || []).map(c => [c[0], c[1]])
    }]
  });
  return track(chart);
}

/* ---------------- 事件时间轴（按年份分布） ---------------- */
export function eventChart(el){
  if (!el) return;
  const db = state.db;
  const ev = db.events.filter(e => e.date && /^\d{4}-\d{2}-\d{2}/.test(e.date));
  const y0 = Math.min(...ev.map(e => +e.date.slice(0,4)));
  const y1 = Math.max(...ev.map(e => +e.date.slice(0,4)));
  const years = [];
  for (let y = y0; y <= y1; y++) years.push(y);
  const isRec = t => /回收/.test(t);
  const penalty = years.map(y => ev.filter(e => !isRec(e.type) && +e.date.slice(0,4) === y).length);
  const recovery = years.map(y => ev.filter(e => isRec(e.type) && +e.date.slice(0,4) === y).length);
  const chart = echarts.init(el, 'ledger');
  chart.setOption({
    grid: { left: 10, right: 18, top: 30, bottom: 6, containLabel: true },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(56,242,255,.05)' } },
      formatter: ps => {
        const y = ps[0].axisValue;
        const t = ps.reduce((a,p) => a + p.value, 0);
        return `<b style="color:#E7EEFA">${y} 年 · ${t} 条事件</b>` + ps.map(p =>
          `<div style="display:flex;justify-content:space-between;gap:22px;margin-top:4px"><span style="color:#8CA0BE">${p.marker}${p.seriesName}</span><b style="color:#E7EEFA;font-family:Bahnschrift">${p.value}</b></div>`).join('');
      }
    },
    xAxis: Object.assign(baseAxis(), { type: 'category', data: years, splitLine: { show: false }, axisLabel: { color: C.muted, fontSize: 11, fontFamily: 'Bahnschrift' } }),
    yAxis: Object.assign(baseAxis(), { type: 'value', splitNumber: 3, name: '事件数', nameTextStyle: { color: C.dim, fontSize: 10 } }),
    series: [
      { name: '行政处罚生效/作出', type: 'bar', stack: 'e', barWidth: '42%',
        itemStyle: { color: 'rgba(91,124,255,.85)', borderRadius: [0,0,0,0] }, data: penalty },
      { name: '首次已验证现金回收', type: 'bar', stack: 'e', barWidth: '42%',
        itemStyle: { color: C.gold, borderRadius: [4,4,0,0], shadowBlur: 10, shadowColor: 'rgba(255,203,107,.35)' }, data: recovery }
    ]
  });
  return track(chart);
}

/* ---------------- 数据就绪度环 ---------------- */
export function readinessDonut(el, ready, total, label){
  if (!el) return;
  const chart = echarts.init(el, 'ledger');
  const pct = total ? ready/total : 0;
  chart.setOption({
    series: [{
      type: 'pie', radius: ['74%','92%'], silent: true, startAngle: 90,
      label: { show: false }, labelLine: { show: false },
      data: [
        { value: ready, itemStyle: { color: pct > .6 ? C.green : pct > .1 ? C.gold : C.red, borderRadius: 8 } },
        { value: Math.max(total-ready,0), itemStyle: { color: 'rgba(126,166,255,.09)', borderRadius: 8 } }
      ]
    }],
    graphic: [
      { type: 'text', left: 'center', top: '38%', style: { text: `${Math.round(pct*100)}%`, fill: '#E7EEFA', fontSize: 20, fontFamily: 'Bahnschrift', fontWeight: 600 } },
      { type: 'text', left: 'center', top: '56%', style: { text: label, fill: '#5F7392', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' } }
    ]
  });
  return track(chart);
}
