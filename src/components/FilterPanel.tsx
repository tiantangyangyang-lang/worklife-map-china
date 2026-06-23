'use client';

// ============================================================
// 左侧筛选面板: 城市 / 工作制度 / 周末类型 / 工作强度等级 / 可信度
// ============================================================
import { useMapStore } from '@/store/useMapStore';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WORK_SYSTEM_LABELS, RISK_COLORS, CONFIDENCE_LABELS } from '@/lib/types';
import type { WorkSystem, WeekendType, RiskLevel, Confidence } from '@/lib/types';
import { Filter, RotateCcw, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const WORK_SYSTEMS: WorkSystem[] = ['955', '965', '995', '996', '997', '007', '大小周', '单休', '排班', '加班', '高强度', '未知'];
const WEEKEND_TYPES: WeekendType[] = ['双休', '单休', '大小周', '排班/轮休', '未知'];
const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high', 'very_high', 'unknown'];
const CONFIDENCES: Confidence[] = ['A', 'B', 'C', 'D', 'E'];

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-slate-100 py-3">
      <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold text-slate-700 hover:text-slate-900">
        {title}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FilterCheckbox({
  checked,
  onCheck,
  label,
  color,
  count,
}: {
  checked: boolean;
  onCheck: () => void;
  label: React.ReactNode;
  color?: string;
  count?: number;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm py-1 px-1.5 rounded hover:bg-slate-50 group">
      <Checkbox
        checked={checked}
        onCheckedChange={onCheck}
        className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
      />
      <span className="flex-1 text-slate-700 group-hover:text-slate-900 flex items-center gap-1.5">
        {color && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />}
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-slate-400 font-mono">{count}</span>
      )}
    </label>
  );
}

export function FilterPanel() {
  const filter = useMapStore(s => s.filter);
  const setFilter = useMapStore(s => s.setFilter);
  const resetFilter = useMapStore(s => s.resetFilter);
  const allRecords = useMapStore(s => s.allRecords);

  // 统计每个筛选项的记录数 (基于全量数据)
  const counts = useMemo(() => {
    const cities = new Map<string, number>();
    const workSystems = new Map<WorkSystem, number>();
    const weekendTypes = new Map<WeekendType, number>();
    const riskLevels = new Map<RiskLevel, number>();
    const confidences = new Map<Confidence, number>();
    for (const r of allRecords) {
      if (r.city) cities.set(r.city, (cities.get(r.city) || 0) + 1);
      workSystems.set(r.work_system, (workSystems.get(r.work_system) || 0) + 1);
      weekendTypes.set(r.weekend_type, (weekendTypes.get(r.weekend_type) || 0) + 1);
      riskLevels.set(r.risk_level, (riskLevels.get(r.risk_level) || 0) + 1);
      confidences.set(r.confidence, (confidences.get(r.confidence) || 0) + 1);
    }
    // 城市按数量排序
    const sortedCities = Array.from(cities.entries()).sort((a, b) => b[1] - a[1]);
    return { sortedCities, workSystems, weekendTypes, riskLevels, confidences };
  }, [allRecords]);

  const toggle = <T,>(arr: T[], v: T): T[] => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  const activeCount =
    filter.cities.length + filter.workSystems.length + filter.weekendTypes.length +
    filter.riskLevels.length + filter.confidences.length;

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-slate-800 text-sm">筛选条件</span>
          {activeCount > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">{activeCount}</Badge>
          )}
        </div>
        {activeCount > 0 && (
          <Button size="sm" variant="ghost" onClick={resetFilter} className="h-7 text-xs text-slate-500 hover:text-slate-700">
            <RotateCcw className="w-3 h-3 mr-1" />重置
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 px-4">
        <FilterSection title="工作制度">
          {WORK_SYSTEMS.map(ws => (
            <FilterCheckbox
              key={ws}
              checked={filter.workSystems.includes(ws)}
              onCheck={() => setFilter({ workSystems: toggle(filter.workSystems, ws) })}
              label={WORK_SYSTEM_LABELS[ws]}
              count={counts.workSystems.get(ws)}
            />
          ))}
        </FilterSection>

        <FilterSection title="周末休息类型">
          {WEEKEND_TYPES.map(wt => (
            <FilterCheckbox
              key={wt}
              checked={filter.weekendTypes.includes(wt)}
              onCheck={() => setFilter({ weekendTypes: toggle(filter.weekendTypes, wt) })}
              label={wt}
              count={counts.weekendTypes.get(wt)}
            />
          ))}
        </FilterSection>

        <FilterSection title="工作强度等级">
          {RISK_LEVELS.map(rl => (
            <FilterCheckbox
              key={rl}
              checked={filter.riskLevels.includes(rl)}
              onCheck={() => setFilter({ riskLevels: toggle(filter.riskLevels, rl) })}
              label={
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS[rl].fill }} />
                  {RISK_COLORS[rl].label}
                </span>
              }
              count={counts.riskLevels.get(rl)}
            />
          ))}
        </FilterSection>

        <FilterSection title="可信度">
          {CONFIDENCES.map(c => (
            <FilterCheckbox
              key={c}
              checked={filter.confidences.includes(c)}
              onCheck={() => setFilter({ confidences: toggle(filter.confidences, c) })}
              label={CONFIDENCE_LABELS[c]}
              count={counts.confidences.get(c)}
            />
          ))}
        </FilterSection>

        <FilterSection title={`城市 (${counts.sortedCities.length})`} defaultOpen={false}>
          <div className="max-h-64 overflow-y-auto pr-1">
            {counts.sortedCities.map(([city, count]) => (
              <FilterCheckbox
                key={city}
                checked={filter.cities.includes(city)}
                onCheck={() => setFilter({ cities: toggle(filter.cities, city) })}
                label={city}
                count={count}
              />
            ))}
          </div>
        </FilterSection>
      </ScrollArea>
    </div>
  );
}
