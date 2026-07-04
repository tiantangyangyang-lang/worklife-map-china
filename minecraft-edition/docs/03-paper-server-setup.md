# Paper Server Setup

1. Download the latest Paper jar from https://papermc.io/downloads.
2. Create a directory `server` and place the jar inside.
3. Run the server for the first time to generate configuration files:
   ```bash
   java -Xms2G -Xmx2G -jar paper-*.jar nogui
   ```
   Accept the EULA when prompted (`eula=true` in `eula.txt`).
4. Install the Citizens plugin:
   - Download `Citizens.jar` from https://dev.bukkit.org/projects/citizens
   - Place it into `server/plugins`.
5. Copy the generated world folder (`minecraft-edition/world`) into
   `server/worlds/shenzhen` and edit `server/server.properties`:
   ```properties
   level-name=shenzhen
   ```
6. Start the server again. The world should load and you can join using a
   Minecraft client.
