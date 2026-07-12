#!/usr/bin/env python3
"""
Convertit un raster d'occupation du sol (ex. ESA WorldCover, GeoTIFF mono-bande
avec des codes de classe) en GeoJSON de polygones, un polygone par zone
homogène, avec la classe en propriété `code`/`nom`.

Ce script N'EST PAS utilisé par la démo elle-même : celle-ci échantillonne le
GeoTIFF directement (plus simple et plus rapide pour colorer un maillage 3D
et placer des décors, voir data/README.md). Il est fourni au cas où vous
auriez besoin du GeoJSON pour un autre usage (affichage 2D, QGIS, statistiques
de surface par classe, etc.).

Nécessite : rasterio, shapely (`pip install rasterio shapely --break-system-packages`)

Usage :
    python3 tools/landcover_to_geojson.py data/occupation_sol.tif data/occupation_sol.geojson
"""
import sys
import json
import rasterio
from rasterio.features import shapes
from shapely.geometry import shape, mapping

# Légende officielle ESA WorldCover 10m v200
LABELS = {
    10: "Couvert arboré", 20: "Arbustes", 30: "Prairie herbacée", 40: "Culture",
    50: "Bâti", 60: "Sol nu / épars", 70: "Neige / glace", 80: "Eau",
    90: "Zone humide herbacée", 95: "Mangrove", 100: "Mousse / lichen",
}

def main(src_path, dst_path):
    with rasterio.open(src_path) as src:
        band = src.read(1)
        transform = src.transform
        crs = src.crs

        features = []
        for geom, value in shapes(band, transform=transform):
            code = int(value)
            if code == 0:
                continue  # no-data / fond
            features.append({
                "type": "Feature",
                "properties": {"code": code, "nom": LABELS.get(code, "Inconnu")},
                "geometry": mapping(shape(geom)),
            })

        fc = {
            "type": "FeatureCollection",
            "crs": {"type": "name", "properties": {"name": str(crs)}},
            "features": features,
        }
        with open(dst_path, "w", encoding="utf-8") as f:
            json.dump(fc, f, ensure_ascii=False)

    print(f"{len(features)} polygones écrits dans {dst_path}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
