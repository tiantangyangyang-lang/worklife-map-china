import * as fs from 'fs';
import * as path from 'path';

interface Marker {
  id: string;
  company_name: string;
  mcX: number;
  mcZ: number;
  intensity_level: string;
  [key: string]: any;
}

const markersPath = 'minecraft-edition/dist/markers.json';
const markers: Marker[] = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), markersPath), 'utf-8'));

function npcName(name: string): string {
  // Use 前台 as default suffix
  return `${name}前台`;
}

const lines: string[] = [];
for (const m of markers) {
  const npc = npcName(m.company_name);
  // Create NPC at location (y=64 placeholder)
  lines.push(`npc create ${m.mcX} 64 ${m.mcZ} --name "${npc}"`);
  // Bind worklife command
  lines.push(`npc command add ${m.mcX} 64 ${m.mcZ} /worklife company ${m.id}`);
}

const outDir = path.resolve(process.cwd(), 'minecraft-edition/dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'citizens-commands.txt'), lines.join('\n'), 'utf-8');

console.log('Generated', lines.length / 2, 'citizen NPCs');
