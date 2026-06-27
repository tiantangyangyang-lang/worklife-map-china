# ============================================================
# WorkLife Map China — 项目命令入口
# 用法: make <target>   (不带参数 = make help)
# 依赖: bun (包管理/运行), npx vercel (部署). Windows 装 make 见 README。
# ============================================================
.DEFAULT_GOAL := help
.PHONY: help install dev build start lint typecheck test test-watch \
        data map sample verify deploy deploy-prod env-pull clean

help: ## 列出所有命令
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## 安装依赖 (bun install)
	bun install

dev: ## 启动开发服务器 (localhost:3000)
	bun run dev

build: ## 生产构建
	bun run build

start: ## 以生产模式启动 (需先 build)
	bun run start

lint: ## ESLint 检查
	bun run lint

typecheck: ## TypeScript 类型检查 (不产出文件)
	bunx tsc --noEmit

test: ## 跑单元测试 (vitest run)
	bun run test

test-watch: ## 测试 watch 模式
	bun run test:watch

data: ## 重建标准化数据 (scripts/build-data.ts)
	bun run build:data

map: ## 重建中国地图 GeoJSON (scripts/build-china-map.ts)
	bun run build:map

sample: ## 重新生成 Excel 样例模板 (含 recruit_detail 表)
	bun run scripts/generate-sample-template.ts

verify: typecheck lint test ## 提交前自检: 类型 + lint + 测试

env-pull: ## 从 Vercel 拉取生产环境变量到 .env.local (谨慎)
	npx vercel env pull .env.local

deploy: ## 部署预览版到 Vercel
	npx vercel --yes

deploy-prod: ## 部署正式版到 Vercel (生产)
	npx vercel --prod --yes

clean: ## 清理构建产物
	rm -rf .next
