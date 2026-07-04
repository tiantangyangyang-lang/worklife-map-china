# Generate a Minecraft world with Arnis

Arnis is a tool that converts OSM data into a Minecraft world. The steps below
create a blank world ready for the WorkLife Map data.

1. Install Arnis (requires Node ≥ 18):
   ```bash
   npm install -g @arnis/cli
   ```
2. Download Shenzhen OSM extract (e.g., `shenzhen.osm.pbf`).
3. Run Arnis to generate the world:
   ```bash
   arnis generate -i shenzhen.osm.pbf -o ./minecraft-edition/world --region "Shenzhen" --bounds "113.9,22.5,114.1,22.6"
   ```
   The `--bounds` correspond to the same extents used in `world_meta.shenzhen.example.json`.
4. Verify that the world folder contains `region` files and a `level.dat`.

The resulting world can be started with a Paper server (see the next docs).
