# 退市到账 · DELISTING LEDGER

A股退市中小投资者赔偿兑现链数据平台 —— 把一笔损失从 **法律确认（L）** 追到 **可执行容量（PEU）**，再到 **实际到账（R）**。

> 项目：退市赔偿，钱到账了吗？——A股退市下中小投资者赔偿兑现过程与实效研究
> 团队：华东政法大学「四象求真队」｜第二十届“挑战杯”校内孵化赛
> 数据版本：v3.0 合并去重版｜统一观察截止 **2026-11-14**

---

## 这是什么

一个纯静态、可直接部署到 GitHub Pages 的研究数据平台，包含：

- **退市公司全景库**：203 行公司主表（199 家纯 A 股 + 4 只 B 股并列），支持年度 / 板块 / 退市类型 / 赔偿状态交叉筛选、即时检索、CSV 导出。
- **公司赔偿档案**：退市与处罚、赔偿结果、关联案件、责任主体、救济时间轴、字段完整度，以及巨潮 / 东财 / 同花顺 / 财联社 / 裁判文书网 / 破产网等外部核查入口。
- **赔偿案件主表**：71 条唯一案件（v1 45 + v2 47 − 重复 21），状态码严格区分“已到账 / 已定案 / 在审 / 征集 / 破产 / 受阻 / 未检出 / 不涉赔偿 / 待核”。
- **兑现链透视**：L、PEU、R 三个量的定义、缺口分解，以及**如实展示**的数据就绪度（责任财产 1,950 行骨架、金额采集 0 条 → PEU 暂不可计算）。
- **路径实效对比**：8 条救济路径的覆盖、周期、结果、约束条件与证据基准。
- **时间与生存**：52 条 KM 可用案件、5 个回收事件、47 条右删失，描述性 KM 曲线与 57 条事件时间轴。
- **法规政策**：24 条与退市赔偿直接相关的法规、司法解释与监管文件，附官方原文链接。
- **数据源与证据分级**：87 条来源台账、高/中/低三级规则、官方与财经数据门户聚合。

## 技术栈

- 原生 ES Modules + 手写设计系统，无前端框架、无构建步骤。
- ECharts 5.6（本地 vendor，避免 CDN 不可达）。
- 数据由 `tools/etl.py` 从 16 张表的 Excel 主数据库生成静态 JSON。
- 路由使用 hash（`#/companies`），因此 GitHub Pages 无需任何服务端配置。

```
index.html
assets/css/main.css
assets/js/app.js      # 启动、路由、光标、粒子、行情、检索
assets/js/views.js    # 各页面渲染与交互
assets/js/charts.js   # ECharts 主题与图表
assets/js/data.js     # 数据加载、格式化、外部核查链接
data/*.json           # 由 Excel 生成的结构化数据
tools/etl.py          # Excel → JSON（保留原文与观察截止日）
vendor/echarts.min.js
```

## 本地预览

```powershell
# 任选其一
python -m http.server 8899
# 或
npx serve .
```

然后打开 <http://127.0.0.1:8899/>。**不要直接双击 index.html**：浏览器会因 `file://` 的 CORS 限制而无法加载 `data/*.json`。

## 重新生成数据

`tools/etl.py` 顶部 `SRC` 指向本地 Excel 主数据库：

```powershell
python tools/etl.py
```

原则：只做类型归一与关联，不改写任何原文；金额 / 日期解析失败一律保留原文并置 `null`，前端显示为“— / 待核实”。

## 部署到 GitHub Pages

### 方式 A：一键脚本（推荐）

1. 在 GitHub 生成一个 **Fine-grained personal access token**：
   - Repository access：All repositories（或先手动建空仓库再只授权该仓库）
   - Permissions：`Contents: Read and write`、`Pages: Read and write`、`Administration: Read and write`（用于自动建仓）
2. 运行：

```powershell
$env:GITHUB_TOKEN = "github_pat_xxx"
.\deploy.ps1 -User 你的GitHub用户名 -Repo delisting-ledger
```

脚本会：建仓（若不存在）→ 推送 `main` → 开启 Pages → 输出访问地址。

### 方式 B：手动

1. 在 GitHub 新建 public 仓库（不要勾选 README）。
2. 本地执行：

```powershell
git init
git add -A
git commit -m "feat: 退市到账数据平台 v1"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

3. 仓库 **Settings → Pages → Build and deployment**：Source 选 `Deploy from a branch`，Branch 选 `main` / `/ (root)`，保存。
4. 等待 1–2 分钟，访问 `https://<user>.github.io/<repo>/`。

## 数据口径与免责声明

- 本站为大学生课外学术科技作品的研究展示平台，**不构成投资建议、法律意见或赔偿预测**。
- 所有金额与状态以官方原始文书为准；空白字段表示尚未完成核验，**不以推测填充**。
- 公司数 / 案件数 / 责任主体数 / 投资者数分列统计，不混用；U 与 N、C 与 B、确认债权与实际受偿不得混用。
- v1-only 记录保留 2024-01-01 观察截止日，不冒充 2026 年进展；2026 年为未完结年度。
- 万得（Wind）、同花顺 iFinD 等为商业授权终端，本站**不镜像其数据**，仅提供字段对接规范与检索指引。
- 引用格式：四象求真队《退市投资者赔偿主数据库 v3.0》，观察截止 2026-11-14。

## 许可

- 代码：MIT
- 数据与图表：CC BY-NC 4.0（署名—非商业性使用）
