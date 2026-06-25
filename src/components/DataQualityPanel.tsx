'use client';

// ============================================================
// V2.5 地图数据质量面板
//
// 显示当前数据集的地理精度分布:
//   总记录数 / 精确坐标 / 城市级 / 区县级 / 无法定位
// ============================================================
import { useMapStore } from '@/store/useMapStore';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Database, MapPin, Building2, MapPinned, AlertCircle } from 'lucide-react';

export function DataQualityPanel() {
  const allRecords = useMapStore(s => s.allRecords);

  const stats = useMemo(() => {
    const total = allRecords.length;
    const coordinate = allRecords.filter(r => r.geo_level === 'coordinate').length;
    const address = allRecords.filter(r => r.geo_level === 'address').length;
    const district = allRecords.filter(r => r.geo_level === 'district').length;
    const city = allRecords.filter(r => r.geo_level === 'city').length;
    const unknown = allRecords.filter(r => r.geo_level === 'unknown').length;
    return { total, coordinate, address, district, city, unknown };
  }, [allRecords]);

  if (stats.total === 0) return null;

  const items = [
    { label: '总记录数', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-100', icon: Database },
    { label: '精确坐标', value: stats.coordinate, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: MapPin },
    { label: '地址级', value: stats.address, color: 'text-teal-700', bg: 'bg-teal-50', icon: Building2 },
    { label: '区县级', value: stats.district, color: 'text-sky-700', bg: 'bg-sky-50', icon: MapPinned },
    { label: '城市级', value: stats.city, color: 'text-amber-700', bg: 'bg-amber-50', icon: MapPin },
    { label: '无法定位', value: stats.unknown, color: 'text-red-700', bg: 'bg-red-50', icon: AlertCircle },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 p-3"
    >
      <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5 text-emerald-600" />
        数据质量
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const pct = stats.total > 0 ? Math.round((item.value / stats.total) * 100) : 0;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + idx * 0.03 }}
              className={`rounded-md p-2 ${item.bg}`}
            >
              <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5">
                <Icon className="w-3 h-3" />
                {item.label}
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
                <span className="text-[10px] text-slate-400">({pct}%)</span>
              </div>
            </motion.div>
          );
        })}
      </div>
      {stats.coordinate === 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-amber-600 leading-relaxed">
          ⚠ 当前数据无精确坐标记录, 公司点位模式无可显示点位。请上传含经纬度的 Excel。
        </div>
      )}
    </motion.div>
  );
}
