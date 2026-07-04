import * as fs from 'fs';
import * as path from 'path';

interface Company {
  id: string;
  company_name: string;
  lng: number;
  lat: number;
  coord_system: string;
  geo_level: string;
  intensity_level: string;
  [key: string]: any;
}

interface WorldMeta {
  min_lng: number;
  max_lng: number;
  min_lat: number;
  max_lat: number;
  world_width: number;
  world_depth: number;
  offsetX?: number;
  offsetZ?: number;
}

function loadJson<T>(filePath: string): T {
  const abs = path.resolve(process.cwd(), filePath);
  const data = fs.readFileSync(abs, 'utf-8');
  return JSON.parse(data) as T;
}

const companiesPath = 'minecraft-edition/data/shenzhen-companies.example.json';
const metaPath = 'minecraft-edition/data/world_meta.shenzhen.example.json';

const companies = loadJson<Company[]>(companiesPath);
const meta = loadJson<WorldMeta>(metaPath);

const { min_lng, max_lng, min_lat, max_lat, world_width, world_depth, offsetX = 0, offsetZ = 0 } = meta;

function toMinecraftX(lng: number): number {
  return Math.round(((lng - min_lng) / (max_lng - min_lng)) * world_width) + offsetX;
}

function toMinecraftZ(lat: number): number {
  // Minecraft Z increases southward, so we invert latitude direction
  return Math.round(((max_lat - lat) / (max_lat - min_lat)) * world_depth) + offsetZ;
}

const markers = companies.map(c => ({
  ...c,
  mcX: toMinecraftX(c.lng),
  mcZ: toMinecraftZ(c.lat)
}));

const outDir = path.resolve(process.cwd(), 'minecraft-edition/dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'markers.json'), JSON.stringify(markers, null, 2), 'utf-8');

console.log('Generated', markers.length, 'markers to dist/markers.json');
