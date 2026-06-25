'use client';

// ============================================================
// 数据集版本轮询 Hook
//
// 每 10 秒调用 GET /api/dataset/latest-meta 检查 version 是否变化,
// 如果变化, 重新拉取 GET /api/dataset/latest 并更新地图, toast 提示用户。
//
// 仅在 dataMode === 'api' 时启动轮询 (fallback 模式下数据库没数据, 轮询无意义)。
// ============================================================
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useMapStore } from '@/store/useMapStore';

const POLL_INTERVAL_MS = 10_000; // 10 秒

interface LatestMeta {
  id: number;
  version: number;
  file_name: string;
  record_count: number;
  city_count: number;
  created_at: string;
}

interface LatestFull {
  id: number;
  version: number;
  file_name: string;
  record_count: number;
  city_count: number;
  records: any[];
  city_summary?: any[];
  geojson?: any;
  created_at: string;
}

export function useDatasetVersionPoller() {
  const dataMode = useMapStore(s => s.dataMode);
  const currentVersion = useMapStore(s => s.datasetVersion);
  const loadDatasetFromApi = useMapStore(s => s.loadDatasetFromApi);
  const inFlightRef = useRef(false);

  useEffect(() => {
    // 仅在 API 模式下轮询
    if (dataMode !== 'api') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        // 1. 拉元信息
        const metaRes = await fetch('/api/dataset/latest-meta', { cache: 'no-store' });
        if (!metaRes.ok) return; // 503 / 404 / 500 都静默忽略
        const meta: LatestMeta = await metaRes.json();

        // 2. 比较 version
        const storeVersion = useMapStore.getState().datasetVersion;
        if (meta.version === storeVersion) return; // 没变化

        // 3. version 变了, 拉完整数据
        const fullRes = await fetch('/api/dataset/latest', { cache: 'no-store' });
        if (!fullRes.ok) return;
        const full: LatestFull = await fullRes.json();

        if (cancelled) return;

        // 4. 更新 store (静默模式, 不重置选中状态)
        loadDatasetFromApi(
          {
            version: full.version,
            file_name: full.file_name,
            records: full.records,
            city_summary: full.city_summary,
            created_at: full.created_at,
          },
          { silent: true },
        );

        // 5. toast 提示
        toast.success('公共数据已更新, 地图已同步', {
          duration: 4000,
          description: `版本 v${full.version} · ${full.record_count} 条记录 · ${full.city_count} 个城市`,
        });
      } catch (e) {
        // 轮询失败静默忽略, 下次再试
        console.warn('[poller] dataset version poll failed:', e);
      } finally {
        inFlightRef.current = false;
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      timer = setTimeout(async () => {
        await poll();
        scheduleNext();
      }, POLL_INTERVAL_MS);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [dataMode, loadDatasetFromApi]);

  // 返回当前版本号, 方便调试
  return currentVersion;
}
