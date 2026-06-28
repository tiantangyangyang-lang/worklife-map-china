# Vercel 部署指南

本项目是标准 Next.js 应用 (App Router), 客户端不直接连 Supabase, 所有 Supabase 访问都在服务端 API 里, 因此密钥不会暴露给浏览器。下面是部署到 Vercel 的完整步骤。

## 0. 前置: 同步 lockfile + 自测

本次优化给 `package.json` 新增了 `vitest` 开发依赖。部署前在本地跑一次安装, 让 `bun.lock` 与 `package.json` 同步 (否则 Vercel 上的冻结锁文件校验可能失败):

```bash
bun install        # 或 npm install
npm test           # 跑分类回归测试, 应全部通过
```

## 1. 在 Supabase 准备数据库

在 Supabase 控制台的 SQL Editor 里执行 `supabase/schema.sql` 全文。它会建好 `datasets` 表、索引、RLS 策略, 以及本次新增的原子发布函数 `publish_dataset`。

> 注: `publish_dataset` 是可选增强。即使没建, 上传接口也会自动回退到"先插入 inactive 再提升"的安全两步法, 不会出现零激活数据的窗口。但建议执行, 以获得单事务的原子性。

记下这三项 (Project Settings → API):

- Project URL → 用作 `SUPABASE_URL`
- service_role key (Secret) → 用作 `SUPABASE_SECRET_KEY`

## 2. 导入项目到 Vercel

当前仓库没有 git remote, 二选一:

- **CLI 部署 (最快):** 在项目根目录运行 `npx vercel`, 按提示登录并创建项目; 预览没问题后 `npx vercel --prod`。
- **Git 部署:** 先把仓库推到 GitHub/GitLab, 再在 Vercel 控制台 "Add New Project" 导入。

框架会被识别为 Next.js。仓库里的 `vercel.json` 已经把构建命令固定为 `next build` (跳过自托管才需要的 `cp` 步骤)。

## 3. 配置环境变量

在 Vercel 项目的 Settings → Environment Variables 添加 (Production + Preview 都加):

| 变量名 | 值 | 说明 |
| --- | --- | --- |
| `SUPABASE_URL` | 你的 Project URL | 必填 |
| `SUPABASE_SECRET_KEY` | service_role key | 必填 (也兼容 `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`) |
| `ADMIN_UPLOAD_PASSWORD` | 自定义强密码 | 管理员上传公共数据时校验 |

> 这三个都是服务端变量, **不要**加 `NEXT_PUBLIC_` 前缀, 否则会被打进前端 bundle 泄露密钥。

加完环境变量后, 在 Deployments 里 **Redeploy** 一次让变量生效。

## 4. 验证

- 打开线上地址, 地图应正常加载 (无公共数据时会回退到 `public/data` 预置示例, 顶部显示"预置"标记)。
- `GET /api/dataset/latest`: 已配置 Supabase 且有激活数据返回 200; 未配置返回 503; 无数据返回 404 (均为预期)。
- 用管理员密码上传一份 Excel, 刷新后其他浏览器也能看到新数据。

## 注意事项 (与后续优化相关)

- **请求/响应体大小:** Vercel Serverless Function 的请求体上限约 4.5MB。当前 `/api/admin/import` 一次性提交全部 records、`/api/dataset/latest` 一次性返回全部 records, 数据量大了会触顶。这正是 `docs/OPTIMIZATION.md` 里 P1 第 4 条要做的拆分 (城市摘要默认返回, 公司明细按需懒加载)。数据规模上来前先做这步。
- **构建期类型检查:** `next.config.ts` 里 `ignoreBuildErrors: false`, 任何 TS 类型错误都会让 Vercel 构建失败 —— 这是好事, 但意味着部署前最好本地先 `bun run build` 过一遍。
