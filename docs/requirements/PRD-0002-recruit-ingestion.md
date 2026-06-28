---
id: PRD-0002
title: 招聘站数据入库程序 (DeepSeek 提取作息信号)
status: done
owner: TBD
branch: feat/PRD-0002-recruit-ingestion
created: 2026-06-27
---

## 1. 背景 / 目标
扩充数据底库：从招聘站**公开职位页**提取作息信号（955/996/大小周/单休、上下班时间、
一周工作天数），`source_url` = 该职位页 URL，可在详情页点击跳转作为证据。
脏活（非结构化文本 → 结构化字段）交给 DeepSeek，人主要做难推理与质检。

## 2. 范围
**做**
- 一个离线脚本 `scripts/ingest-recruit.ts`：输入"职位页 URL + 抓到的公开正文文本"
  （或本地 HTML/JSON 文件），调用 DeepSeek 把正文抽成统一字段，输出明细表 Excel/JSON。
- 输出列对齐阶段2 已支持的 `recruit_detail` 字段（见 `docs/EXCEL_IMPORT.md`）。
- DeepSeek 调用读 `DEEPSEEK_API_KEY`（`.env.local`），失败可重试、可批量。
- 产出文件可直接走现有"上传数据"流程入库。

**不做**
- ❌ 不写绕验证码 / 模拟登录 / 批量小号的爬虫。
- ❌ 不采集简历、手机号、HR 联系方式、聊天内容等隐私数据。
- 抓取由用户在合规前提下提供公开页正文；脚本只负责"正文 → 结构化"。

## 3. 数据与字段
DeepSeek 输出 JSON schema（每条）：
`company_name, city, department?, job_title?, work_system, weekend_type,
work_begin?, work_end?, workdays?, evidence_text, source_platform, source_url, confidence, collected_at`
- `source_platform` 例：`BOSS直聘 / 51job / 智联招聘`
- `source_url` = 职位页 URL（必填，作为证据）
- `confidence`：招聘页明确写作息 → B；需推断 → C

## 4. 方案要点
- 用 DeepSeek `chat/completions`（OpenAI 兼容，base `https://api.deepseek.com`），
  `response_format: json_object`，prompt 给定 schema + 抽取规则 + few-shot。
- 抽取后做本地校验（字段白名单、URL sanitize、城市归一）再写 Excel。
- 复用现有 `parseDetailTable` 的列名，确保上传即识别。

## 5. 验收标准 (可执行)
- [ ] `DEEPSEEK_API_KEY=... bun run scripts/ingest-recruit.ts <输入>` 产出 `.xlsx`
- [ ] 产出文件经"上传数据"导入后，详情页显示岗位 + 作息时间 + 可点击"查看来源页"
- [ ] 无 key 时给出清晰报错，不崩溃
- [ ] `make verify` 通过

## 6. 涉及文件
- 新增 `scripts/ingest-recruit.ts`
- 可能新增 `src/lib/deepseek.ts`（API 封装）
- 文档：`docs/EXCEL_IMPORT.md` 补充招聘列说明

## 7. 风险 / 回滚
- 合规：仅处理用户提供的公开页正文，脚本内注释声明用途。
- 成本：DeepSeek 按量计费，脚本加 `--limit` 控制批量。
- 数据质量：DeepSeek 误判 → confidence 标低 + 保留原文 evidence_text 供人工复核。
