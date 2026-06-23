'use client';

// ============================================================
// 顶部统计面板: 全局指标 + 风险分布
// ============================================================
import { useMapStore } from '@/store/useMapStore';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Building2, MapPin, ShieldCheck, AlertTriangle, TrendingUp, Activity } from 'lucide-react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  color: string;
  delay?: number;
}

function StatCard({ icon, label, value, hint, color, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200 px-3 py-2 shadow-sm hover:shadow-md transition-shadow min-w-[110px]"
    >
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
        <span className={`w-6 h-6 rounded-md flex items-center justify-center text-white ${color}`}>
          {icon}
        </span>
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-800 tabular-nums">{value}</span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
    </motion.div>
  );
}

export function StatsPanel() {
  const stats = useMapStore(s => s.globalStats);

  const riskDistribution = useMemo(() => {
    if (!stats) return [];
    return [
      { label: '低强度', value: stats.count_low, color: '#22c55e' },
      { label: '中强度', value: stats.count_medium, color: '#eab308' },
      { label: '高强度', value: stats.count_high_or_above - stats.count_very_high, color: '#f97316' },
      { label: '极高强度', value: stats.count_very_high, color: '#dc2626' },
    ];
  }, [stats]);

  if (!stats) return null;
  const total = stats.totalRecords || 1;

  return (
    <div className="flex flex-col gap-2 px-3 py-2 md:px-4 md:py-3">
      <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
        <StatCard
          icon={<Building2 className="w-3.5 h-3.5" />}
          label="作息记录"
          value={stats.totalRecords}
          color="bg-slate-700"
          delay={0}
        />
        <StatCard
          icon={<MapPin className="w-3.5 h-3.5" />}
          label="覆盖城市"
          value={stats.totalCities}
          color="bg-sky-600"
          delay={0.05}
        />
        <StatCard
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          label="955 记录"
          value={stats.count_955}
          hint={`(${Math.round(stats.count_955 / total * 100)}%)`}
          color="bg-green-600"
          delay={0.1}
        />
        <StatCard
          icon={<Activity className="w-3.5 h-3.5" />}
          label="965 记录"
          value={stats.count_965}
          color="bg-yellow-600"
          delay={0.15}
        />
        <StatCard
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          label="996 / 高强度记录"
          value={stats.count_996}
          hint={`(${Math.round(stats.count_996 / total * 100)}%)`}
          color="bg-red-600"
          delay={0.2}
        />
        <StatCard
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="高强度占比"
          value={`${stats.highRiskRatio}%`}
          color="bg-rose-600"
          delay={0.25}
        />

        {/* 强度分布条 */}
        <div className="flex-1 min-w-[200px] bg-white/90 rounded-lg border border-slate-200 px-3 py-2 shadow-sm">
          <div className="text-xs text-slate-500 mb-1.5 font-medium">强度分布</div>
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
            {riskDistribution.map(r => r.value > 0 && (
              <motion.div
                key={r.label}
                initial={{ width: 0 }}
                animate={{ width: `${(r.value / total) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ backgroundColor: r.color }}
                title={`${r.label}: ${r.value}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            {riskDistribution.map(r => (
              <span key={r.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: r.color }} />
                {r.label} {r.value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
