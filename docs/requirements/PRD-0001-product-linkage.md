---
id: PRD-0001
title: 产品挂钩 — 公司 ↔ 品牌/产品 (双休购式)
status: draft
owner: TBD
branch: feat/PRD-0001-product-linkage
created: 2026-06-27
---

## 1. 背景 / 目标
让用户"用钱包投票"：看到一家公司的作息后，能知道它旗下的**品牌/产品**，
从而优先支持作息友好（955/双休）公司的产品。参考 `daxian-w/dx-sxgo`（双休购）。

## 2. 范围
**做**
- 数据层：为公司增加品牌/产品关联（`brands: { name, category?, url? }[]`）。
- 详情页：公司卡片展示"旗下品牌/产品"区块（含可点链接）。
- （可选）筛选/榜单：按"作息友好且有产品"筛选，做一个"良心消费"列表。

**不做**
- 不做电商交易/比价/下单，只做信息展示与跳转。
- 不强行给所有公司补全产品（缺失即不显示）。

## 3. 数据与字段
- `CompanyRecord` 增加可选 `brands?: Array<{ name: string; category?: string; url?: string }>`。
- Excel 明细表新增列：`品牌/产品`（多个用 `|` 分隔），可带超链接作为 `url`。
- 服务端 import 白名单 + URL sanitize（复用 `sanitizeUrl`）。

## 4. 方案要点
- 沿用阶段2 的"明细表列名驱动"模式，新增 `brands` 列别名到 `buildHeaderMap`。
- 详情页在"招聘信息块"下方加"旗下品牌/产品"卡片。
- 品牌数据来源：先人工整理头部公司；后续可由 PRD-0002 的提取流程顺带产出。

## 5. 验收标准 (可执行)
- [ ] 含"品牌/产品"列的 Excel 导入后，详情页展示品牌列表
- [ ] 品牌带链接的可点击跳转
- [ ] 无品牌数据的公司不显示该区块，老数据不报错
- [ ] `make verify` 通过

## 6. 涉及文件
- `src/lib/types.ts`（`brands` 字段）
- `src/lib/normalize.ts`（解析品牌列）
- `src/app/api/admin/import/route.ts`（白名单 + sanitize）
- `src/components/CityDetail.tsx`（展示区块）
- `scripts/generate-sample-template.ts`（样例加品牌列）

## 7. 风险 / 回滚
- 品牌↔公司映射可能有歧义（同名/子公司）：先只做显式 Excel 映射，不做自动推断。
- 纯展示功能，回滚 = 还原上述文件。
