# Coordinate System

Arnis (and the underlying OpenStreetMap data) uses **WGS84** geographic
coordinates (longitude, latitude). If you source company locations from other
providers such as 高德, 腾讯 or 百度, you must first convert those coordinates to
WGS84 before they can be used by the conversion script.

The first edition of the Minecraft export only supports **exact WGS84
coordinates** where `geo_level === "coordinate"` and `coord_system === "WGS84"`.
Records with `coord_system` set to `unknown` or with `geo_level` not equal to
`"coordinate"` are ignored.

When converting, the script normalises the longitude/latitude range to the
world dimensions defined in `world_meta.shenzhen.example.json`.
