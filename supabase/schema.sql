-- ============================================================
-- datasets 表: 公共作息数据发布
-- ============================================================
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. datasets 表
create table if not exists public.datasets (
  id           bigint generated always as identity primary key,
  version      bigint not null,                          -- 版本号 (递增)
  file_name    text not null,                            -- 上传文件名
  record_count integer not null default 0,               -- 记录数
  city_count   integer not null default 0,               -- 城市数
  records      jsonb not null default '[]'::jsonb,       -- 标准化公司记录
  city_summary jsonb not null default '[]'::jsonb,       -- 城市聚合统计
  geojson      jsonb not null default '{"type":"FeatureCollection","features":[]}'::jsonb,
  is_active    boolean not null default false,           -- 是否为当前激活版本
  created_at   timestamptz not null default now()
);

-- 2. version 唯一索引 (避免重复版本号)
create unique index if not exists datasets_version_key on public.datasets (version);

-- 3. is_active 唯一约束: 同一时间只能有一条 is_active = true
-- 用 partial unique index 实现
create unique index if not exists datasets_is_active_unique on public.datasets (is_active) where is_active = true;

-- 4. created_at 索引 (按时间排序)
create index if not exists datasets_created_at_idx on public.datasets (created_at desc);

-- 5. version 索引 (latest-meta 查询用)
create index if not exists datasets_version_idx on public.datasets (version desc);

-- 6. 注释
comment on table public.datasets is '公共作息数据集 (管理员上传的 Excel 解析后存这里)';
comment on column public.datasets.version is '版本号, 每次上传 +1, 用于客户端轮询检测更新';
comment on column public.datasets.is_active is '是否为当前激活版本, 同一时间只有一条 true';
comment on column public.datasets.records is '标准化公司记录数组 (CompanyRecord[])';
comment on column public.datasets.city_summary is '城市聚合统计 (CitySummary[])';
comment on column public.datasets.geojson is 'GeoJSON FeatureCollection (城市点位)';

-- 7. RLS 策略
--    - 公开读: 任何人 (anon + authenticated) 可读 is_active = true 的记录
--    - 写: 仅 service_role 可写 (API 用 service_role key, 绕过 RLS)
alter table public.datasets enable row level security;

-- 公开读最新激活数据
drop policy if exists "datasets_public_read_active" on public.datasets;
create policy "datasets_public_read_active" on public.datasets
  for select to anon, authenticated
  using (is_active = true);

-- 写操作完全交给 service_role (RLS 对 service_role 不生效)
