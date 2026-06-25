'use client';

// ============================================================
// V3 2.5D 城市工作强度柱状地图 (MapLibre + deck.gl ColumnLayer)
//
// - MapLibre 作为底图 (raster tile, OSM 风格)
// - deck.gl ColumnLayer 渲染城市柱状图
// - 柱子高度 = Math.sqrt(total) * 8000 * heightMultiplier
// - 柱子颜色 = risk_dominant 对应颜色
// - 鼠标悬浮显示 tooltip
// - 点击柱子调用 selectCity
// - 右上角控制面板: 高度指标切换 / 高度倍率 slider / 城市标签开关
// ============================================================
import { useEffect, useRef, useState, useMemo } from 'react';
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
  high: [249, 115, 22, 220],         // 橙红
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
  const selectedCity = useMapStore(s => s.selectedCity);
  const selectCity = useMapStore(s => s.selectCity);

  // V3 控制面板状态
  const [heightMetric, setHeightMetric] = useState<HeightMetric>('total');
  const [heightMultiplier, setHeightMultiplier] = useState(1);
  const [showLabels, setShowLabels] = useState(true);

  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, city: null });

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
        console.error('[Deck25DMapView] maplibre error:', e);
        setMapError(e.error?.message || '地图加载失败');
      });
    } catch (e) {
      console.error('[Deck25DMapView] init error:', e);
      setMapError(e instanceof Error ? e.message : '地图初始化失败');
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // ===== V3: deck.gl overlay 集成 (MapboxOverlay 方式) =====
  useEffect(() => {
    if (!mapReady || !mapRef.current || overlayRef.current) return;

    try {
      const overlay = new MapboxOverlay({
        interleaved: true,
        layers: [],
      });
      mapRef.current.addControl(overlay as any, 'top-left');
      overlayRef.current = overlay;
    } catch (e) {
      console.error('[Deck25DMapView] overlay init error:', e);
    }
  }, [mapReady]);

  // ===== 计算柱子高度 =====
  const getColumnHeight = useMemo(() => {
    return (city: CitySummary): number => {
      let base: number;
      switch (heightMetric) {
        case 'highCount':
          base = (city.count_high + city.count_very_high) * 1500;
          break;
        case 'highRatio':
          base = (city.high_intensity_ratio || 0) * 300;
          break;
        case 'total':
        default:
          // 用 sqrt 平滑, 避免上海/北京太夸张
          base = Math.sqrt(city.total) * 8000;
          break;
      }
      const height = base * heightMultiplier;
      // 最小高度 1000, 最大高度 300000 (约 300km, 视觉合理)
      return Math.max(1000, Math.min(300000, height));
    };
  }, [heightMetric, heightMultiplier]);

  // ===== 更新 deck.gl layers (citySummaries / 控制状态变化时) =====
  useEffect(() => {
    if (!overlayRef.current || !mapReady) return;

    const columnData = citySummaries
      .filter(c => c.lng != null && c.lat != null)
      .map(c => ({
        position: [c.lng, c.lat] as [number, number],
        elevation: getColumnHeight(c),
        color: RISK_RGBA[c.risk_dominant as RiskLevel] || RISK_RGBA.unknown,
        city: c,
      }));

    const columnLayer = new ColumnLayer({
      id: 'city-columns',
      data: columnData,
      diskResolution: 12,
      radius: 18000, // 米, 视觉合理
      extruded: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 100],
      getElevation: (d: any) => d.elevation,
      getFillColor: (d: any) => d.color,
      getLineColor: [0, 0, 0, 60],
      getLineWidth: 100,
      onHover: (info: any, event: any) => {
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
      },
      onClick: (info: any) => {
        if (info.object?.city) {
          selectCity(info.object.city.city);
        }
      },
    });

    // 标签层 (TextLayer, 仅 showLabels 时显示)
    const layers: any[] = [columnLayer];
    if (showLabels) {
      // 动态导入避免 SSR
      const { TextLayer } = require('@deck.gl/layers');
      const labelData = citySummaries
        .filter(c => c.lng != null && c.lat != null)
        .map(c => ({
          position: [c.lng, c.lat, getColumnHeight(c) + 2000] as [number, number, number],
          text: `${c.city}\n${c.total}条`,
          city: c,
        }));
      layers.push(new TextLayer({
        id: 'city-labels',
        data: labelData,
        getPosition: (d: any) => d.position,
        getText: (d: any) => d.text,
        getSize: 14,
        getColor: [30, 41, 59, 255],
        getBackgroundColor: [255, 255, 255, 220],
        getPixelOffset: [0, -10],
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'bottom',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: 600,
        outlineWidth: 0,
        backgroundPadding: [4, 2, 4, 2],
        billboard: false,
      }));
    }

    overlayRef.current.setProps({ layers });
  }, [citySummaries, mapReady, heightMetric, heightMultiplier, showLabels, selectCity, getColumnHeight]);

  // ===== 加载失败 fallback =====
  if (mapError) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100 p-6">
        <div className="flex flex-col items-center text-center max-w-md bg-white rounded-lg shadow-lg border border-slate-200 p-6">
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <div className="text-sm font-semibold text-slate-700 mb-1">2.5D 地图加载失败</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            请检查网络或底图配置。<br />
            错误: {mapError}
          </div>
          <div className="text-[11px] text-slate-400 mt-3 bg-slate-50 rounded p-2 w-full">
            💡 提示: 2.5D 模式需要访问 OpenStreetMap 瓦片服务器。如果网络受限, 请切换到"城市聚合"模式。
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

        {/* 城市标签开关 */}
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            显示城市标签
          </div>
          <button
            onClick={() => setShowLabels(s => !s)}
            className={`relative w-9 h-5 rounded-full transition-colors ${showLabels ? 'bg-emerald-600' : 'bg-slate-300'}`}
            aria-label="切换城市标签"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showLabels ? 'translate-x-4' : ''}`}
            />
          </button>
        </div>

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

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip.visible && tooltip.city && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 pointer-events-none bg-white rounded-lg shadow-xl border border-slate-200 p-3 min-w-[220px] max-w-[260px]"
            style={{
              left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth || 800) - 280),
              top: Math.max(tooltip.y - 120, 8),
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
              总记录: <span className="font-bold text-slate-700">{tooltip.city.total}</span> 条 ·
              强度评分 <span className="font-bold text-slate-700">{tooltip.city.risk_score}</span>/100
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
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
            <div className="text-[11px] text-slate-600 space-y-0.5 border-t border-slate-100 pt-1.5">
              <div>高强度占比: <span className="font-semibold text-red-600">{tooltip.city.high_intensity_ratio}%</span></div>
              <div>主导强度: <span className="font-semibold">{RISK_COLORS[tooltip.city.risk_dominant as RiskLevel].label}</span></div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5 text-center">点击查看详情</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
