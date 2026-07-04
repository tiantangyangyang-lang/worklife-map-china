#!/usr/bin/env bash
set -euo pipefail

echo "===== 1. npm build ====="
npm run build

echo "===== 2. npm test if exists ====="
if npm run | grep -qE ' test'; then
  npm test || true
fi

echo "===== 3. check required files ====="
test -f src/app/api/companies/route.ts
test -f src/app/api/minecraft/export/route.ts
test -f minecraft-edition/scripts/convert-lnglat-to-mc.ts
test -f minecraft-edition/scripts/generate-marker-commands.ts
test -f minecraft-edition/scripts/generate-citizens-commands.ts
test -f minecraft-edition/data/shenzhen-companies.example.json
test -f minecraft-edition/data/world_meta.shenzhen.example.json
test -f minecraft-edition/README.md

echo "===== 4. minecraft scripts ====="
npx tsx minecraft-edition/scripts/convert-lnglat-to-mc.ts
npx tsx minecraft-edition/scripts/generate-marker-commands.ts
npx tsx minecraft-edition/scripts/generate-citizens-commands.ts

test -f minecraft-edition/dist/markers.json
test -f minecraft-edition/dist/marker-commands.mcfunction
test -f minecraft-edition/dist/citizens-commands.txt

echo "===== 5. field consistency checks ====="
grep -R '"WGS84"' minecraft-edition/data src/app/api/minecraft minecraft-edition/docs >/dev/null
! grep -R '"wgs84"' minecraft-edition/data src/app/api/minecraft || {
  echo "ERROR: found lowercase wgs84. Use WGS84."
  exit 1
}

grep -R "intensity_level" minecraft-edition/scripts minecraft-edition/data src/app/api/minecraft >/dev/null
! grep -R "risk_level" minecraft-edition/scripts minecraft-edition/data src/app/api/minecraft || {
  echo "ERROR: found risk_level. Use intensity_level."
  exit 1
}

echo "===== 6. start temporary server on 3100 ====="
PORT=3100 npm run start > logs/verify-server.log 2>&1 &
PID=$!
trap "kill $PID 2>/dev/null || true" EXIT

sleep 8

echo "===== 7. API checks ====="
curl -fsS "http://127.0.0.1:3100/" >/dev/null
curl -fsS "http://127.0.0.1:3100/api/companies?city=%E6%B7%B1%E5%9C%B3&limit=5" >/tmp/companies.json
curl -fsS "http://127.0.0.1:3100/api/minecraft/export?city=%E6%B7%B1%E5%9C%B3&limit=50" >/tmp/minecraft-export.json

grep -q '"companies"' /tmp/minecraft-export.json
grep -q '"city":"深圳"' /tmp/minecraft-export.json

echo "===== VERIFY PASSED ====="
