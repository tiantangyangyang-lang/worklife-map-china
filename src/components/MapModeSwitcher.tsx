'use client';

// ============================================================
// 地图模式切换器 (城市聚合 / 公司点位 / 2.5D 强度图)
// ============================================================
import { useMapStore } from '@/store/useMapStore';
import type { MapMode } from '@/lib/types';
import { Building2, MapPin, Mountain } from 'lucide-react';
import { motion } from 'framer-motion';

const MODES: { value: MapMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'city', label: '城市聚合', icon: <MapPin className="w-3.5 h-3.5" />, desc: '每个城市一个点位, 大小=记录数' },
  { value: 'company', label: '公司点位', icon: <Building2 className="w-3.5 h-3.5" />, desc: '每个有坐标的公司一个点位' },
  { value: '2.5d', label: '2.5D 强度图', icon: <Mountain className="w-3.5 h-3.5" />, desc: '3D 柱状图, 高度=记录数, 颜色=强度' },
];

export function MapModeSwitcher() {
  const mapMode = useMapStore(s => s.mapMode);
  const setMapMode = useMapStore(s => s.setMapMode);

  return (
    <div className="absolute top-4 right-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 p-1 flex items-center gap-0.5 flex-wrap">
      {MODES.map(mode => {
        const active = mapMode === mode.value;
        return (
          <button
            key={mode.value}
            onClick={() => setMapMode(mode.value)}
            className={`relative px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              active ? 'text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title={mode.desc}
            aria-pressed={active}
          >
            {active && (
              <motion.div
                layoutId="mapModeActiveBg"
                className="absolute inset-0 bg-emerald-600 rounded-md"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {mode.icon}
              {mode.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
