# Format des données attendues

Tous les fichiers doivent être dans la **même projection métrique** (par défaut
UTM 36N / EPSG:32636 dans cette démo — configurable si besoin, voir plus bas).

## `mnt.tif` — Modèle Numérique de Terrain
- GeoTIFF, **une seule bande**, valeurs = altitude en mètres.
- N'importe quelle résolution (rééchantillonnée automatiquement lors de la
  génération du maillage, voir `terrain.gridCellSize` dans `config.js`).
- **Seule la zone utile est chargée** (emprise du tracé + marge, voir
  `GeoRaster.loadClipped`) : vous pouvez donc fournir un MNT couvrant une
  région bien plus large que le tracé sans pénaliser le chargement — à
  condition que votre hébergeur supporte les requêtes HTTP `Range` (voir
  section *Performance* du README principal). Pour de très gros fichiers
  sources, un format **COG (Cloud Optimized GeoTIFF)** tuilé donne les
  meilleurs résultats (`gdalwarp -of COG ...`).

## `occupation_sol.tif` — Occupation du sol
- GeoTIFF, **une seule bande**, valeurs = codes **ESA WorldCover 10m v200** :
  `10` couvert arboré, `20` arbustes, `30` prairie herbacée, `40` culture,
  `50` bâti, `60` sol nu/épars, `70` neige/glace, `80` eau,
  `90` zone humide herbacée, `95` mangrove, `100` mousse/lichen.
- N'a pas besoin d'avoir la même résolution/emprise que le MNT : chaque
  sommet du maillage et chaque décor est échantillonné indépendamment aux
  coordonnées réelles.
- **Pourquoi un GeoTIFF et non un GeoJSON ici ?** Le code échantillonne le
  MNT et l'OCS de la même façon (valeur au point x,y), ce qui est direct et
  rapide pour colorer un maillage 3D. Une version polygonisée (GeoJSON)
  demanderait un test point-dans-polygone par sommet, plus coûteux, pour un
  gain nul dans ce cas d'usage. Si vous avez besoin du GeoJSON pour autre
  chose (affichage 2D, QGIS, etc.), le script `tools/landcover_to_geojson.py`
  fait la conversion (polygonisation par classe), indépendamment de cette démo.

## `parcours.geojson` — Tracé linéaire
- `FeatureCollection` avec une géométrie `LineString` (ou `MultiLineString`,
  concaténée dans l'ordre), coordonnées `[x, y]` en mètres (pas de Z requis :
  l'altitude est prise dans le MNT).

## `points_images.geojson` — Points-images
- `FeatureCollection` de `Point`. Propriétés reconnues :
  - `image` (obligatoire) : chemin/URL vers la photo (jpg/png/svg…)
  - `titre` (optionnel) : utilisé comme légende/alt et en repli si l'image manque
  - `opacite_max` (optionnel, 0–1) : opacité maximale du fondu (défaut 0.85)
  - `rayon_m` (optionnel) : rayon d'influence spécifique à ce point, en
    mètres le long du tracé (sinon le rayon global du slider s'applique)
- **Le point n'a pas besoin d'être exactement sur le tracé** : il est
  automatiquement projeté sur le point le plus proche de la courbe du
  parcours (paramètre `t`), donc pas de position "en dur" à calculer à la main.

## `points_narratifs.geojson` — Points narratifs
- `FeatureCollection` de `Point`. Propriétés reconnues :
  - `texte` (obligatoire) : texte affiché dans le bandeau narratif, et lu à
    voix haute par synthèse vocale si aucun fichier audio n'est fourni (ou si
    celui-ci ne se charge pas)
  - `titre` (optionnel)
  - `audio` (optionnel) : chemin/URL vers un fichier audio (mp3, ogg, wav…)
    à jouer à l'arrivée sur ce point. S'il est absent, ou si sa lecture
    échoue, le texte est lu automatiquement via la synthèse vocale du
    navigateur (Web Speech API, voix française par défaut — réglable dans
    `config.narration.lang`).
- Même principe de projection automatique sur le tracé que les points-images.
  Le point actif à un instant donné est le dernier "dépassé" le long du
  parcours ; sa narration (fichier ou voix de synthèse) se déclenche une
  seule fois, au moment où on l'atteint (pas en boucle).
- La narration audio peut être activée/désactivée dans l'UI (case à cocher
  "Narration audio"). Les navigateurs bloquant l'audio automatique tant
  qu'aucun geste utilisateur n'a eu lieu, le premier clic sur "▶ Marcher"
  (ou sur le slider) sert aussi à débloquer la lecture audio.

## Changer de projection
Si vos fichiers ne sont pas en UTM 36N, reprojetez-les tous vers la même
projection métrique avant de les déposer ici, par exemple :
```bash
gdalwarp -t_srs EPSG:32636 mnt_source.tif data/mnt.tif
gdalwarp -t_srs EPSG:32636 ocs_source.tif data/occupation_sol.tif
ogr2ogr -t_srs EPSG:32636 data/parcours.geojson parcours_source.geojson
ogr2ogr -t_srs EPSG:32636 data/points_images.geojson points_images_source.geojson
ogr2ogr -t_srs EPSG:32636 data/points_narratifs.geojson points_narratifs_source.geojson
```
Le code lui-même ne fait aucune reprojection : il suppose que tout est déjà cohérent.
