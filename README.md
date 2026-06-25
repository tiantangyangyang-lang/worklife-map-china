# 中国公司作息地图 (WorkLifeMap China)

> 🗺️ 一个开源的中国公司作息数据可视化工具 — 上传 Excel, 自动生成城市级公司作息地图。

![version](https://img.shields.io/badge/version-V2.1-emerald)
![license](https://img.shields.io/badge/license-MIT-blue)
![next](https://img.shields.io/badge/Next.js-16-black)
![typescript](https://img.shields.io/badge/TypeScript-5-blue)

## 📌 项目简介

本项目接收用户上传的 955 / 965 / 996 公司作息数据 (Excel: `.xlsx` / `.xls`), 经过自动清洗、分类、工作强度评级后,
在中国地图上展示公司作息情况。

> ✅ **V2 支持两种地图模式 (右上角切换):**
>
> - **城市级作息地图**: 每个城市一个点位, 大小=记录数, 颜色=主导强度。同城市所有公司聚合到一个点。
> - **公司点位地图**: 每条有经纬度的记录显示为独立点位, 颜色=工作强度。无经纬度的记录退回城市级 (不显示在点位模式)。
>
> 切换方式: 地图右上角"城市聚合 / 公司点位"按钮组。公司点位模式需要 Excel 包含经纬度列 (见下文)。

## 🎯 当前版本 (V2.1) 的设计边界

| 能做 | 不做 |
| --- | --- |
| ✅ 城市级作息记录聚合 (城市聚合模式) | ❌ 招聘网站爬虫 / 岗位薪资 |
| ✅ 公司精确点位 (公司点位模式, 需 Excel 含经纬度) | ❌ 用户登录 + 评论系统 (V4 才会做) |
| ✅ 管理员发布公共数据 (Supabase) | ❌ 普通用户直接覆盖公共数据 (需审核系统) |
| ✅ 多维度筛选 + 多格式导出 (JSON / GeoJSON / CSV) | ❌ 3D / 2.5D 可视化 (V3 才会做) |
| ✅ 桌面 + 移动端响应式 | ❌ 用户投稿与审核后台 (V4 才会做) |

V2.1 修复: 公司点位模式只显示有精确坐标的真实公司点位, 不再把城市中心 fallback 当成公司点位。

### V2 当前能力

- ✅ Excel 上传 (`.xlsx` / `.xls`), 浏览器本地解析 (不上传服务器)
- ✅ 上传后显示**解析报告** (记录数 / 区域识别 / 城市定位 / 前 20 条预览) + 用户确认
- ✅ 自动识别 955 / 965 / 996 三个数据区域 (兼容多种原始标题写法)
- ✅ 自动拆分多城市字段 (`"北京/上海"` → 两条记录)
- ✅ 自动分类工作制度 (955 / 965 / 996 / 997 / 007 / 大小周 / 单休 / 排班 / 加班 / 高强度)
- ✅ 自动判断周末类型 (双休 / 单休 / 大小周 / 排班 / 未知)
- ✅ 自动评级工作强度等级 (低强度 / 中强度 / 高强度 / 极高强度 / 未知)
- ✅ 城市级聚合与强度评分 (0-100)
- ✅ 交互式中国 SVG 地图 (省界 + 城市点位), 桌面端 + 移动端响应式
- ✅ 城市点位带 **L/M/H/VH 字母标记** (色弱用户友好) + 键盘可访问 (Tab + Enter)
- ✅ 点击城市查看公司列表, 点击公司查看详情
- ✅ 多维度筛选 (工作制度 / 周末类型 / 工作强度等级 / 可信度 / 城市)
- ✅ 关键词搜索 (公司名 / 城市 / 规则 / 证据)
- ✅ 多格式导出 (`normalized_companies.json` / `city_summary.json` / `map.geojson` / `.csv`), **每种格式都支持"全量"和"当前筛选"**
- ✅ 完整免责声明 (页面底部可折叠 + 公司详情卡 + "关于" 弹窗)

### 不做的事 (V2 边界)

- ❌ 不做招聘网站爬虫
- ❌ 不采集简历、手机号、聊天记录等个人信息
- ❌ 不绕过验证码
- ❌ 不展示招聘岗位和薪资
- ❌ 不做 3D / 2.5D 可视化 (V3 才会引入)
- ❌ 不做用户投稿与审核系统 (V4 才会引入)

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18.18 (Next.js 16 要求)
- 任一包管理器: `npm` / `pnpm` / `bun` (三选一)

### 安装

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/company-work-schedule-map.git
cd company-work-schedule-map

# 2. 安装依赖 (三选一)
npm install
# 或
pnpm install
# 或
bun install
```

### 运行开发服务器

```bash
npm run dev
# 或
pnpm dev
# 或
bun run dev
```

打开浏览器访问 `http://localhost:3000`, 系统会自动加载预置示例数据。

### 生产构建

```bash
npm run build
npm run start
# 或 pnpm / bun 对应命令
```

## 📊 数据来源与加载机制

网站启动时按以下优先级加载作息数据:

1. **优先**: 调用 `GET /api/dataset/latest` 从 Supabase 数据库读取最新公共数据集
2. **Fallback**: 如果数据库未配置或没有数据, 退回到 `public/data/normalized_companies.json` 预置示例数据

预置示例数据:
- 源文件: `data/中国公司作息情况.example.xlsx`
- 解析后: **371 条作息记录**, 覆盖 **38 个城市**
- 分布: 955 区域 139 条 / 965 区域 11 条 / 996 区域 221 条

## 📤 管理员发布公共数据 (V2 公共数据发布模式)

本项目采用 **管理员发布** 模式: 只有知道管理员密码的人才能上传 Excel,
上传后数据保存到 Supabase 数据库, **所有用户** 打开网站都会读到最新公共数据。

### 上传流程

1. 点击右上角"上传数据"按钮, 弹窗显示
2. 输入**管理员密码** (从环境变量 `ADMIN_UPLOAD_PASSWORD` 读取)
3. 选择或拖拽 `.xlsx` 文件
4. 浏览器本地解析 → 生成标准化 records
5. 调用 `POST /api/admin/import` 把 records 保存到数据库 (version 自增)
6. 保存成功后, 当前页面立即更新地图
7. toast 提示: "公共数据已更新, 所有用户将看到最新地图"

### 已打开页面的用户自动同步

页面每 **10 秒** 调用 `GET /api/dataset/latest-meta` 检查 version:
- 如果 version 变化, 自动重新拉取 `GET /api/dataset/latest`
- 更新地图和统计卡片
- toast 提示: "公共数据已更新, 地图已同步"

### 权限模型说明

- ✅ **管理员上传**: 知道 `ADMIN_UPLOAD_PASSWORD` 的人可以发布公共数据, 直接覆盖所有用户看到的内容
- ❌ **普通用户上传不应直接覆盖公共数据**: 普通用户没有密码, 无法调用 `POST /api/admin/import`
- 🔜 **用户投稿**: 如需让普通用户提交数据, 需要后续增加审核系统 (投稿 → 审核 → 发布), 不能直接让前端写入公共数据集

详细格式要求见 [`docs/EXCEL_IMPORT.md`](docs/EXCEL_IMPORT.md)

## 🗄️ Supabase 数据库配置

### 1. 创建 Supabase 项目

访问 [supabase.com](https://supabase.com) 创建项目, 在 SQL Editor 执行 `supabase/schema.sql` 创建 `datasets` 表。

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`, 填入:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # service_role key
ADMIN_UPLOAD_PASSWORD=your-strong-password-here
```

> ⚠️ `SUPABASE_SERVICE_KEY` 是 service_role key, 拥有完全数据库权限, **绝不能**暴露给浏览器。本项目仅在服务端 API routes 中使用它。

### 3. datasets 表结构

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | bigint (PK) | 自增主键 |
| `version` | bigint | 版本号, 每次上传 +1, 客户端轮询比较用 |
| `file_name` | text | 上传的 Excel 文件名 |
| `record_count` | integer | 记录数 |
| `city_count` | integer | 城市数 |
| `records` | jsonb | 标准化公司记录数组 |
| `city_summary` | jsonb | 城市聚合统计 |
| `geojson` | jsonb | GeoJSON FeatureCollection |
| `is_active` | boolean | 是否为当前激活版本 (同一时间只有一条 true) |
| `created_at` | timestamptz | 创建时间 |

### 4. API 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/dataset/latest` | 返回当前激活数据集 (含 records/city_summary/geojson) |
| GET | `/api/dataset/latest-meta` | 返回轻量元信息 (仅 version 等, 轮询用) |
| POST | `/api/admin/import` | 管理员上传 (需密码), 保存新版本 |

## 🔧 重新生成预置数据

若你修改了 `data/中国公司作息情况.example.xlsx` 或城市坐标库, 运行:

```bash
# 1. 重新生成 normalized_companies.json / city_summary.json / map.geojson
npm run build:data
# 或: INPUT_FILE=./my-data.xlsx npm run build:data

# 2. (可选) 重新生成省界 SVG 路径
#    先下载 GeoJSON:
curl -sL "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json" -o /tmp/china_geo.json
npm run build:map
```

`build:data` 脚本支持环境变量:

| 变量          | 默认值                                  | 说明                |
| ------------- | --------------------------------------- | ------------------- |
| `INPUT_FILE`  | `data/中国公司作息情况.example.xlsx`   | 输入 Excel 路径     |
| `OUTPUT_DIR`  | `public/data`                           | 输出 JSON 目录      |

## 📁 项目结构

```
.
├── data/                              # 示例原始 Excel
│   └── 中国公司作息情况.example.xlsx
├── public/data/                       # 预生成的 JSON / GeoJSON
│   ├── normalized_companies.json
│   ├── city_summary.json
│   ├── map.geojson
│   ├── china-provinces.json           # 简化的省界 SVG 路径
│   └── 中国公司作息情况.example.xlsx
├── scripts/                           # 数据处理脚本 (用 tsx 运行)
│   ├── build-data.ts                  # 解析 Excel → 生成 3 个 JSON
│   ├── build-china-map.ts             # 生成 china-provinces.json
│   └── analyze-excel.ts               # 调试用: 打印 Excel 结构
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # 根布局 (含 Sonner toaster)
│   │   ├── page.tsx                   # 首页 (桌面 / 移动响应式切换)
│   │   └── globals.css
│   ├── components/
│   │   ├── MapView.tsx                # SVG 交互式地图 (省界 + 城市点 + tooltip)
│   │   ├── FilterPanel.tsx            # 筛选面板 (桌面侧栏 / 移动底部抽屉)
│   │   ├── SearchBar.tsx              # 搜索框
│   │   ├── StatsPanel.tsx             # 统计卡片 (桌面 / 移动横向滚动)
│   │   ├── CityDetail.tsx             # 详情 (城市列表 + 公司详情)
│   │   ├── MobileLayout.tsx           # 移动端布局 (Sheet 抽屉)
│   │   ├── Legend.tsx                 # 地图图例 (含 L/M/H/VH 标记)
│   │   ├── UploadExcel.tsx            # 上传 Excel + 解析报告弹窗
│   │   └── ExportButton.tsx           # 多格式导出菜单 (全量/筛选)
│   ├── lib/
│   │   ├── types.ts                   # 类型定义 + 颜色 / 标签常量
│   │   ├── city-centers.ts            # 60+ 中国城市经纬度 + 省份
│   │   ├── classify.ts                # work_system / weekend_type / risk_level 识别
│   │   ├── normalize.ts               # 多城市拆分 / 公司名清洗 / section 识别
│   │   ├── parse-excel.ts             # 浏览器端 Excel 解析入口
│   │   ├── parse-report.ts            # 解析报告生成 (上传确认用)
│   │   ├── aggregate.ts               # 城市聚合 + 强度评分 + GeoJSON 生成
│   │   └── projection.ts              # Mercator 投影工具
│   ├── hooks/
│   │   └── use-media-query.ts         # 响应式断点 Hook
│   └── store/
│       └── useMapStore.ts             # Zustand 全局状态
└── docs/
    ├── DATA_FORMAT.md                 # 字段定义详解
    ├── EXCEL_IMPORT.md                # Excel 导入格式说明
    ├── ROADMAP.md                     # V1 → V4 升级路线
    └── DISCLAIMER.md                  # 免责声明
```

## 🏗️ 技术栈

| 类别       | 技术                                          |
| ---------- | --------------------------------------------- |
| 框架       | Next.js 16 (App Router) + React 19            |
| 语言       | TypeScript 5                                  |
| 样式       | Tailwind CSS 4 + shadcn/ui (New York)         |
| 状态管理   | Zustand                                       |
| 动画       | Framer Motion                                 |
| Excel 解析 | xlsx (SheetJS)                                |
| 脚本运行   | tsx (Node.js 直接运行 TS)                     |
| 地图       | SVG + 自实现 Mercator 投影 (无外部瓦片依赖)   |

> **为什么用 SVG 而非 MapLibre GL?** 第一版数据仅到城市粒度 (38 个点位),
> SVG 方案无外部瓦片依赖, 启动更快、离线可用、渲染稳定。
> V2 引入公司点位时, 会切换到 MapLibre GL JS + deck.gl 以支持海量点位聚合。

## 📦 npm scripts

| 命令              | 说明                                              |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | 启动开发服务器 (端口 3000)                        |
| `npm run build`   | 生产构建                                          |
| `npm run start`   | 启动生产服务器                                    |
| `npm run lint`    | ESLint 检查                                       |
| `npm run build:data` | 解析 Excel 生成 3 个 JSON 文件                 |
| `npm run build:map`  | 重新生成省界 SVG 路径数据 (需先下载 GeoJSON)   |

## 🛡️ 免责声明

本项目展示的数据来自用户上传、公开资料或社区整理,**仅供参考**:

- 不代表公司官方结论
- 不构成对任何公司的法律判定
- 同一家公司不同城市、部门、岗位的作息可能存在显著差异
- 请以劳动合同、公司正式制度和实际工作情况为准

完整声明见 [`docs/DISCLAIMER.md`](docs/DISCLAIMER.md)

## 🗺️ 路线图

| 版本 | 主题 | 状态 |
| --- | --- | --- |
| **V1** | 城市级作息地图 (Excel 导入 + 城市聚合 + 搜索筛选 + 多格式导出) | ✅ 已完成 |
| **V2** | 公共数据发布 + 公司点位字段 (Supabase + 管理员发布 + 经纬度点位 + 双模式切换) | ✅ 当前版本 (V2.1) |
| **V3** | 3D / 2.5D 可视化 (3D 地图 + 城市工作强度热力图 + 科技园区密度) | 🔜 规划中 |
| **V4** | 用户投稿与审核 (投稿 → 审核 → 发布后台 + 证据上传 + 可信度评分细化) | 🔜 规划中 |

详见 [`docs/ROADMAP.md`](docs/ROADMAP.md)

## 🤝 贡献

欢迎通过 Issue / PR 贡献:

- 报告数据错误 (城市坐标错误、分类错误)
- 补充城市坐标库 (`src/lib/city-centers.ts`)
- 改进分类规则 (`src/lib/classify.ts`)
- 添加新的导出格式
- 完善文档

**不接受**以下 PR:
- 引入爬虫功能的 PR
- 引入用户登录 + 评论系统的 PR (在 V2.0 才会做)
- 修改免责声明措辞使其更"绝对化"的 PR

## 📜 License

MIT
