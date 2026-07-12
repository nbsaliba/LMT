#!/usr/bin/env python3
"""
Génère un jeu de données d'exemple géoréférencé (UTM 36N) pour tester la démo
sans attendre les vrais fichiers MNT/OCS/tracé :
  - data/mnt.tif             : MNT synthétique (mêmes reliefs que la démo d'origine)
  - data/occupation_sol.tif  : OCS synthétique avec de vrais codes ESA WorldCover
  - data/parcours.geojson    : tracé LineString traversant les 3 zones
  - data/points_images.geojson
  - data/points_narratifs.geojson

Nécessite : numpy, rasterio (`pip install numpy rasterio --break-system-packages`)
Usage : python3 sample-data/generate_sample_data.py
"""
import json
import numpy as np
import rasterio
from rasterio.transform import from_origin

CRS = "EPSG:32636"  # UTM 36N — à adapter si besoin
# Origine arbitraire (coin haut-gauche) en mètres, choisie loin de 0 pour
# valider que le recentrage local de la scène fonctionne bien.
ORIGIN_X, ORIGIN_Y = 730000.0, 3675000.0
EXTENT = 320.0        # étendue couverte (m) le long de x, centrée sur le tracé (couvre le tracé +marge)
WIDTH_M = 140.0       # largeur (m) le long de z (couvre le tracé +marge)
PIXEL = 1.0           # taille de pixel (m)

def height_at(x, z):
    return np.sin(x * 0.02) * 6 + np.sin(x * 0.05 + z * 0.1) * 2 + x * 0.045 + np.sin(z * 0.15) * 1.2

def zone_code_at(x):
    # Codes ESA WorldCover : 10 = couvert arboré, 30 = prairie herbacée, 60 = sol nu/épars
    return np.where(x < -25, 10, np.where(x < 25, 30, 60))

def write_raster(path, array, transform, dtype):
    with rasterio.open(
        path, "w", driver="GTiff", height=array.shape[0], width=array.shape[1],
        count=1, dtype=dtype, crs=CRS, transform=transform, nodata=None,
    ) as dst:
        dst.write(array, 1)

def main():
    nx = int(EXTENT / PIXEL)
    nz = int(WIDTH_M / PIXEL)

    # Grille locale (x: -110..110, z: -35..35) reproduisant le terrain d'origine
    xs = np.linspace(-EXTENT/2, EXTENT/2, nx)
    zs = np.linspace(-WIDTH_M/2, WIDTH_M/2, nz)
    X, Z = np.meshgrid(xs, zs)  # shape (nz, nx) -> ligne = z, colonne = x

    dem = height_at(X, Z).astype("float32")
    ocs = zone_code_at(X).astype("uint8")

    # Transform : origine = coin haut-gauche en coordonnées carte (Xmin, Ymax)
    map_xmin = ORIGIN_X - EXTENT/2
    map_ymax = ORIGIN_Y + WIDTH_M/2
    transform = from_origin(map_xmin, map_ymax, PIXEL, PIXEL)

    write_raster("data/mnt.tif", dem, transform, "float32")
    write_raster("data/occupation_sol.tif", ocs, transform, "uint8")

    # ---- Tracé : suit la même sinuosité que la démo d'origine -----------------
    xs_line = np.arange(-100, 101, 6)
    zs_line = np.sin(xs_line * 0.04) * 7
    coords = [[float(ORIGIN_X + x), float(ORIGIN_Y + z)] for x, z in zip(xs_line, zs_line)]
    route = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"nom": "Tracé d'exemple"},
            "geometry": {"type": "LineString", "coordinates": coords},
        }],
    }
    with open("data/parcours.geojson", "w", encoding="utf-8") as f:
        json.dump(route, f, ensure_ascii=False, indent=2)

    # ---- Points-images (répliquent les 3 illustrations de la démo d'origine) --
    def pt_at(x):
        z = float(np.sin(x * 0.04) * 7)
        return [float(ORIGIN_X + x), float(ORIGIN_Y + z)]

    images = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {
                "titre": "Orée du bois", "image": "sample-data/img/foret.svg", "opacite_max": 0.85},
                "geometry": {"type": "Point", "coordinates": pt_at(-70)}},
            {"type": "Feature", "properties": {
                "titre": "Clairière", "image": "sample-data/img/prairie.svg", "opacite_max": 0.85},
                "geometry": {"type": "Point", "coordinates": pt_at(0)}},
            {"type": "Feature", "properties": {
                "titre": "Sommet rocheux", "image": "sample-data/img/rocher.svg", "opacite_max": 0.9},
                "geometry": {"type": "Point", "coordinates": pt_at(70)}},
        ],
    }
    with open("data/points_images.geojson", "w", encoding="utf-8") as f:
        json.dump(images, f, ensure_ascii=False, indent=2)

    # ---- Points narratifs ------------------------------------------------------
    narrative = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {
                "texte": "« Vous quittez l'orée du bois, le sentier grimpe doucement... »"},
                "geometry": {"type": "Point", "coordinates": pt_at(-95)}},
            {"type": "Feature", "properties": {
                "texte": "« Le couvert s'éclaircit, une clairière s'ouvre devant vous. »"},
                "geometry": {"type": "Point", "coordinates": pt_at(-20)}},
            {"type": "Feature", "properties": {
                "texte": "« Le sol se durcit, la pente se fait plus rude vers le sommet. »"},
                "geometry": {"type": "Point", "coordinates": pt_at(30)}},
        ],
    }
    with open("data/points_narratifs.geojson", "w", encoding="utf-8") as f:
        json.dump(narrative, f, ensure_ascii=False, indent=2)

    print("Données d'exemple générées dans data/ (CRS:", CRS, ")")

if __name__ == "__main__":
    main()
