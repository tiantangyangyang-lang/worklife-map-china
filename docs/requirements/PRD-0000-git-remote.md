---
id: PRD-0000
title: 配置 GitHub remote 并启用 PR 流程
status: done
owner: TBD
branch: chore/PRD-0000-git-remote
created: 2026-06-27
---

## 1. 背景 / 目标
当前仓库无 GitHub remote，无法开真正的 PR，代码变更只能直推本地 main。
配置远端后，后续 PRD 才能走"分支 → PR → 合并"流程。

## 2. 范围
**做**
- 创建 GitHub 仓库（名称建议 `worklife-map-china`）。
- `git remote add origin <url>`，推送 main 与现有提交历史。
- （可选）将 Vercel 项目连接到该 Git 仓库，实现 push 自动部署。

**不做**
- 不改动应用代码。
- 不在本 PRD 内迁移 issue / CI（另开 PRD）。

## 3. 待用户决策 (阻塞项)
- [ ] 仓库 **public 还是 private**？（公开会暴露全部代码与提交历史）
- [ ] 仓库名与所属账号/组织？
- [ ] 是否同时开启 Vercel Git 自动部署？

> ⚠️ 创建公开仓库 = 对外发布，须用户明确授权后才能执行。

## 4. 验收标准
- [ ] `git remote -v` 显示 origin
- [ ] `git push -u origin main` 成功，GitHub 上可见历史
- [ ] （若选）Vercel 项目 Settings → Git 显示已连接

## 5. 涉及文件
- 无代码改动；仅 git 配置 + 平台设置。

## 6. 风险 / 回滚
- 误设为 public 会泄露代码：创建前与用户二次确认可见性。
- `.env.local` 已 gitignore，不会被推送；推送前 `git status` 复核无密钥文件。
