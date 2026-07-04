import * as fs from 'fs';
import * as path from 'path';

interface Marker {
  id: string;
  mcX: number;
  mcZ: number;
  intensity_level: string;
  [key: string]: any;
}

const intensityMap: Record<string, string> = {
  low: 'green_concrete',
  medium: 'yellow_concrete',
  high: 'orange_concrete',
  very_high: 'red_concrete',
  unknown: 'gray_concrete'
};

const markersPath = 'minecraft-edition/dist/markers.json';
const markers: Marker[] = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), markersPath), 'utf-8'));

const lines = markers.map(m => {
  const block = intensityMap[m.intensity_level] ?? intensityMap['unknown'];
  // setblock command with absolute coordinates (y left as 64 as placeholder)
  return `setblock ${m.mcX} 64 ${m.mcZ} minecraft:${block}`;
});

const outDir = path.resolve(process.cwd(), 'minecraft-edition/dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'marker-commands.mcfunction'), lines.join('\n'), 'utf-8');

console.log('Generated', lines.length, 'marker commands');
