'use client';

// ============================================================
// V3 2.5D 城市工作强度柱状地图 (MapLibre + deck.gl ColumnLayer)
//
// V3.1 修复:
//   - 移除 deck.gl TextLayer (在部分 WebGL 环境 shader 编译失败, 错误源码被显示到页面)
//   - showLabels 默认 false, 开关保留但提示"城市标签暂未启用"
//   - MapboxOverlay interleaved: false (独立 canvas, 避免与底图 shader 冲突)
//   - onError 错误处理, 不把 shader 源码渲染给用户
//   - 全局 maplibre-gl.css 已在 globals.css 引入
//
// 只保留 ColumnLayer:
//   - 数据来源: citySummaries
//   - getPosition: [lng, lat]
//   - extruded: true, pickable: true, autoHighlight: true
//   - 高度: Math.sqrt(total_records || total || 1) * 8000 * heightMultiplier
//   - 颜色: risk_dominant → rgba
// ============================================================
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ColumnLayer } from '@deck.gl/layers';
import { useMapStore } from '@/store/useMapStore';
import { RISK_COLORS } from '@/lib/types';
import type { CitySummary, RiskLevel } from '@/lib/types';
import { Loader2, AlertCircle, Mountain, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** V3: 高度指标选项 */
type HeightMetric = 'total' | 'highCount' | 'highRatio';

/** V3: 颜色映射 (rgba 数组, deck.gl 需要) */
const RISK_RGBA: Record<RiskLevel, [number, number, number, number]> = {
  low: [34, 197, 94, 200],          // 绿
  medium: [234, 179, 8, 200],        // 黄
  high: [249, 115, 22, 220],         // 红 (橙红)
  very_high: [220, 38, 38, 230],     // 深红
  unknown: [156, 163, 175, 180],     // 灰
};

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  city: CitySummary | null;
}

export function Deck25DMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);

  const citySummaries = useMapStore(s => s.citySummaries);
  const selectCity = useMapStore(s => s.selectCity);

  // V3 控制面板状态
  const [heightMetric, setHeightMetric] = useState<HeightMetric>('total');
  const [heightMultiplier, setHeightMultiplier] = useState(1);
  // V3.1: showLabels 默认 false, TextLayer 已禁用
  const [showLabels, setShowLabels] = useState(false);

  const [mapError, setMapError] = useState<string | null>(null);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, city: null });

  // ===== 计算柱子高度 =====
  const getColumnHeight = useMemo(() => {
    return (city: CitySummary): number => {
      const totalValue = city.total_records || city.total || 1;
      let base: number;
      switch (heightMetric) {
        case 'highCount':
          // 高强度数量 = high + very_high
          base = (city.count_high + city.count_very_high) * 1500;
          break;
        case 'highRatio':
          // 高强度比例 (0-100) → 高度
          base = (city.high_intensity_ratio || 0) * 300;
          break;
        case 'total':
        default:
          // 用 sqrt 平滑, 避免上海/北京太夸张
          base = Math.sqrt(totalValue) * 8000;
          break;
      }
      const height = base * heightMultiplier;
      // 最小高度 1000 (约 1km, 保证小城市可见)
      // 最大高度 300000 (约 300km, 避免北京/上海柱子过高刺破视角)
      return Math.max(1000, Math.min(300000, height));
    };
  }, [heightMetric, heightMultiplier]);

  // ===== 初始化 MapLibre 底图 =====
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm-tiles',
              paint: {
                'raster-opacity': 0.7,
              },
            },
          ],
        },
        center: [104, 35],
        zoom: 3.2,
        pitch: 50,
        bearing: -20,
        maxZoom: 10,
        minZoom: 2,
      });

      mapRef.current = map;

      map.on('load', () => {
        setMapReady(true);
      });

      map.on('error', (e) => {
        // V3.1: 静默处理瓦片加载错误 (网络问题), 只在控制台记录
        // 不把错误显示给用户, 避免页面被 shader 源码污染
        console.warn('[Deck25DMapView] maplibre warning:', e.error?.message || e);
        // 只在 style 加载失败 (非单瓦片失败) 时才显示错误
        if (e.error && typeof e.error.message === 'string' && e.error.message.includes('style')) {
          setMapError('地图样式加载失败');
        }
      });
    } catch (e) {
      console.error('[Deck25DMapView] init error:', e);
      setMapError(e instanceof Error ? e.message : '地图初始化失败');
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn('[Deck25DMapView] cleanup error:', e);
        }
        mapRef.current = null;
        overlayRef.current = null;
      }
    };
  }, []);

  // ===== V3.1: deck.gl overlay 集成 (interleaved: false 避免与底图 shader 冲突) =====
  useEffect(() => {
    if (!mapReady || !mapRef.current || overlayRef.current) return;

    try {
      const overlay = new MapboxOverlay({
        // V3.1: interleaved: false → deck.gl 使用独立 canvas, 不与 MapLibre 的 GL 上下文混合
        // 避免 TextLayer/其它图层 shader 编译失败时错误冒泡到 MapLibre
        interleaved: false,
        layers: [],
        // V3.1: onError 拦截 deck.gl 内部错误 (含 shader 编译失败),
        // 不让错误源码显示到页面上, 只显示友好提示
        onError: (err: Error) => {
          console.error('[Deck25DMapView] deck.gl layer error:', err);
          setLayerError('2.5D 图层渲染失败, 请切换到城市聚合模式或刷新页面');
        },
      });
      mapRef.current.addControl(overlay as any, 'top-left');
      overlayRef.current = overlay;
    } catch (e) {
      console.error('[Deck25DMapView] overlay init error:', e);
      setLayerError('2.5D 图层初始化失败');
    }
  }, [mapReady]);

  // ===== 点击柱子 → selectCity =====
  const handleColumnClick = useCallback((info: any) => {
    if (info.object?.city) {
      selectCity(info.object.city.city);
    }
  }, [selectCity]);

  // ===== 悬浮柱子 → tooltip =====
  const handleColumnHover = useCallback((info: any, event: any) => {
    if (info.object) {
      const canvas = mapRef.current?.getCanvas();
      const rect = canvas?.getBoundingClientRect();
      if (rect && event?.srcClientX !== undefined) {
        setTooltip({
          visible: true,
          x: event.srcClientX - rect.left,
          y: event.srcClientY - rect.top,
          city: info.object.city,
        });
      }
    } else {
      setTooltip(prev => ({ ...prev, visible: false }));
    }
  }, []);

  // ===== 更新 deck.gl ColumnLayer (citySummaries / 控制状态变化时) =====
  useEffect(() => {
    if (!overlayRef.current || !mapReady) return;

    try {
      const columnData = citySummaries
        .filter(c => c.lng != null && c.lat != null)
        .map(c => ({
          position: [c.lng, c.lat] as [number, number],
          elevation: getColumnHeight(c),
          color: RISK_RGBA[c.risk_dominant as RiskLevel] || RISK_RGBA.unknown,
          city: c,
        }));

      // V3.1: 只保留 ColumnLayer, 不创建 TextLayer
      const columnLayer = new ColumnLayer({
        id: 'city-columns',
        data: columnData,
        diskResolution: 12,
        radius: 18000, // 米
        extruded: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 100],
        getElevation: (d: any) => d.elevation,
        getFillColor: (d: any) => d.color,
        getLineColor: [0, 0, 0, 60],
        getLineWidth: 100,
        onHover: handleColumnHover,
        onClick: handleColumnClick,
      });

      overlayRef.current.setProps({ layers: [columnLayer] });
      // 清除之前的图层错误 (如果本次更新成功)
      setLayerError(null);
    } catch (e) {
      console.error('[Deck25DMapView] layer update error:', e);
      setLayerError('2.5D 图层渲染失败, 请切换到城市聚合模式或刷新页面');
    }
  }, [citySummaries, mapReady, heightMetric, heightMultiplier, getColumnHeight, handleColumnHover, handleColumnClick]);

  // ===== 加载失败 fallback (底图失败) =====
  if (mapError) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100 p-6">
        <div className="flex flex-col items-center text-center max-w-md bg-white rounded-lg shadow-lg border border-slate-200 p-6">
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <div className="text-sm font-semibold text-slate-700 mb-1">2.5D 地图加载失败</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            请检查网络或底图配置。
          </div>
          <div className="text-[11px] text-slate-400 mt-3 bg-slate-50 rounded p-2 w-full">
            💡 提示: 2.5D 模式需要访问 OpenStreetMap 瓦片服务器。如果网络受限, 请切换到"城市聚合"模式。
          </div>
        </div>
      </div>
    );
  }

  // ===== 图层渲染失败 fallback (deck.gl shader 错误) =====
  if (layerError) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100 p-6">
        <div className="flex flex-col items-center text-center max-w-md bg-white rounded-lg shadow-lg border border-slate-200 p-6">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7 text-amber-500" />
          </div>
          <div className="text-sm font-semibold text-slate-700 mb-1">2.5D 图层渲染失败</div>
          <div className="text-xs text-slate-500 leading-relaxed mb-3">
            {layerError}
          </div>
          <div className="text-[11px] text-slate-400 bg-slate-50 rounded p-2 w-full">
            💡 请切换到"城市聚合"模式或刷新页面重试。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100">
      {/* MapLibre 容器 */}
      <div ref={containerRef} className="w-full h-full" />

      {/* 加载中 */}
      {!mapReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm z-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <div className="text-slate-500 text-sm">正在加载 2.5D 地图...</div>
          </div>
        </div>
      )}

      {/* V3 右上角控制面板 (位于模式切换器下方) */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="absolute top-16 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 p-3 z-20 w-56 space-y-3"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 border-b border-slate-100 pb-2">
          <Mountain className="w-3.5 h-3.5 text-emerald-600" />
          2.5D 强度图控制
        </div>

        {/* 高度指标切换 */}
        <div>
          <div className="text-[11px] text-slate-500 mb-1">高度指标</div>
          <div className="flex gap-1">
            {([
              { value: 'total', label: '总记录数' },
              { value: 'highCount', label: '高强度数量' },
              { value: 'highRatio', label: '高强度比例' },
            ] as { value: HeightMetric; label: string }[]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setHeightMetric(opt.value)}
                className={`flex-1 px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  heightMetric === opt.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 高度倍率 slider */}
        <div>
          <div className="text-[11px] text-slate-500 mb-1 flex justify-between">
            <span>柱子高度倍率</span>
            <span className="font-mono text-emerald-600">{heightMultiplier.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3"
            step="0.1"
            value={heightMultiplier}
            onChange={e => setHeightMultiplier(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
        </div>

        {/* V3.1: 城市标签开关 (保留但提示"暂未启用", 不实际渲染 TextLayer) */}
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            显示城市标签
          </div>
          <button
            onClick={() => setShowLabels(s => !s)}
            className={`relative w-9 h-5 rounded-full transition-colors ${showLabels ? 'bg-emerald-600' : 'bg-slate-300'}`}
            aria-label="切换城市标签"
            title="城市标签暂未启用"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showLabels ? 'translate-x-4' : ''}`}
            />
          </button>
        </div>
        {showLabels && (
          <div className="text-[10px] text-amber-600 bg-amber-50 rounded p-1.5">
            城市标签暂未启用 (TextLayer 在部分浏览器 shader 编译不稳定)
          </div>
        )}

        {/* 图例 */}
        <div className="border-t border-slate-100 pt-2">
          <div className="text-[10px] text-slate-400 mb-1">强度图例</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
            {(['low', 'medium', 'high', 'very_high', 'unknown'] as RiskLevel[]).map(rl => (
              <div key={rl} className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ backgroundColor: RISK_COLORS[rl].fill }}
                />
                <span className="text-slate-600">{RISK_COLORS[rl].label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tooltip (V3.1: 完整字段 - 低/中/高/极高/占比/主导) */}
      <AnimatePresence>
        {tooltip.visible && tooltip.city && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 pointer-events-none bg-white rounded-lg shadow-xl border border-slate-200 p-3 min-w-[230px] max-w-[270px]"
            style={{
              left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth || 800) - 290),
              top: Math.max(tooltip.y - 140, 8),
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-bold text-slate-800 text-base">{tooltip.city.city}</div>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold shrink-0"
                style={{ backgroundColor: RISK_COLORS[tooltip.city.risk_dominant as RiskLevel].fill }}
              >
                {RISK_COLORS[tooltip.city.risk_dominant as RiskLevel].label}
              </span>
            </div>
            <div className="text-xs text-slate-500 mb-2">
              总记录: <span className="font-bold text-slate-700">{tooltip.city.total_records || tooltip.city.total}</span> 条 ·
              强度评分 <span className="font-bold text-slate-700">{tooltip.city.avg_intensity_score || tooltip.city.risk_score}</span>/100
            </div>

            {/* V3.1: 强度分布 (低/中/高/极高) */}
            <div className="grid grid-cols-4 gap-1 text-center mb-2">
              <div className="bg-green-50 rounded p-1">
                <div className="text-green-700 font-bold text-sm">{tooltip.city.low_count ?? tooltip.city.count_low}</div>
                <div className="text-[9px] text-slate-500">低强度</div>
              </div>
              <div className="bg-yellow-50 rounded p-1">
                <div className="text-yellow-700 font-bold text-sm">{tooltip.city.medium_count ?? tooltip.city.count_medium}</div>
                <div className="text-[9px] text-slate-500">中强度</div>
              </div>
              <div className="bg-orange-50 rounded p-1">
                <div className="text-orange-700 font-bold text-sm">{tooltip.city.high_count ?? tooltip.city.count_high}</div>
                <div className="text-[9px] text-slate-500">高强度</div>
              </div>
              <div className="bg-red-50 rounded p-1">
                <div className="text-red-700 font-bold text-sm">{tooltip.city.very_high_count ?? tooltip.city.count_very_high}</div>
                <div className="text-[9px] text-slate-500">极高</div>
              </div>
            </div>

            {/* 区域分布 */}
            <div className="grid grid-cols-3 gap-1 text-center mb-2">
              <div className="bg-green-50 rounded p-1">
                <div className="text-green-700 font-bold text-sm">{tooltip.city.count_955}</div>
                <div className="text-[9px] text-slate-500">955</div>
              </div>
              <div className="bg-yellow-50 rounded p-1">
                <div className="text-yellow-700 font-bold text-sm">{tooltip.city.count_965}</div>
                <div className="text-[9px] text-slate-500">965</div>
              </div>
              <div className="bg-red-50 rounded p-1">
                <div className="text-red-700 font-bold text-sm">{tooltip.city.count_996}</div>
                <div className="text-[9px] text-slate-500">996</div>
              </div>
            </div>

            {/* V3.1: 高强度占比 + 主导强度 */}
            <div className="text-[11px] text-slate-600 space-y-0.5 border-t border-slate-100 pt-1.5">
              <div>高强度占比: <span className="font-semibold text-red-600">{tooltip.city.high_intensity_ratio ?? 0}%</span></div>
              <div>主导强度: <span className="font-semibold">{RISK_COLORS[tooltip.city.dominant_level as RiskLevel]?.label || RISK_COLORS[tooltip.city.risk_dominant as RiskLevel]?.label}</span></div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5 text-center">点击查看详情</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
