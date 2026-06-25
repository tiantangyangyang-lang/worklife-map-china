'use client';

// ============================================================
// 公司点位地图 (V2)
//
// 每条有 lng/lat 的记录显示为一个点:
//   - 点颜色根据工作强度 (risk_level) 显示
//   - 点击点位显示公司详情
//   - 支持平移/缩放 (与城市聚合模式一致的交互)
//
// 无坐标的记录在 company 模式下不显示 (退回城市级需切换到 city 模式)
// ============================================================
import { useEffect, useState, useMemo, useRef } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { project, MAP_WIDTH, MAP_HEIGHT, type ChinaMapData, type ProvincePath } from '@/lib/projection';
import { RISK_COLORS } from '@/lib/types';
import type { CompanyRecord, RiskLevel } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchX } from 'lucide-react';

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  record: CompanyRecord | null;
}

/** 公司点位半径 (固定, 区别于城市聚合的动态半径) */
const POINT_RADIUS = 5;

export function CompanyMapView() {
  const filteredRecords = useMapStore(s => s.filteredRecords);
  const selectedCompany = useMapStore(s => s.selectedCompany);
  const selectedCompanyCluster = useMapStore(s => s.selectedCompanyCluster);
  const selectCompany = useMapStore(s => s.selectCompany);
  const selectCompanyCluster = useMapStore(s => s.selectCompanyCluster);

  const [mapData, setMapData] = useState<ChinaMapData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, record: null });
  /** V2.5: 悬浮的聚合簇信息 (显示记录数) */
  const [hoverCluster, setHoverCluster] = useState<{ count: number; records: CompanyRecord[]; topRecord: CompanyRecord } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载省界 GeoJSON
  useEffect(() => {
    fetch('/data/china-provinces.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: ChinaMapData) => setMapData(data))
      .catch(err => setLoadError(err.message));
  }, []);

  // 监听容器宽度
  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => setContainerWidth(containerRef.current?.clientWidth || 800);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 拖动平移
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    setIsDragging(true);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };
  const handleMouseUp = () => {
    dragRef.current = null;
    setIsDragging(false);
  };
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.6, Math.min(6, z + delta)));
  };

  // V2.5 增强: 公司点位模式只显示 geo_level === 'coordinate' 且 lng/lat 不为空的记录
  // 同一 lng/lat 的记录聚合成一个点, 点大小表示该坐标记录数量
  const projectedPoints = useMemo(() => {
    // 过滤出有精确坐标的记录
    const coordRecords = filteredRecords.filter(
      r => r.geo_level === 'coordinate' && r.lng !== null && r.lat !== null
    );

    // 按 "lng,lat" 聚合
    const clusterMap = new Map<string, { records: CompanyRecord[]; lng: number; lat: number }>();
    for (const r of coordRecords) {
      const key = `${r.lng!.toFixed(6)},${r.lat!.toFixed(6)}`;
      if (!clusterMap.has(key)) {
        clusterMap.set(key, { records: [], lng: r.lng!, lat: r.lat! });
      }
      clusterMap.get(key)!.records.push(r);
    }

    // 转换为带投影坐标的聚合点
    return Array.from(clusterMap.values()).map(cluster => {
      const [x, y] = project(cluster.lng, cluster.lat);
      return {
        records: cluster.records,
        count: cluster.records.length,
        lng: cluster.lng,
        lat: cluster.lat,
        x,
        y,
      };
    });
  }, [filteredRecords]);

  /** V2.5: 根据聚合记录数计算点位半径 (4-16px, log 平滑) */
  function getClusterRadius(count: number): number {
    if (count <= 0) return 0;
    const min = 5;
    const max = 16;
    const logCount = Math.log(count + 1);
    const logMax = Math.log(20); // 20 条 → max size
    return min + (max - min) * Math.min(1, logCount / logMax);
  }

  const realCompanyPointCount = filteredRecords.filter(
    r => r.geo_level === 'coordinate' && r.lng !== null && r.lat !== null
  ).length;
  const clusterCount = projectedPoints.length; // 聚合后的点位数
  const totalRecords = filteredRecords.length;
  const noCoordCount = totalRecords - realCompanyPointCount;

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-amber-50 text-amber-800 text-sm p-4">
        地图省界数据加载失败: {loadError}
        <br />(请确认 /data/china-provinces.json 存在)
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-gradient-to-br from-sky-50 via-slate-50 to-emerald-50 cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 海洋纹理装饰 */}
      <div className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(186,230,253,0.5) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(167,243,208,0.4) 0%, transparent 50%)',
        }}
      />

      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        {/* 中国省界 */}
        {mapData ? (
          <g>
            {mapData.provinces.map((p: ProvincePath) => (
              <path
                key={p.adcode}
                d={p.d}
                fill="#f8fafc"
                fillOpacity={0.85}
                stroke="#cbd5e1"
                strokeWidth={0.6}
                strokeOpacity={0.7}
              />
            ))}
          </g>
        ) : (
          <text x={MAP_WIDTH / 2} y={MAP_HEIGHT / 2} textAnchor="middle" fill="#64748b" fontSize="16">
            加载省界数据中...
          </text>
        )}

        {/* V2.5 公司点位 (聚合簇, 点大小=记录数) */}
        <g>
          {projectedPoints.map((cluster, idx) => {
            const { records, count, x, y } = cluster;
            // 取簇内最高强度作为颜色 (very_high > high > medium > low > unknown)
            const riskOrder = { very_high: 0, high: 1, medium: 2, low: 3, unknown: 4 };
            const topRecord = [...records].sort((a, b) => riskOrder[a.risk_level] - riskOrder[b.risk_level])[0];
            const color = RISK_COLORS[topRecord.risk_level as RiskLevel];
            const radius = getClusterRadius(count);
            const clusterKey = `${cluster.lng.toFixed(6)},${cluster.lat.toFixed(6)}`;
            const isSelected = selectedCompanyCluster !== null &&
              selectedCompanyCluster.length > 0 &&
              `${selectedCompanyCluster[0].lng?.toFixed(6)},${selectedCompanyCluster[0].lat?.toFixed(6)}` === clusterKey;
            return (
              <g
                key={clusterKey}
                transform={`translate(${x}, ${y})`}
                tabIndex={0}
                role="button"
                aria-label={`${count} 条记录, 最高强度 ${color.label}`}
                aria-pressed={isSelected}
                style={{ cursor: 'pointer', outline: isSelected ? `2px solid ${color.stroke}` : 'none', outlineOffset: 2 }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      visible: true,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      record: topRecord, // tooltip 显示最高强度记录
                    });
                    setHoverCluster({ count, records, topRecord });
                  }
                }}
                onMouseMove={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip(prev => ({ ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }));
                  }
                }}
                onMouseLeave={() => {
                  setTooltip(prev => ({ ...prev, visible: false }));
                  setHoverCluster(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectCompanyCluster(isSelected ? null : records);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    selectCompanyCluster(isSelected ? null : records);
                  }
                }}
              >
                {/* 选中脉冲 */}
                {isSelected && (
                  <circle r={radius + 4} fill="none" stroke={color.stroke} strokeWidth={1.5} opacity={0.6}>
                    <animate attributeName="r" values={`${radius + 4};${radius + 10};${radius + 4}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* 阴影 */}
                <circle r={radius} fill="rgba(0,0,0,0.15)" cx={0.6} cy={0.6} />
                {/* 主点 */}
                <circle
                  r={radius}
                  fill={color.fill}
                  stroke={isSelected ? color.stroke : '#ffffff'}
                  strokeWidth={isSelected ? 2 : 1}
                  fillOpacity={0.85}
                />
                {/* 强度字母标记 (色弱友好) */}
                <text
                  y={radius > 8 ? 3 : 2}
                  textAnchor="middle"
                  fontSize={radius > 10 ? 8 : radius > 7 ? 7 : 6}
                  fontWeight={800}
                  fill="#ffffff"
                  style={{ pointerEvents: 'none', letterSpacing: '-0.3px' }}
                >
                  {color.code}
                </text>
                {/* 记录数 (聚合簇 >1 时显示) */}
                {count > 1 && (
                  <text
                    y={-radius - 3}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill="#1e293b"
                    style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 2.5, strokeLinejoin: 'round' }}
                  >
                    {count} 条
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip.visible && tooltip.record && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 pointer-events-none bg-white rounded-lg shadow-xl border border-slate-200 p-3 min-w-[220px] max-w-[280px]"
            style={{
              left: Math.min(tooltip.x + 12, containerWidth - 300),
              top: Math.max(tooltip.y - 100, 8),
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="font-bold text-slate-800 text-sm break-words">{tooltip.record.company_name}</div>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold shrink-0"
                style={{ backgroundColor: RISK_COLORS[tooltip.record.risk_level as RiskLevel].fill }}
              >
                {RISK_COLORS[tooltip.record.risk_level as RiskLevel].label}
              </span>
            </div>
            {hoverCluster && hoverCluster.count > 1 && (
              <div className="text-[11px] text-emerald-600 font-semibold mb-1.5">
                该坐标共 {hoverCluster.count} 条记录 (点击查看列表)
              </div>
            )}
            <div className="text-xs text-slate-500 mb-1.5">
              {tooltip.record.city}
              {tooltip.record.district && ` · ${tooltip.record.district}`}
            </div>
            {tooltip.record.address && (
              <div className="text-[11px] text-slate-600 mb-1.5 break-words">
                📍 {tooltip.record.address}
              </div>
            )}
            <div className="flex flex-wrap gap-1 text-[10px] text-slate-500">
              <span className="px-1.5 py-0.5 bg-slate-100 rounded">{tooltip.record.work_system}</span>
              <span className="px-1.5 py-0.5 bg-slate-100 rounded">{tooltip.record.weekend_type}</span>
              {tooltip.record.geo_level === 'coordinate' && (
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">精确坐标</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">点击查看详情</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 缩放控制 */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 p-1.5 z-20">
        <button
          onClick={() => setZoom(z => Math.min(6, z + 0.25))}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-700 font-bold"
          aria-label="放大"
        >+</button>
        <button
          onClick={() => setZoom(z => Math.max(0.6, z - 0.25))}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-700 font-bold"
          aria-label="缩小"
        >−</button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-700 text-xs"
          aria-label="重置视图"
          title="重置视图"
        >⊙</button>
      </div>

      {/* V2.5 统计条: 真实公司点位 / 聚合簇数 / 无精确坐标记录 */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 px-3 py-2 z-20 text-xs space-y-0.5">
        <div className="font-semibold text-slate-700">公司点位模式</div>
        <div className="text-slate-600">
          真实公司点位：<span className="font-bold text-emerald-600">{realCompanyPointCount}</span> 条
        </div>
        {clusterCount !== realCompanyPointCount && (
          <div className="text-slate-500">
            聚合为 <span className="font-bold text-slate-700">{clusterCount}</span> 个点位
          </div>
        )}
        {noCoordCount > 0 && (
          <div className="text-amber-600">
            无精确坐标记录：<span className="font-bold">{noCoordCount}</span> 条
          </div>
        )}
        {noCoordCount > 0 && (
          <div className="text-[10px] text-slate-400 leading-snug pt-0.5 border-t border-slate-100 mt-0.5">
            无精确坐标记录请切换到城市聚合模式查看
          </div>
        )}
      </div>

      {/* V2.5 空状态: 没有真实公司坐标 + 说明 */}
      {realCompanyPointCount === 0 && totalRecords > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-30 p-4">
          <div className="flex flex-col items-center text-center max-w-sm bg-white rounded-lg shadow-lg border border-slate-200 p-5">
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
              <SearchX className="w-7 h-7 text-amber-500" />
            </div>
            <div className="text-sm font-semibold text-slate-700 mb-1">当前数据没有公司精确坐标</div>
            <div className="text-xs text-slate-500 leading-relaxed mb-2">
              公司点位模式只展示有精确经纬度的数据。<br />
              没有经纬度的数据请在城市聚合模式查看。
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-50 rounded p-2 w-full">
              💡 上传含经纬度的 Excel (列 L/M) 即可在公司点位模式查看精确办公点位。
            </div>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {!mapData && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
          <div className="text-slate-500 text-sm flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
            加载地图数据中...
          </div>
        </div>
      )}
    </div>
  );
}
