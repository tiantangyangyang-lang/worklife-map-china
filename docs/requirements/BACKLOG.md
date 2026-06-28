# 任务待办 (Backlog)

状态: ✅ 完成 · 🚧 进行中 · 📋 待开始 · 🧊 暂缓

| ID | 任务 | 状态 | PRD | 备注 |
|----|------|------|-----|------|
| — | 接通线上 Supabase + 修复上传 (env + publish_dataset id 类型) | ✅ | — | 已上线 (commit f6783b3 + DB migration) |
| — | 阶段1: 保留 Excel 链接 (公司官网 / 证据链接可点击) | ✅ | — | 已上线 (commit 4e68414) |
| — | 阶段2: 扩展招聘站字段 (部门/岗位/上下班/来源链接等) + 模板 | ✅ | — | 已上线 (commit 4e68414) |
| PRD-0000 | 配置 GitHub remote, 启用真正的 PR 流程 | ✅ | [PRD-0000](PRD-0000-git-remote.md) | private 仓库已建并推送 main |
| PRD-0001 | 产品挂钩 (公司 ↔ 品牌/产品, 双休购式) | 📋 | [PRD-0001](PRD-0001-product-linkage.md) | 参考 dx-sxgo |
| PRD-0002 | 招聘站数据入库程序 (DeepSeek 提取作息, 证据=职位页URL) | 📋 | [PRD-0002](PRD-0002-recruit-ingestion.md) | 仅公开页, 不绕反爬 |

## 优先级建议
1. **PRD-0000**（解锁 PR 流程，其它任务才好走 PR）
2. **PRD-0002**（扩数据底库，字段地基阶段2已就绪）
3. **PRD-0001**（产品挂钩，依赖一定的公司数据量）

## 数据源约束 (用户已确认)
- ❌ 跳过 `formulahendry/955.WLB`、`996icu/996.ICU`（已并入现有 371 条）
- ❌ 跳过 `Vonng/worktime`（无证据链接）
- ✅ 招聘站数据 `source_url` = 该职位公开页 URL
- ✅ 社交平台爆料只作低/中可信度投稿，人工摘录，不自动抓取
