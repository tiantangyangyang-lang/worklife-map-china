---
id: PRD-XXXX
title: <一句话功能名>
status: draft        # draft | ready | in-progress | done
owner: <负责人>
branch: feat/PRD-XXXX-<slug>
created: YYYY-MM-DD
---

## 1. 背景 / 目标
为什么做、解决什么问题、对用户的价值。1–3 句。

## 2. 范围
**做 (In scope)**
- …

**不做 (Out of scope)**
- …

## 3. 数据与字段
涉及的数据来源、字段、格式。若改 `CompanyRecord`/Excel 列/数据库，列清楚。

## 4. 方案要点
关键设计决策、依赖、与现有模块的衔接。避免大改，优先最小 diff。

## 5. 验收标准 (可执行)
- [ ] `make typecheck` / `make verify` 通过
- [ ] 具体可观察行为：例如"详情页出现 X，点击跳转 Y"
- [ ] …

## 6. 涉及文件
- `src/...`
- …

## 7. 风险 / 回滚
风险点、对生产数据/部署的影响、如何回滚。
