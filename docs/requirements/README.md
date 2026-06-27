# 需求与开发流程 (Requirements & Workflow)

本目录用"需求文档 (PRD)"管理功能，配合 Git 分支/PR 管理代码变更。
目标：**每个任务自包含、可在全新 AI 上下文中独立执行**，避免长对话触发上下文压缩。

## 三件套

| 关注点 | 工具 | 入口 |
|--------|------|------|
| 功能需求 | PRD 文档 | `docs/requirements/PRD-XXXX-*.md` |
| 代码变更 | Git 分支 + PR | 每个 PRD 一个分支 `feat/PRD-XXXX-slug` |
| 项目命令 | Makefile | 根目录 `Makefile`（`make help`） |

## 工作流 (每个新任务都开新上下文)

1. 在 `BACKLOG.md` 选/加一条任务，写或更新对应 `PRD-XXXX`。
2. **开新的 AI 对话**，第一句只给：`实现 docs/requirements/PRD-XXXX-*.md`。
3. AI 按 PRD 的"验收标准"实现 → `make verify` 自检 → 开分支提交。
4. 推分支、开 PR（需先配 GitHub remote，见下）。PR 描述引用 PRD 编号。
5. 合并后在 `BACKLOG.md` 把该条标记为 ✅，PRD 顶部 `status: done`。

## PRD 编写要求

- 用 `TEMPLATE.md` 起草。每个 PRD 必须包含：**背景 / 范围(做与不做) / 数据与字段 / 验收标准 / 涉及文件 / 风险**。
- 验收标准要可执行（命令、可观察的页面行为），不要写"优化体验"这种空话。
- 一个 PRD = 一个可独立合并的小变更。过大就拆成多个 PRD。

## Git / PR 约定

- 分支命名：`feat/PRD-0001-product-linkage`、`fix/...`、`chore/...`
- Conventional Commits；PR 标题含 PRD 编号。
- ⚠️ 当前仓库**尚未配置 GitHub remote**，无法开真正的 PR。需先创建远端（见 BACKLOG 的 PRD-0000）。在此之前，变更走"分支 + 本地合并"过渡。

## 密钥

所有密钥放 `.env.local`（已 gitignore），样例见 `.env.example`。**绝不**提交真实密钥。
