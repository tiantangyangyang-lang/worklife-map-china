'use client';

// ============================================================
// 右侧详情面板: 城市统计 + 公司列表 + 公司详情
// ============================================================
import { useMapStore } from '@/store/useMapStore';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { WORK_SYSTEM_LABELS, RISK_COLORS, CONFIDENCE_LABELS } from '@/lib/types';
import type { CompanyRecord, CitySummary, ClassificationBasis } from '@/lib/types';
import { ArrowLeft, MapPin, Building2, FileText, ExternalLink, Quote, Calendar, Hash, ShieldCheck, AlertTriangle, Activity, Sparkles, RotateCcw } from 'lucide-react';

/** 城市统计 + 公司列表 (默认视图) */
function CityListView({ city, records, onBack }: { city: CitySummary; records: CompanyRecord[]; onBack: () => void }) {
  // 按强度等级排序: very_high > high > medium > unknown > low
  const riskOrder = { very_high: 0, high: 1, medium: 2, unknown: 3, low: 4 };
  const resetFilter = useMapStore(s => s.resetFilter);
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const r = riskOrder[a.risk_level] - riskOrder[b.risk_level];
      if (r !== 0) return r;
      return a.company_name.localeCompare(b.company_name, 'zh-CN');
    });
  }, [records]);

  return (
    <div className="flex flex-col h-full">
      {/* 城市头部统计 */}
      <div className="p-4 border-b border-slate-100 bg-white">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500 hover:text-slate-700 -ml-2">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />返回
          </Button>
          <Badge variant="outline" className="text-xs">
            <MapPin className="w-3 h-3 mr-1" />{city.province}
          </Badge>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{city.city}</h2>
        <div className="text-sm text-slate-500 mb-3">
          共 <span className="font-bold text-slate-700">{city.total}</span> 条作息记录 · 强度评分 <span className="font-bold" style={{ color: RISK_COLORS[city.risk_dominant].fill }}>{city.risk_score}</span>/100
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="bg-green-50 border border-green-100 rounded-md p-2 text-center">
            <div className="text-lg font-bold text-green-700">{city.count_955}</div>
            <div className="text-[10px] text-slate-500">955</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 rounded-md p-2 text-center">
            <div className="text-lg font-bold text-yellow-700">{city.count_965}</div>
            <div className="text-[10px] text-slate-500">965</div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-md p-2 text-center">
            <div className="text-lg font-bold text-red-700">{city.count_996}</div>
            <div className="text-[10px] text-slate-500">996</div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-md p-2 text-center">
            <div className="text-lg font-bold text-slate-700">{city.count_high}</div>
            <div className="text-[10px] text-slate-500">高强度</div>
          </div>
        </div>
      </div>

      {/* 公司列表 */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1.5">
          {sortedRecords.length === 0 && (
            <div className="flex flex-col items-center text-center py-8 px-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-2.5">
                <Sparkles className="w-6 h-6 text-amber-400" />
              </div>
              <div className="text-sm font-medium text-slate-600 mb-1">该城市暂无符合条件的记录</div>
              <div className="text-xs text-slate-400 mb-3">当前筛选条件已过滤掉全部记录</div>
              <Button
                size="sm"
                variant="outline"
                onClick={resetFilter}
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              >
                <RotateCcw className="w-3 h-3 mr-1" />一键重置筛选
              </Button>
            </div>
          )}
          {sortedRecords.map(rec => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => useMapStore.getState().selectCompany(rec)}
              className="bg-white border border-slate-200 rounded-lg p-2.5 cursor-pointer hover:border-emerald-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-semibold text-slate-800 text-sm group-hover:text-emerald-700 line-clamp-1">
                  {rec.company_name}
                </div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold shrink-0"
                  style={{ backgroundColor: RISK_COLORS[rec.risk_level].fill }}
                >
                  {RISK_COLORS[rec.risk_level].label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">{WORK_SYSTEM_LABELS[rec.work_system]}</Badge>
                <span>·</span>
                <span>{rec.weekend_type}</span>
                {rec.rule_text && (
                  <>
                    <span>·</span>
                    <span className="line-clamp-1 max-w-[180px]">{rec.rule_text}</span>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/** 公司详情卡片 */
function CompanyDetailView({ record, onBack }: { record: CompanyRecord; onBack: () => void }) {
  const riskColor = RISK_COLORS[record.risk_level];
  const Icon = record.risk_level === 'low' ? ShieldCheck : record.risk_level === 'very_high' ? AlertTriangle : Activity;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 bg-white">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500 hover:text-slate-700 -ml-2 mb-2">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />返回列表
        </Button>
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: riskColor.fill }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-800 break-words">{record.company_name}</h2>
            <div className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              {record.city || '未知城市'}
              {record.province && <span className="text-slate-400">· {record.province}</span>}
              {record.district && <span className="text-slate-400">· {record.district}</span>}
            </div>
            {record.address && (
              <div className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                <span className="break-words">{record.address}</span>
              </div>
            )}
            {record.geo_level === 'coordinate' && (
              <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-emerald-100 rounded">精确坐标</span>
                <span className="text-slate-400">
                  {record.lng?.toFixed(4)}, {record.lat?.toFixed(4)}
                  {record.coord_system !== 'unknown' && ` (${record.coord_system})`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 工作强度横幅 */}
        <div
          className="rounded-lg p-3 mb-3 text-white"
          style={{ backgroundColor: riskColor.fill }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{riskColor.label}</span>
            <span className="text-xs opacity-90">数据仅供参考, 不代表公司官方结论</span>
          </div>
        </div>

        {/* 标签 */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-xs">
            <Building2 className="w-3 h-3 mr-1" />
            {WORK_SYSTEM_LABELS[record.work_system]}
          </Badge>
          <Badge variant="outline" className="text-xs">周末: {record.weekend_type}</Badge>
          <Badge variant="outline" className="text-xs">可信度: {record.confidence}</Badge>
          {record.section === '955' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">955 名单</Badge>}
          {record.section === '965' && <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-xs">965 名单</Badge>}
          {record.section === '996' && <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">996 / 高强度记录</Badge>}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* 分类依据 (issue #8) */}
          {record.classification_basis && (
            <ClassificationBasisView basis={record.classification_basis} />
          )}

          {/* 规则文本 */}
          {record.rule_text && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                <FileText className="w-3.5 h-3.5" />作息规则
              </div>
              <div className="bg-slate-50 rounded-md p-3 text-sm text-slate-700 leading-relaxed border border-slate-100">
                <Quote className="w-3 h-3 text-slate-300 inline mr-1" />
                {record.rule_text}
              </div>
            </div>
          )}

          {/* 证据 */}
          {record.evidence_list.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                <ExternalLink className="w-3.5 h-3.5" />证据描述
              </div>
              <div className="space-y-1.5">
                {record.evidence_list.map((ev, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-100 rounded-md p-2 text-xs text-amber-900 flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold shrink-0">{i + 1}.</span>
                    <span>{ev}</span>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-slate-400 mt-1.5">
                注: 证据描述来源于上传数据原文, 多为内部截图、考勤记录、知乎帖子等说明, 不一定包含可访问 URL。
              </div>
            </div>
          )}

          {/* 多城市 */}
          {record.city_list.length > 1 && (
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1.5">该公司在多个城市有记录</div>
              <div className="flex flex-wrap gap-1">
                {record.city_list.map(c => (
                  <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* 元信息 */}
          <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-500">
            {record.event_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                <span>事件日期: {record.event_date}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Hash className="w-3 h-3" />
              <span>原始行号: 第 {record.source_row} 行</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              <span>数据来源: {record.source_name} / {record.source_sheet}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" />
              <span>可信度评级: {CONFIDENCE_LABELS[record.confidence]}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              <span>
                地理精度: {record.geo_level === 'coordinate' ? '公司精确坐标' :
                  record.geo_level === 'address' ? '详细地址' :
                  record.geo_level === 'district' ? '区县级' :
                  record.geo_level === 'city' ? '城市级' : '未知'}
                {record.geo_source !== 'unknown' && ` · 来源 ${record.geo_source}`}
                {record.coord_system !== 'unknown' && ` · 坐标系 ${record.coord_system}`}
              </span>
            </div>
          </div>

          {/* 免责声明 */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-[11px] text-slate-500 leading-relaxed">
            <strong className="text-slate-600">免责声明:</strong> 本记录仅展示上传数据中的描述, 不构成对该公司
            的任何官方判定。同一家公司不同城市、部门、岗位的作息可能存在显著差异, 请以劳动合同、公司正式
            制度和实际工作情况为准。
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/** 分类依据模块 (issue #8) */
function ClassificationBasisView({ basis }: { basis: ClassificationBasis }) {
  const sourceLabel: Record<string, string> = {
    keyword: '关键词命中',
    section_fallback: '区域兜底',
    section_default: '区域默认',
    work_system_inferred: '由工作制度推断',
    severe_keyword: '违规关键词',
    work_system_mapping: '制度默认映射',
    unknown: '未知来源',
  };

  const Row = ({
    title,
    value,
    reasons,
    source,
    color,
  }: {
    title: string;
    value: string;
    reasons: string[];
    source: string;
    color?: string;
  }) => (
    <div className="bg-white rounded-md border border-slate-200 p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-700">{title}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal text-slate-500">
            {sourceLabel[source] || source}
          </Badge>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full text-white font-semibold"
          style={color ? { backgroundColor: color } : undefined}
        >
          {value}
        </span>
      </div>
      <ul className="space-y-1">
        {reasons.map((r, i) => (
          <li key={i} className="text-[11px] text-slate-600 leading-relaxed flex items-start gap-1">
            <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
        分类依据
        <span className="text-[10px] text-slate-400 font-normal">(系统自动判定, 仅供参考)</span>
      </div>
      <div className="space-y-1.5">
        <Row
          title="工作制度"
          value={WORK_SYSTEM_LABELS[basis.workSystem.label] || basis.workSystem.label}
          reasons={basis.workSystem.reasons}
          source={basis.workSystem.source}
        />
        <Row
          title="周末类型"
          value={basis.weekendType.label}
          reasons={basis.weekendType.reasons}
          source={basis.weekendType.source}
        />
        <Row
          title="强度等级"
          value={RISK_COLORS[basis.riskLevel.label].label}
          reasons={basis.riskLevel.reasons}
          source={basis.riskLevel.source}
          color={RISK_COLORS[basis.riskLevel.label].fill}
        />
      </div>
    </div>
  );
}

/** 默认空状态: 提示用户点击地图 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-400">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <MapPin className="w-8 h-8 text-slate-300" />
      </div>
      <div className="text-sm font-medium text-slate-500 mb-1">点击地图上的城市</div>
      <div className="text-xs text-slate-400 max-w-[200px]">
        查看该城市的作息记录、强度评分和详细规则
      </div>
      <div className="mt-6 pt-4 border-t border-slate-100 w-full">
        <div className="text-[11px] text-slate-400 leading-relaxed">
          <div className="font-semibold text-slate-500 mb-1">使用提示</div>
          <div>· 滚轮缩放地图</div>
          <div>· 拖动平移视图</div>
          <div>· 左侧筛选按制度/强度过滤</div>
          <div>· 顶部搜索公司或关键词</div>
        </div>
      </div>
    </div>
  );
}

export function CityDetail() {
  const selectedCity = useMapStore(s => s.selectedCity);
  const selectedCompany = useMapStore(s => s.selectedCompany);
  const filteredRecords = useMapStore(s => s.filteredRecords);
  const citySummaries = useMapStore(s => s.citySummaries);
  const selectCity = useMapStore(s => s.selectCity);
  const selectCompany = useMapStore(s => s.selectCompany);

  const cityRecords = useMemo(() => {
    if (!selectedCity) return [];
    return filteredRecords.filter(r => r.city === selectedCity);
  }, [filteredRecords, selectedCity]);

  const citySummary = useMemo(() => {
    if (!selectedCity) return null;
    return citySummaries.find(c => c.city === selectedCity) || null;
  }, [citySummaries, selectedCity]);

  return (
    <div className="h-full bg-slate-50/50">
      <AnimatePresence mode="wait">
        {selectedCompany ? (
          <motion.div
            key={`company-${selectedCompany.id}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <CompanyDetailView record={selectedCompany} onBack={() => selectCompany(null)} />
          </motion.div>
        ) : selectedCity && citySummary ? (
          <motion.div
            key={`city-${selectedCity}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <CityListView city={citySummary} records={cityRecords} onBack={() => selectCity(null)} />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <EmptyState />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
