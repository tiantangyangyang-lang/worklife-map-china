'use client';

// ============================================================
// 中国城市作息地图 - SVG 交互式地图组件
// ============================================================
import { useEffect, useState, useMemo, useRef } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { project, MAP_WIDTH, MAP_HEIGHT, type ChinaMapData, type ProvincePath } from '@/lib/projection';
import { RISK_COLORS } from '@/lib/types';
import type { CitySummary, RiskLevel } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

/** 根据记录数计算点位半径 */
function getRadius(total: number): number {
  // 4 ~ 18px 之间, 用 log 平滑
  if (total <= 0) return 0;
  const min = 4;
  const max = 18;
  const logTotal = Math.log(total + 1);
  const logMax = Math.log(100); // 100 records → max size
  return min + (max - min) * Math.min(1, logTotal / logMax);
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  city: CitySummary | null;
}

export function MapView() {
  const citySummaries = useMapStore(s => s.citySummaries);
  const selectedCity = useMapStore(s => s.selectedCity);
  const hoveredCity = useMapStore(s => s.hoveredCity);
  const selectCity = useMapStore(s => s.selectCity);
  const hoverCity = useMapStore(s => s.hoverCity);

  const [mapData, setMapData] = useState<ChinaMapData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, city: null });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载中国省界 GeoJSON
  useEffect(() => {
    fetch('/data/china-provinces.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: ChinaMapData) => setMapData(data))
      .catch(err => setLoadError(err.message));
  }, []);

  // 监听容器宽度 (用于 tooltip 定位)
  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => setContainerWidth(containerRef.current?.clientWidth || 800);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 鼠标拖动平移 (用 ref 存起始位置, 但用 state 控制是否在拖拽以驱动样式)
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

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.6, Math.min(4, z + delta)));
  };

  // 投影所有城市
  const projectedCities = useMemo(() => {
    return citySummaries
      .filter(c => c.lng != null && c.lat != null)
      .map(c => {
        const [x, y] = project(c.lng, c.lat);
        return { ...c, x, y, r: getRadius(c.total) };
      });
  }, [citySummaries]);

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
        ref={svgRef}
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

        {/* 城市连线 (从城市点到中心点的引线) - 仅在选中时显示 */}

        {/* 城市点位 */}
        <g>
          {projectedCities.map(city => {
            const isSelected = selectedCity === city.city;
            const isHovered = hoveredCity === city.city;
            const color = RISK_COLORS[city.risk_dominant as RiskLevel];

            return (
              <g
                key={city.city}
                transform={`translate(${city.x}, ${city.y})`}
                tabIndex={0}
                role="button"
                aria-label={`${city.city}, ${city.total} 条作息记录, 工作强度 ${color.label}, 强度评分 ${city.risk_score}`}
                aria-pressed={isSelected}
                style={{ cursor: 'pointer', outline: isSelected ? `2px solid ${color.stroke}` : 'none', outlineOffset: 2 }}
                onMouseEnter={(e) => {
                  hoverCity(city.city);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      visible: true,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      city,
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
                  hoverCity(null);
                  setTooltip(prev => ({ ...prev, visible: false }));
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectCity(isSelected ? null : city.city);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    selectCity(isSelected ? null : city.city);
                  }
                }}
                onFocus={() => {
                  hoverCity(city.city);
                }}
                onBlur={() => {
                  hoverCity(null);
                  setTooltip(prev => ({ ...prev, visible: false }));
                }}
              >
                {/* 外环脉冲 (选中时) */}
                {isSelected && (
                  <circle r={city.r + 6} fill="none" stroke={color.stroke} strokeWidth={1.5} opacity={0.6}>
                    <animate attributeName="r" values={`${city.r + 6};${city.r + 14};${city.r + 6}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* 阴影 */}
                <circle r={city.r} fill="rgba(0,0,0,0.15)" cx={0.8} cy={0.8} />
                {/* 主点 */}
                <circle
                  r={city.r}
                  fill={color.fill}
                  stroke={isSelected || isHovered ? color.stroke : '#ffffff'}
                  strokeWidth={isSelected || isHovered ? 2.5 : 1.2}
                />
                {/* 强度字母标记 (色弱友好) - 大点显示, 小点 hover/selected 时显示 */}
                {(city.r > 8 || isHovered || isSelected) && (
                  <text
                    y={city.r > 10 ? 4 : 3}
                    textAnchor="middle"
                    fontSize={city.r > 12 ? 11 : city.r > 10 ? 10 : 9}
                    fontWeight={800}
                    fill="#ffffff"
                    style={{ pointerEvents: 'none', letterSpacing: '-0.5px' }}
                  >
                    {color.code}
                  </text>
                )}
                {/* 城市标签 (大点显示文字) */}
                {(city.r > 8 || isHovered || isSelected) && (
                  <text
                    y={-city.r - 4}
                    textAnchor="middle"
                    fontSize={isHovered || isSelected ? 14 : 11}
                    fontWeight={isHovered || isSelected ? 700 : 500}
                    fill="#1e293b"
                    style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 3, strokeLinejoin: 'round' }}
                  >
                    {city.city}
                  </text>
                )}
                {/* 记录数 (在标签下方, hover/selected 时显示) */}
                {(isHovered || isSelected) && (
                  <text
                    y={-city.r - 18}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={500}
                    fill="#64748b"
                    style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 2, strokeLinejoin: 'round' }}
                  >
                    {city.total} 条
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip.visible && tooltip.city && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 pointer-events-none bg-white rounded-lg shadow-xl border border-slate-200 p-3 min-w-[200px]"
            style={{
              left: Math.min(tooltip.x + 12, containerWidth - 220),
              top: Math.max(tooltip.y - 90, 8),
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-bold text-slate-800 text-base">{tooltip.city.city}</div>
              <span
                className="text-xs px-2 py-0.5 rounded-full text-white font-semibold"
                style={{ backgroundColor: RISK_COLORS[tooltip.city.risk_dominant as RiskLevel].fill }}
              >
                {RISK_COLORS[tooltip.city.risk_dominant as RiskLevel].label}
              </span>
            </div>
            <div className="text-xs text-slate-500 mb-2">总记录: {tooltip.city.total} 条 · 强度评分 {tooltip.city.risk_score}</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-50 rounded p-1.5">
                <div className="text-green-700 font-bold text-sm">{tooltip.city.count_955}</div>
                <div className="text-[10px] text-slate-500">955</div>
              </div>
              <div className="bg-yellow-50 rounded p-1.5">
                <div className="text-yellow-700 font-bold text-sm">{tooltip.city.count_965}</div>
                <div className="text-[10px] text-slate-500">965</div>
              </div>
              <div className="bg-red-50 rounded p-1.5">
                <div className="text-red-700 font-bold text-sm">{tooltip.city.count_996}</div>
                <div className="text-[10px] text-slate-500">996</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 缩放控制 */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 p-1.5 z-20">
        <button
          onClick={() => setZoom(z => Math.min(4, z + 0.25))}
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
