'use client';

// ============================================================
// 地图图例
// ============================================================
import { RISK_COLORS } from '@/lib/types';
import type { RiskLevel } from '@/lib/types';
import { motion } from 'framer-motion';

const RISK_ORDER: RiskLevel[] = ['low', 'medium', 'high', 'very_high', 'unknown'];

export function Legend() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.3 }}
      className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 p-3"
    >
      <div className="text-xs font-semibold text-slate-700 mb-2">工作强度等级图例</div>
      <div className="space-y-1">
        {RISK_ORDER.map(rl => (
          <div key={rl} className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full inline-block border border-white shadow-sm flex items-center justify-center text-[8px] font-bold text-white"
                style={{ backgroundColor: RISK_COLORS[rl].fill }}
              >
                {RISK_COLORS[rl].code}
              </span>
              <span className="text-slate-600">{RISK_COLORS[rl].label}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
        点位大小 = 该城市作息记录数<br />
        点位颜色 = 该城市主导工作强度
      </div>
    </motion.div>
  );
}
