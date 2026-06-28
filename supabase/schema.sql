-- ============================================================
-- datasets 表: 公共作息数据发布
-- ============================================================
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. datasets 表
create table if not exists public.datasets (
  id           uuid not null default gen_random_uuid() primary key,
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

-- ============================================================
-- 8. 原子发布函数 publish_dataset
-- ============================================================
-- 在一个事务里完成 "停用旧版本 + 插入新激活版本", 保证原子性:
--   - 旧逻辑是先 UPDATE is_active=false 再 INSERT, 若 INSERT 失败会出现
--     "零个激活版本" 的窗口, 线上直接回退到预置示例。
--   - 用函数包成单事务后, 任一步失败整体回滚, 永远不会出现零激活状态。
-- API (/api/admin/import) 会优先调用本函数; 如果库里还没建该函数, 会自动
-- 回退到 "先插入(inactive) 再提升" 的安全两步法, 因此本函数是可选增强。
create or replace function public.publish_dataset(
  p_version      bigint,
  p_file_name    text,
  p_record_count integer,
  p_city_count   integer,
  p_records      jsonb,
  p_city_summary jsonb,
  p_geojson      jsonb
) returns table (
  id           uuid,
  version      bigint,
  file_name    text,
  record_count integer,
  city_count   integer,
  created_at   timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 单事务: 先停用旧的激活版本, 再插入新版本并激活
  update public.datasets set is_active = false where is_active = true;

  return query
  insert into public.datasets (
    version, file_name, record_count, city_count,
    records, city_summary, geojson, is_active
  ) values (
    p_version, p_file_name, p_record_count, p_city_count,
    p_records, p_city_summary, p_geojson, true
  )
  returning
    datasets.id, datasets.version, datasets.file_name,
    datasets.record_count, datasets.city_count, datasets.created_at;
end;
$$;

comment on function public.publish_dataset is '原子发布数据集: 单事务内停用旧版本并插入新激活版本, 避免零激活窗口';
