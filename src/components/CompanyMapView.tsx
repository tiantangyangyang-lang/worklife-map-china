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
  const selectCompany = useMapStore(s => s.selectCompany);

  const [mapData, setMapData] = useState<ChinaMapData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, record: null });
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

  // 投影所有有坐标的公司记录
  const projectedPoints = useMemo(() => {
    return filteredRecords
      .filter(r => r.lng !== null && r.lat !== null)
      .map(r => {
        const [x, y] = project(r.lng as number, r.lat as number);
        return { record: r, x, y };
      });
  }, [filteredRecords]);

  const pointsWithCoordsCount = projectedPoints.length;
  const totalRecords = filteredRecords.length;
  const noCoordCount = totalRecords - pointsWithCoordsCount;

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

        {/* 公司点位 */}
        <g>
          {projectedPoints.map(({ record, x, y }) => {
            const isSelected = selectedCompany?.id === record.id;
            const color = RISK_COLORS[record.risk_level as RiskLevel];
            return (
              <g
                key={record.id}
                transform={`translate(${x}, ${y})`}
                tabIndex={0}
                role="button"
                aria-label={`${record.company_name}, 工作强度 ${color.label}`}
                aria-pressed={isSelected}
                style={{ cursor: 'pointer', outline: isSelected ? `2px solid ${color.stroke}` : 'none', outlineOffset: 2 }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      visible: true,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      record,
                    });
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
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectCompany(isSelected ? null : record);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    selectCompany(isSelected ? null : record);
                  }
                }}
              >
                {/* 选中脉冲 */}
                {isSelected && (
                  <circle r={POINT_RADIUS + 4} fill="none" stroke={color.stroke} strokeWidth={1.5} opacity={0.6}>
                    <animate attributeName="r" values={`${POINT_RADIUS + 4};${POINT_RADIUS + 10};${POINT_RADIUS + 4}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* 阴影 */}
                <circle r={POINT_RADIUS} fill="rgba(0,0,0,0.15)" cx={0.6} cy={0.6} />
                {/* 主点 */}
                <circle
                  r={POINT_RADIUS}
                  fill={color.fill}
                  stroke={isSelected ? color.stroke : '#ffffff'}
                  strokeWidth={isSelected ? 2 : 1}
                />
                {/* 强度字母标记 (色弱友好) */}
                <text
                  y={2}
                  textAnchor="middle"
                  fontSize={6}
                  fontWeight={800}
                  fill="#ffffff"
                  style={{ pointerEvents: 'none', letterSpacing: '-0.3px' }}
                >
                  {color.code}
                </text>
                {/* 公司名 (选中或悬浮时显示) */}
                {(isSelected) && (
                  <text
                    y={-POINT_RADIUS - 3}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill="#1e293b"
                    style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 2.5, strokeLinejoin: 'round' }}
                  >
                    {record.company_name.length > 12 ? record.company_name.slice(0, 12) + '…' : record.company_name}
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

      {/* 统计条 */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 px-3 py-2 z-20 text-xs">
        <div className="font-semibold text-slate-700 mb-0.5">公司点位模式</div>
        <div className="text-slate-500">
          显示 <span className="font-bold text-emerald-600">{pointsWithCoordsCount}</span> / {totalRecords} 条
          {noCoordCount > 0 && (
            <span className="text-amber-600 ml-1">({noCoordCount} 条无坐标)</span>
          )}
        </div>
      </div>

      {/* 空状态: 没有公司坐标 */}
      {pointsWithCoordsCount === 0 && totalRecords > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-30 p-4">
          <div className="flex flex-col items-center text-center max-w-sm bg-white rounded-lg shadow-lg border border-slate-200 p-5">
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
              <SearchX className="w-7 h-7 text-amber-500" />
            </div>
            <div className="text-sm font-semibold text-slate-700 mb-1">当前数据没有公司精确坐标</div>
            <div className="text-xs text-slate-500 leading-relaxed">
              公司点位模式需要每条记录包含经纬度 (Excel 第 11/12 列)。<br />
              请切换到 <strong>城市聚合模式</strong> 查看城市级数据, 或上传含经纬度的 Excel。
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
