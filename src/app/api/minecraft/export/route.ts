import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import type { CompanyRecord } from '@/lib/types';

/**
 * GET /api/minecraft/export?city=深圳&limit=50
 *
 * Returns a subset of companies that meet the strict Minecraft export
 * criteria (non‑empty lng/lat, geo_level === "coordinate", coord_system ===
 * "WGS84"). The response shape matches the specification:
 *   { city, bbox, companies }
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function loadCompanies(): CompanyRecord[] {
  // Prefer the live dataset; fall back to the example file for this edition.
  try {
    const filePath = path.resolve(process.cwd(), 'minecraft-edition/data/shenzhen-companies.example.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as CompanyRecord[];
  } catch (e) {
    console.error('Failed to load Minecraft edition companies:', e);
    return [];
  }
}

function computeBbox(records: CompanyRecord[]) {
  if (records.length === 0) return null;
  const lngs = records.map(r => r.lng as number);
  const lats = records.map(r => r.lat as number);
  return {
    min_lng: Math.min(...lngs),
    max_lng: Math.max(...lngs),
    min_lat: Math.min(...lats),
    max_lat: Math.max(...lats)
  };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const cityParam = params.get('city')?.trim() ?? '';
  const limitRaw = parseInt(params.get('limit') ?? '0', 10);
  const limit = limitRaw > 0 ? limitRaw : 50;

  const all = loadCompanies();
  const filtered = all.filter(c =>
    c.city === cityParam &&
    c.lng != null && c.lat != null &&
    c.geo_level === 'coordinate' &&
    // CoordSystem type is lowercase; compare case‑insensitively.
    (c.coord_system as string).toUpperCase() === 'WGS84'
  );

  const slice = filtered.slice(0, limit);
  const bbox = computeBbox(slice);

  return NextResponse.json({
    city: cityParam,
    bbox,
    companies: slice
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
