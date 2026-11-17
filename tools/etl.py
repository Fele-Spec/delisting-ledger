# -*- coding: utf-8 -*-
"""
退市赔偿数据库 ETL：Excel (16 sheets) -> static JSON for the website.
原则：只做类型归一与关联，不改写任何原文；金额/日期解析失败一律保留原文并置 null。
"""
import json, re, os, datetime
import openpyxl

SRC = r"C:\Users\someb\Desktop\常规化退市中小投资者赔偿研究\退市投资者赔偿主数据库2026.11.14.xlsx"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(OUT, exist_ok=True)

wb = openpyxl.load_workbook(SRC, data_only=True)


def sheet_rows(name):
    ws = wb[name]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    # 找到表头行：包含指定数量非空且像字段名的行
    return rows


def table(name, header_row_idx=2):
    rows = sheet_rows(name)
    hdr = [str(x).strip() if x is not None else "" for x in rows[header_row_idx]]
    data = []
    for r in rows[header_row_idx + 1:]:
        if not any(v is not None and str(v).strip() != "" for v in r):
            continue
        d = {}
        for i, h in enumerate(hdr):
            if not h:
                continue
            v = r[i] if i < len(r) else None
            d[h] = v
        data.append(d)
    return hdr, data


def clean(v):
    if v is None:
        return None
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d") if v.time() == datetime.time(0, 0) else v.strftime("%Y-%m-%d %H:%M")
    if isinstance(v, datetime.date):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        return int(v)
    s = str(v).strip()
    if s in ("", "—", "-", "暂无", "nan", "None"):
        return "" if s == "" else None
    return s


def dt(v):
    try:
        f = float(str(v).strip())
        if 20000 < f < 80000:
            return (datetime.datetime(1899, 12, 30) + datetime.timedelta(days=f)).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        pass
    return clean(v)


def num(v):
    """解析中文金额/数字，失败返回 None。支持 1.78亿元 / 7,680 / 10.86亿 / 1,587万元。"""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace(",", "").replace("，", "").strip()
    m = re.search(r"(-?\d+(?:\.\d+)?)\s*(万亿|亿|万|千)?", s)
    if not m:
        return None
    x = float(m.group(1))
    unit = m.group(2)
    mul = {"万亿": 1e12, "亿": 1e8, "万": 1e4, "千": 1e3}.get(unit, 1)
    # 只有像金额的才接受
    return x * mul


def money_text(v):
    c = clean(v)
    if c is None:
        return None, None
    return c, num(c)


# ---------------- 01 companies ----------------
cols01 = ["Company_ID", "年度", "证券代码", "证券简称", "交易所/板块", "样本层级", "摘牌日", "摘牌日_精确",
          "退市大类_规范", "退市细类_规范", "交易类细分", "是否强制退市", "退市大类_原始", "退市细类_原始",
          "行政处罚状态", "处罚机关/文号/日期", "处罚日_精确", "主要违法或退市事实", "赔偿状态码", "赔偿状态说明",
          "关联Case_ID", "赔偿路径大类", "是否进入案件库", "适格投资者数", "投资者损失暴露_CNY",
          "诉争/请求金额_CNY", "法院/调解确认金额_CNY", "最终已验证实际回收_CNY", "首次已验证支付_CNY",
          "首次回收日期精度", "回收口径", "破产/重整状态", "数据截止日", "主要来源", "字段完整度",
          "PEU数据准备状态", "备注"]
h, raw01 = table("01_公司主表(203)")
companies = []
for r in raw01:
    def g(k):
        return clean(r.get(k))
    code = str(g("证券代码") or "").zfill(6)
    rec = {
        "id": g("Company_ID") or "",
        "year": int(g("年度")) if str(g("年度") or "").isdigit() else None,
        "code": code,
        "name": g("证券简称") or "",
        "board": g("交易所/板块") or "",
        "tier": g("样本层级") or "",
        "delistDate": g("摘牌日") or "",
        "delistDateExact": g("摘牌日_精确") or "",
        "category": g("退市大类_规范") or "",
        "subtype": g("退市细类_规范") or "",
        "tradeSub": g("交易类细分") or "",
        "mandatory": g("是否强制退市") or "",
        "rawCategory": g("退市大类_原始") or "",
        "rawSubtype": g("退市细类_原始") or "",
        "penaltyStatus": g("行政处罚状态") or "",
        "penaltyAuthority": g("处罚机关/文号/日期") or "",
        "penaltyDate": g("处罚日_精确") or "",
        "fact": g("主要违法或退市事实") or "",
        "status": g("赔偿状态码") or "",
        "statusNote": g("赔偿状态说明") or "",
        "caseId": g("关联Case_ID") or "",
        "path": g("赔偿路径大类") or "",
        "inCaseDb": g("是否进入案件库") or "",
        "investors": g("适格投资者数") or "",
        "loss": g("投资者损失暴露_CNY") or "",
        "claim": g("诉争/请求金额_CNY") or "",
        "award": g("法院/调解确认金额_CNY") or "",
        "recovery": g("最终已验证实际回收_CNY") or "",
        "firstPay": g("首次已验证支付_CNY") or "",
        "firstDatePrecision": g("首次回收日期精度") or "",
        "recoveryBasis": g("回收口径") or "",
        "bankruptcy": g("破产/重整状态") or "",
        "asOf": g("数据截止日") or "",
        "source": g("主要来源") or "",
        "completeness": (num(g("字段完整度")) if re.fullmatch(r"[\d\.]+", str(g("字段完整度") or "").strip()) else None),
        "completenessRaw": g("字段完整度") or "",
        "peuStatus": g("PEU数据准备状态") or "",
        "note": g("备注") or "",
    }
    for k, field in [("loss", "lossN"), ("claim", "claimN"), ("award", "awardN"),
                     ("recovery", "recoveryN"), ("firstPay", "firstPayN")]:
        _, n = money_text(rec[k])
        rec[field] = n
    rec["investorsN"] = num(rec["investors"]) if re.fullmatch(r"[\d,\.]+", str(rec["investors"]).replace(",", "")) else None
    companies.append(rec)

# ---------------- 02 cases ----------------
_, raw02 = table("02_赔偿案件主表(71)")
cases = []
for r in raw02:
    def g(k):
        return clean(r.get(k))
    rec = {
        "id": g("Case_ID") or "",
        "companyId": g("Company_ID") or "",
        "code": str(g("证券代码") or "").zfill(6),
        "name": g("证券简称") or "",
        "version": g("数据来源版本") or "",
        "penalty": g("行政处罚/处理") or "",
        "path": g("赔偿/救济路径") or "",
        "court": g("受理法院") or "",
        "docNo": g("案号/文书") or "",
        "scope": g("索赔区间（权利人范围）") or "",
        "parties": g("适格/涉案人数") or "",
        "claim": g("诉争金额") or "",
        "award": g("判赔/赔付金额") or "",
        "liability": g("责任分担") or "",
        "duration": g("时间周期") or "",
        "execution": g("执行/到账情况") or "",
        "status": g("状态码") or "",
        "statusV1": g("状态码_v1(2024-01-01)") or "",
        "tier": g("样本层级") or "",
        "inComparison": g("是否计入主样本路径比较") or "",
        "completion": g("赔付完成度") or "",
        "source": g("数据来源（URL/媒体）") or "",
        "note": g("口径备注/审核标记") or "",
        "asOf": g("状态观察截止日") or "",
    }
    for k, field in [("claim", "claimN"), ("award", "awardN")]:
        _, n = money_text(rec[k])
        rec[field] = n
    rec["partiesN"] = num(rec["parties"]) if re.search(r"\d", str(rec["parties"])) and re.search(r"名|人|户", str(rec["parties"])) else None
    cases.append(rec)

case_by_id = {c["id"]: c for c in cases}
case_by_code = {}
for c in cases:
    case_by_code.setdefault(c["code"], []).append(c)

# 关联公司：以 caseId 或 code 匹配
for co in companies:
    related = []
    if co["caseId"]:
        for cid in re.split(r"[;；,，\s]+", co["caseId"]):
            if cid in case_by_id:
                related.append(case_by_id[cid])
    if not related and co["code"] in case_by_code:
        related = case_by_code[co["code"]]
    co["cases"] = [c["id"] for c in related]

# ---------------- 03 parties ----------------
_, raw03 = table("03_责任主体")
parties = []
for r in raw03:
    def g(k):
        return clean(r.get(k))
    parties.append({
        "companyId": g("Company_ID") or "",
        "caseId": g("Case_ID") or "",
        "code": str(g("证券代码") or "").zfill(6),
        "name": g("证券简称") or "",
        "issuer": g("发行人责任") or "",
        "controller": g("实控人/控股股东责任") or "",
        "executives": g("董监高责任") or "",
        "underwriter": g("保荐/承销中介责任") or "",
        "accountant": g("会计师事务所责任") or "",
        "lawyer": g("律师事务所责任") or "",
        "other": g("其他第三方责任") or "",
        "clarity": num(g("责任清晰度_0-3")),
        "summary": g("责任原文摘要") or "",
        "source": g("来源") or "",
    })

# ---------------- 05 timeline ----------------
_, raw05 = table("05_救济时间轴")
events = []
for r in raw05:
    def g(k):
        return clean(r.get(k))
    events.append({
        "id": g("Event_ID") or "",
        "caseId": g("Case_ID") or "",
        "companyId": g("Company_ID") or "",
        "code": str(g("证券代码") or "").zfill(6),
        "name": g("证券简称") or "",
        "type": g("事件类型") or "",
        "date": dt(g("事件日期")) or "",
        "lower": dt(g("日期下限")) or "",
        "upper": dt(g("日期上限")) or "",
        "precision": g("日期精度") or "",
        "anchor": dt(g("起算事件日期")) or "",
        "anchorBasis": g("起算依据") or "",
        "meaning": g("事件含义") or "",
        "forSurvival": g("是否用于生存分析") or "",
        "source": g("来源") or "",
        "note": g("备注") or "",
    })

# ---------------- 06 survival ----------------
_, raw06 = table("06_生存分析输入")
survival = []
for r in raw06:
    def g(k):
        return clean(r.get(k))
    survival.append({
        "caseId": g("Case_ID") or "",
        "companyId": g("Company_ID") or "",
        "code": str(g("证券代码") or "").zfill(6),
        "name": g("证券简称") or "",
        "path": g("路径大类") or "",
        "start": dt(g("起算日")) or "",
        "startBasis": g("起算依据") or "",
        "eventLower": dt(g("事件下限")) or "",
        "eventUpper": dt(g("事件上限")) or "",
        "precision": g("事件精度") or "",
        "asOf": dt(g("观察截止日")) or "",
        "event": int(g("是否发生实际回收事件") or 0),
        "censorReason": g("删失原因") or "",
        "kmUsable": g("KM可用") or "",
        "source": g("来源") or "",
        "note": g("说明") or "",
        "daysCons": num(g("保守持续天数")),
        "daysOpt": num(g("乐观持续天数")),
        "monthsCons": num(g("保守持续月数")),
        "monthsOpt": num(g("乐观持续月数")),
    })

# KM (Kaplan-Meier, 保守口径)
obs = [s for s in survival if s["kmUsable"] == "是" and s["daysCons"] is not None]
obs.sort(key=lambda x: x["daysCons"])
n_total = len(obs)
km_points = [[0, 1.0]]
s_val = 1.0
i = 0
event_times = []
while i < len(obs):
    t = obs[i]["daysCons"]
    at_risk = sum(1 for o in obs if o["daysCons"] >= t)
    d = sum(1 for o in obs if o["daysCons"] == t and o["event"] == 1)
    if d > 0 and at_risk > 0:
        s_val *= (1 - d / at_risk)
        event_times.append({"t": t, "s": round(s_val, 4), "d": d, "atRisk": at_risk})
        km_points.append([t, round(s_val, 4)])
    i += 1
censors = []
for o in obs:
    if o["event"] != 1:
        ss = 1.0
        for st in event_times:
            if st["t"] <= o["daysCons"]:
                ss = st["s"]
        censors.append([o["daysCons"], round(ss, 4)])
km = {
    "n": n_total,
    "events": sum(1 for o in obs if o["event"] == 1),
    "censored": sum(1 for o in obs if o["event"] != 1),
    "points": km_points,
    "steps": event_times,
    "censors": censors,
    "maxDays": max(o["daysCons"] for o in obs) if obs else None,
    "medianReached": event_times[-1]["s"] <= 0.5 if event_times else False,
}

# ---------------- 07 PEU ----------------
_, raw07 = table("07_PEU测算")
peu = []
for r in raw07:
    def g(k):
        return clean(r.get(k))
    peu.append({
        "companyId": g("Company_ID") or "",
        "code": str(g("证券代码") or "").zfill(6),
        "name": g("证券简称") or "",
        "caseId": g("Case_ID") or "",
        "status": g("状态码") or "",
        "loss": g("投资者损失暴露_CNY") or "",
        "propertyBase": g("基础可执行责任财产_CNY") or "",
        "peuBase": g("PEU基础值_CNY") or "",
        "ceiling": g("资产天花板_CNY") or "",
        "recovery": g("最终已验证实际回收_CNY") or "",
        "gap": g("制度兑现缺口_CNY") or "",
        "peuLoss": g("PEU/损失") or "",
        "recoveryLoss": g("实际回收/损失") or "",
        "statusPeu": g("PEU数据准备状态") or "",
        "calcNote": g("计算说明") or "",
        "valueLost": g("赔付兑现链价值缺失_CNY") or "",
        "valueLostRate": g("兑现链价值缺失率") or "",
        "comparability": g("金额口径可比性") or "",
    })

# ---------------- 08 regulations ----------------
_, raw08 = table("08_法规政策")
regs = []
for r in raw08:
    def g(k):
        return clean(r.get(k))
    regs.append({
        "level": g("层级") or "",
        "name": g("名称") or "",
        "issuer": g("文号/发布机关") or "",
        "date": g("公布/施行日期") or "",
        "content": g("核心内容（与退市及赔偿路径关系）") or "",
        "url": g("官方来源URL") or "",
        "local": g("本地存档") or "",
        "note": g("口径备注") or "",
        "nature": g("记录性质") or "",
        "version": g("数据来源版本") or "",
    })

# ---------------- 09 source ledger ----------------
_, raw09 = table("09_来源台账")
sources = []
for r in raw09:
    def g(k):
        return clean(r.get(k))
    sources.append({
        "no": g("序号") or "",
        "type": g("来源类型") or "",
        "name": g("名称/文件") or "",
        "publisher": g("发布机构/媒体") or "",
        "date": g("发布日期") or "",
        "url": g("URL或本地路径") or "",
        "usage": g("用途") or "",
        "version": g("来源版本") or "",
    })

# ---------------- 10 UGC ----------------
_, raw10 = table("10_投资者自述与视频")
ugc = []
for r in raw10:
    def g(k):
        return clean(r.get(k))
    ugc.append({
        "no": g("序号") or "",
        "platform": g("平台") or "",
        "target": g("标的") or "",
        "title": g("标题/内容摘要") or "",
        "date": g("日期") or "",
        "url": g("URL") or "",
        "author": g("作者/网名") or "",
        "claim": g("主张/状态") or "",
        "excerpt": g("原文摘要") or "",
        "amount": g("涉及金额") or "",
        "cross": g("官方/交叉核验") or "",
        "reliability": g("可靠性") or "",
        "insight": g("研究用途/反映问题") or "",
    })

# ---------------- 11 paths ----------------
_, raw11 = table("11_路径实效对比")
paths = []
for r in raw11:
    def g(k):
        return clean(r.get(k))
    paths.append({
        "path": g("赔偿路径") or "",
        "cases": g("2022-2026代表案例") or "",
        "tier": g("样本层级") or "",
        "scale": g("规模与金额") or "",
        "cycle": g("周期") or "",
        "result": g("实际获赔/结果") or "",
        "variables": g("核心实效变量") or "",
        "limits": g("适用条件/局限") or "",
        "evidence": g("证据基准") or "",
        "note": g("备注") or "",
    })

# ---------------- 12 yearly ----------------
_, raw12 = table("12_年度结构")
yearly = []
for r in raw12:
    def g(k):
        return clean(r.get(k))
    yearly.append({
        "year": int(g("年度")) if str(g("年度") or "").isdigit() else None,
        "aShare": num(g("纯A股退市家数（主口径）")),
        "withB": num(g("含B股家数")),
        "trade": num(g("交易类")),
        "finance": num(g("财务类")),
        "norm": num(g("规范类")),
        "major": num(g("重大违法类")),
        "active": num(g("主动退市")),
        "restructure": num(g("重组退市")),
        "other": num(g("其他强制退市")),
        "feature": g("当年结构特征") or "",
        "external": g("外部口径备注") or "",
        "state": g("数据状态") or "",
    })

# ---------------- 13 dictionary ----------------
_, raw13 = table("13_口径字典")
dictionary = []
for r in raw13:
    def g(k):
        return clean(r.get(k))
    dictionary.append({
        "term": g("字段/概念") or "",
        "value": g("标准值") or "",
        "definition": g("定义") or "",
        "usage": g("统计用途") or "",
        "caveat": g("排除/注意") or "",
        "note": g("备注") or "",
    })

# ---------------- 14 audit ----------------
_, raw14 = table("14_数据质量审计")
audit = []
for r in raw14:
    def g(k):
        return clean(r.get(k))
    audit.append({
        "id": g("ID") or "",
        "level": g("级别") or "",
        "sheet": g("工作表") or "",
        "loc": g("定位") or "",
        "issue": g("问题/发现") or "",
        "fix": g("处理") or "",
        "basis": g("依据/说明") or "",
        "blocking": g("是否阻断统计") or "",
        "state": g("状态") or "",
        "newLoc": g("新表定位") or "",
    })

# ---------------- 15 completeness ----------------
_, raw15 = table("15_数据完整度")
completeness = []
for r in raw15:
    def g(k):
        return clean(r.get(k))
    completeness.append({
        "metric": g("指标") or "",
        "count": num(g("数量")),
        "countText": g("数量") or "",
        "explain": g("解释") or "",
        "sheet": g("对应表") or "",
    })

# ---------------- 16 dashboard ----------------
_, raw16 = table("16_研究仪表板")
dashboard = []
for r in raw16:
    def g(k):
        return clean(r.get(k))
    dashboard.append({
        "metric": g("指标") or "",
        "value": g("数值") or "",
        "note": g("说明") or "",
        "sheet": g("对应表") or "",
    })

# ---------------- 00 meta ----------------
_, raw00 = table("00_说明与版本", header_row_idx=2)
meta_rows = []
for r in raw00:
    vals = [clean(v) for v in r if v is not None]
    if len(vals) >= 2:
        meta_rows.append({"key": vals[0], "value": "".join(str(x) for x in vals[1:])})
meta = dict((m["key"], m["value"]) for m in meta_rows if m["key"])

# ---------------- stats ----------------
def counter(arr, key):
    c = {}
    for x in arr:
        v = x.get(key) or "未标注"
        c[v] = c.get(v, 0) + 1
    return dict(sorted(c.items(), key=lambda kv: -kv[1]))

companies_valid = [c for c in companies if c["id"]]
cases_valid = [c for c in cases if c["id"]]

status_dict = {
    "A": {"label": "已实际赔付", "short": "已到账", "color": "#35E0A1",
          "def": "已有资金实际到账证据；不表示必然100%覆盖全部适格投资者"},
    "B": {"label": "生效裁判/调解", "short": "已定案", "color": "#38BDF8",
          "def": "已有生效判决或调解，执行/到账可能仍不完整"},
    "C": {"label": "已受理/在审", "short": "在审", "color": "#818CF8",
          "def": "有法院受理/审理依据，尚无生效赔偿结果"},
    "D": {"label": "征集/立案未确认", "short": "征集中", "color": "#A78BFA",
          "def": "仅律师征集、材料递交或已立案但尚无充分公开受理/生效证据"},
    "E": {"label": "破产程序清偿", "short": "破产", "color": "#F59E0B",
          "def": "证券赔偿债权在破产程序中申报/清偿"},
    "F": {"label": "救济受阻", "short": "受阻", "color": "#FB7185",
          "def": "不予受理、实体败诉、诉讼时效届满等导致救济通道关闭"},
    "N": {"label": "未检出有效救济", "short": "未检出", "color": "#64748B",
          "def": "截至观察日无行政处罚支撑且未检出有效赔偿救济；不等于绝对不存在"},
    "R": {"label": "重组/主动退市", "short": "不涉赔偿", "color": "#94A3B8",
          "def": "换股、现金选择权、转板、吸收合并等权益安排，非证券赔偿路径"},
    "U": {"label": "待核/未确认", "short": "待核", "color": "#CBD5E1",
          "def": "公开渠道未能确认是否存在有效救济或进展，区别于N"},
}

stats = {
    "companies": len(companies_valid),
    "companiesMain": sum(1 for c in companies_valid if c["tier"] == "纯A股主样本"),
    "companiesB": sum(1 for c in companies_valid if "B股" in c["tier"]),
    "cases": len(cases_valid),
    "casesA": sum(1 for c in cases_valid if c["status"] == "A"),
    "casesB": sum(1 for c in cases_valid if c["status"] == "B"),
    "casesC": sum(1 for c in cases_valid if c["status"] == "C"),
    "casesD": sum(1 for c in cases_valid if c["status"] == "D"),
    "casesU": sum(1 for c in cases_valid if c["status"] == "U"),
    "casesLinked": sum(1 for c in companies_valid if c["cases"]),
    "parties": len([p for p in parties if p["caseId"]]),
    "events": len([e for e in events if e["caseId"]]),
    "survival": km["n"],
    "recoveryEvents": km["events"],
    "sources": len([s for s in sources if s["name"]]),
    "regs": len([r for r in regs if r["name"]]),
    "ugc": len([u for u in ugc if u["target"]]),
    "peuReady": sum(1 for p in peu if p["calcNote"] and "待采集" not in (p["statusPeu"] or "")),
    "statusDist": counter(companies_valid, "status"),
    "categoryDist": counter(companies_valid, "category"),
    "subtypeDist": counter(companies_valid, "subtype"),
    "boardDist": counter(companies_valid, "board"),
    "yearDist": counter(companies_valid, "year"),
    "caseStatusDist": counter(cases_valid, "status"),
    "casePathDist": counter(cases_valid, "path"),
    "recoveryTotal": sum(c["recoveryN"] or 0 for c in companies_valid),
    "recoveryKnown": sum(1 for c in companies_valid if c["recovery"]),
    "recoveryZero": sum(1 for c in companies_valid if c["recovery"] and not c["recoveryN"]),
    "firstPayTotal": sum(c["firstPayN"] or 0 for c in companies_valid),
    "amountCoverage": {
        "withFinal": sum(1 for c in companies_valid if c["recoveryN"]),
        "withLoss": sum(1 for c in companies_valid if c["lossN"]),
        "withAward": sum(1 for c in companies_valid if c["awardN"]),
        "withClaim": sum(1 for c in companies_valid if c["claimN"]),
    },
}

payload = {
    "meta": meta,
    "stats": stats,
    "statusDict": status_dict,
    "companies": companies_valid,
    "cases": cases_valid,
    "parties": parties,
    "events": events,
    "survival": survival,
    "km": km,
    "peu": peu,
    "regs": regs,
    "sources": sources,
    "ugc": ugc,
    "paths": paths,
    "yearly": yearly,
    "dictionary": dictionary,
    "audit": audit,
    "completeness": completeness,
    "dashboard": dashboard,
    "generatedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
}

for k in ["companies", "cases", "parties", "events", "survival", "peu", "regs", "sources", "ugc", "paths", "yearly", "dictionary", "audit", "completeness", "dashboard"]:
    with open(os.path.join(OUT, k + ".json"), "w", encoding="utf-8") as f:
        json.dump(payload[k], f, ensure_ascii=False, separators=(",", ":"))

with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as f:
    json.dump({k: payload[k] for k in ["meta", "stats", "statusDict", "km", "generatedAt"]}, f, ensure_ascii=False, indent=1)

sizes = {k: os.path.getsize(os.path.join(OUT, k + ".json")) for k in ["companies", "cases", "parties", "events", "survival", "peu", "regs", "sources", "ugc", "paths", "yearly", "dictionary", "audit", "completeness", "dashboard", "meta"]}
print(json.dumps(sizes, ensure_ascii=False, indent=1))
print("companies", len(companies_valid), "cases", len(cases_valid), "parties", len(parties), "events", len(events))
print("km", km["n"], km["events"], km["censored"], "medianReached", km["medianReached"])
print("statusDist", stats["statusDist"])
print("caseStatusDist", stats["caseStatusDist"])
print("yearDist", stats["yearDist"])
print("recoveryTotal", stats["recoveryTotal"])
