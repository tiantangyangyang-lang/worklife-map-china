# 优化建议 (OPTIMIZATION)

> 审查时间: 2026-06-27 · 审查范围: 代码与架构 / 功能与产品体验 / 路线图与优先级
> 当前代码版本: V3.1.1 (城市图 / 公司点位 / 2.5D / Supabase 公共数据均已落地, 约 7,400 行)

整体评价: 项目结构清晰、免责措辞克制、移动端与数据质量面板都已具备, 工程完成度高。下面按 **P0 (该先做) / P1 (中期) / P2 (锦上添花)** 给出可执行的优化点, 每条都标了对应文件。

---

## P0 — 地基类, 投入产出比最高

### 1. 给 `classify` / `normalize` 补单元测试 (当前 0 个测试)

项目的**核心价值就是把杂乱文本正确分类**, 而这部分恰恰一个测试都没有 (`find` 结果: 0 个 `.test.ts`)。`classify.ts` 里已经踩过 issue #1/#2/#3 三个坑 (Excel 日期数字误判、995 周末、加班兜底), 这些都应该固化成回归测试, 否则下次改规则很容易再次回归。

- 建议: 引入 `vitest`, 先覆盖 `classifyWorkSystem` / `classifyWeekendType` / `classifyRiskLevel` / `excelDateToString` / `splitCities`。
- 用例直接取自代码注释里的修复场景: `43556` 不应判成 965、`995` 应为双休+中强度、"高强度加班"不应默认单休、`"北京/上海"` 拆成两条、`remote` 被过滤。
- 加 `"test": "vitest"` 到 `package.json` scripts。

### 2. 消除 `classify.ts` 里的死代码与重复规则 (一处真 bug + 三套规则)

`classifyWorkSystem` 里这段计算了却**从未被使用**, 是误导性死代码:

```ts
const semanticTokens = raw.split(...).filter(tok => { ...; return true; }); // 结果丢弃
const safeText = raw.replace(/\b\d{4,}\b/g, ' ').replace(/(\d{4,})/g, ' '); // 两次 replace 等价, 冗余
```

更严重的是**同一套作息关键词规则被写了三遍**: `classifyWorkSystem`、`classifyWeekendType`、`detectWorkSystemKeywords`(供 `buildClassificationBasis` 用)。三处必须手动保持同步, 否则"分类结果"和"分类依据"会对不上。

- 建议: 抽出**单一事实来源** —— 一个 `matchWorkSystem(text)` 函数, 同时返回 `{ system, matchedKeywords }`。分类和"分类依据"都消费它的输出, 删掉重复正则和死代码。
- 顺带把规则做成**数据驱动**的表 (关键词 → 制度 → 强度), ROADMAP 已承诺"贡献者可改进分类规则", 数据化后贡献者改表即可, 不用碰逻辑。

### 3. `/api/admin/import` 信任客户端分类结果 + 非事务写入

两个隐患:

- **信任前端**: 接口把 `body.records` (客户端算好的分类) **原样写库**, 没有服务端二次校验/重算。密码一旦泄露, 任何人可注入任意 JSON, 也无法保证不同来源的分类一致。建议服务端从原始行重新跑 `normalize + classify`, 或至少做字段白名单 + 数量/体积上限校验。
- **先停用再插入不是原子操作** (`import/route.ts`): 先把所有 `is_active` 置 false, 再 insert。如果 insert 失败, 会出现**零个激活数据集**, 线上直接回退到预置示例。建议改为"先插入新行 → 成功后再停用旧行", 或封装成 Supabase RPC / 事务。

---

## P1 — 中期, 随数据量增长会变重要

### 4. `/api/dataset/latest` 单次返回全量 records, 且 `no-store`

现状: 接口一次性返回 `records + city_summary + geojson`, 且 `Cache-Control: no-store`。预置数据 371 条已经 **348KB**; 按路线图扩到 300+ 公司点位、再到数千条时, **每次打开网站都要重新下载整包, 无 CDN 缓存**, 首屏会明显变慢。

- 建议: 默认只返回 `city_summary` (24KB 级别) 渲染城市图; `records` / 公司点位按需 (按城市或分页) 懒加载。
- 版本轮询已有 `latest-meta` 接口, 可让客户端先比版本号, 命中则用本地缓存, 配合 `Cache-Control` + `ETag` 走 CDN。

### 5. 首页全 `'use client'` + `useEffect` 取数 → SSR/SEO/首屏均吃亏

`page.tsx` 整页客户端渲染, 数据在 `useEffect` 里 fetch。对一个**面向公众的数据可视化产品**, 这意味着没有 SSR、没有 `metadata`、搜索引擎抓不到内容、首屏白屏时间长。

- 建议: 把首屏数据集获取移到 Server Component (或 Next 的 `generateMetadata` + RSC), 地图等交互组件再用 `'use client'` 包裹。至少补上 `<head>` 的标题/描述/OG 卡片。

### 6. 类型与聚合里的冗余"兼容字段"是技术债

`types` / `aggregate.ts` 里同一个值有多个别名: `total` vs `total_records`、`count_high_count` vs `high_count`、`risk_score` vs `avg_intensity_score`、`risk_dominant` vs `dominant_level`。这些"V2.5 兼容字段"会让后续维护者困惑该用哪个。

- 建议: 收敛成一套命名, 用 codemod 一次性替换调用点, 删除别名。趁数据量还小、消费方还少时做最省事。

### 7. 公司点位 / 2.5D 的产品落地被"经纬度缺失"卡住

"公司点位地图"是宣传里的亮点, 但它依赖 Excel 里**已经填好 lng/lat**。实际数据大多只有城市级, 没有地理编码, 所以多数记录停在城市点。这是当前**产品价值与实现之间最大的落差**。

- 建议 (对应 ROADMAP V1.5): 接入高德/百度 Web 服务地理编码, 在 `import` 阶段对有地址无坐标的记录自动补 `lng/lat` (注意坐标系 GCJ02/WGS84 转换, `normalize.ts` 已有 `parseCoordSystem` 但没做实际投影换算 —— 确认 `projection.ts` 是否覆盖)。这一步能以较低成本把"城市图"真正升级成"公司图", 比先做招聘爬虫更划算。

---

## P2 — 体验增强

### 8. 产品维度可以更"可比"

数据 schema 里已有"部门/岗位", 但 UI 主要按城市+制度筛选。可补:

- **城市对比**: 选 2–3 个城市并排看强度分布 (ROADMAP V5 已列, 但成本低可提前)。
- **岗位/行业维度**: 把已有的部门/岗位字段做成筛选维度, 回答"哪些岗位 996 多"。
- **空状态/分享**: 筛选后无结果时给引导; 支持把当前筛选状态写进 URL, 方便分享某个城市/公司的视图。

### 9. 数据来源单向, 缺投稿闭环

目前只有管理员能上传, "公共数据"是单向的。ROADMAP V2.0 的投稿+审核是补全社区飞轮的关键, 但要把**防滥用和证据可验证性**放在功能丰富度之前 (与你 ROADMAP 的优先级原则一致)。

### 10. 杂项

- `page.tsx` footer 的 GitHub 链接是占位 `https://github.com`, 上线前替换成真实仓库地址。
- 顶部文案"V2 城市级 + 公司点位"与实际 V3.1.1 不一致, 多处版本号散落在组件里, 建议集中到一个常量。

---

## 关于路线图本身

`docs/ROADMAP.md` 已**与现状脱节**: 文档写"V1.0 当前版本", 但代码已是 V3.1.1, 而且 **2.5D (文档里的 V4.0 远期) 已经先于 V1.5 地理编码、V2.0 投稿做完了**。建议:

1. 先更新 ROADMAP 让它反映现实 (2.5D 已完成、当前真实版本号)。
2. 重排优先级, 建议顺序: **测试+分类数据化 (P0 地基) → 地理编码补全 (兑现公司点位) → 投稿与审核 (社区飞轮) → 招聘数据 (合规风险高, 靠后)**。
3. 招聘爬虫即使只用公开页, 合规与维护成本也最高, 建议明确放到最后或降级为"可选实验"。

---

## 建议的执行顺序 (一句话版)

先补测试和收敛分类规则 (保证不回归) → 加固 import 接口 → 拆分 dataset API 的数据传输 → 上地理编码兑现公司点位 → 再谈投稿和招聘。
