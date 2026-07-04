# NPC Dialogue Design

Each NPC represents a company front‑desk (前台) or HR (HR). When a player
right‑clicks the NPC, Citizens will trigger the `/worklife company <company_id>`
command, which the server‑side `/worklife` command resolves to a chat message
showing the company’s work‑life schedule.

## Dialogue template

```
您好，我是 {company_name} 前台。
以下是该公司的作息信息：
• 工作制度：{work_system}
• 周末类型：{weekend_type}
• 强度等级：{intensity_level}
• 更新时间：{updated_at}

⚠️ 不同部门、岗位、城市可能不同，本信息仅供参考。
```

The placeholders are filled by the `/worklife` command implementation on the
backend. The disclaimer satisfies the project requirement.
