// ============================================================================
// Configuration centrale de la démo "Vue hybride" (fondu par rayon)
// ----------------------------------------------------------------------------
// Toutes les données géographiques sont supposées dans la MÊME projection
// métrique (par défaut UTM 36N / EPSG:32636). Le code ne fait AUCUNE
// reprojection : si vos fichiers sont dans un autre système, reprojetez-les
// au préalable (ex: `gdalwarp -t_srs EPSG:32636 in.tif out.tif`,
// ou `ogr2ogr -t_srs EPSG:32636 out.geojson in.geojson`).
// ============================================================================

export const CONFIG = {

  // ---- Chemins des données d'entrée (relatifs à la racine du site) --------
  data: {
    dem:             'data/mnt.tif',                 // MNT (GeoTIFF, 1 bande, altitudes en m)
    landcover:       'data/occupation_sol.tif',       // OCS (GeoTIFF, 1 bande, codes ESA WorldCover)
    route:           'data/parcours.geojson',         // Tracé linéaire (LineString)
    imagePoints:     'data/points_images.geojson',    // Points-images (Point)
    narrativePoints: 'data/points_narratifs.geojson', // Points narratifs (Point)
  },

  // ---- Terrain -------------------------------------------------
  terrain: {
    margin: 40,        // marge (m) ajoutée de part et d'autre du tracé pour générer le maillage
    gridCellSize: 4,    // taille de cellule visée (m) -> détermine la résolution du maillage
    maxGridDivisions: 160, // garde-fou pour éviter un maillage trop lourd sur un long tracé
    maxDecorations: 4000,  // nombre max de tentatives de placement d'arbres/rochers (indépendant de la longueur du tracé)
  },

  // ---- Lecture des rasters (MNT/OCS) ------------------------------------------
  // On ne charge jamais le GeoTIFF en entier : seule la zone utile (emprise du
  // tracé + marge) est téléchargée/décodée, sous-échantillonnée à cette résolution
  // max. Essentiel avec de vrais fichiers volumineux, surtout sur smartphone.
  raster: {
    maxWindowPixelsDesktop: 1400,
    maxWindowPixelsMobile: 700,
  },

  // ---- Caméra / rendu -------------------------------------------------------
  camera: {
    eyeHeight: 1.7,   // hauteur des yeux au-dessus du sol (m)
    fov: 60,
    near: 0.1,
    far: 2000,
  },

  // ---- Mode hybride (fondu par rayon) ---------------------------------------
  hybrid: {
    defaultRadiusMeters: 60,  // rayon d'influence par défaut d'un point-image, en MÈTRES le long du tracé
    minRadiusMeters: 10,
    maxRadiusMeters: 250,
    defaultMaxOpacity: 0.85,
  },

  // ---- Narration audio des points narratifs ----------------------------------
  narration: {
    enabledByDefault: true,
    lang: 'fr-FR',   // langue utilisée pour la synthèse vocale (repli si pas de fichier audio)
    rate: 1.0,       // vitesse de la voix de synthèse (1.0 = normale)
    volume: 1.0,
  },

  // ---- Ajustements appliqués uniquement en mode smartphone (perfs) -----------
  mobileOverrides: {
    gridCellSize: 6,        // maillage plus grossier (moins de sommets à calculer/dessiner)
    maxGridDivisions: 110,
    maxDecorations: 1500,   // moins de décors procéduraux
  },

  // ---- Simulation du podomètre -----------------------------------------------
  walk: {
    stepLengthMeters: 0.75, // longueur de pas moyenne utilisée pour convertir distance <-> pas
    metersPerFrame: 0.6,    // vitesse de marche simulée en mode "lecture auto" (m / frame ~60fps)
  },

  // ---- Palette ESA WorldCover 10m v200 (codes officiels) ---------------------
  // https://esa-worldcover.org/en  (légende officielle)
  landcoverPalette: {
    10:  { nom: 'Couvert arboré',            couleur: 0x1f5c34 },
    20:  { nom: 'Arbustes',                  couleur: 0x8a9a3a },
    30:  { nom: 'Prairie herbacée',          couleur: 0xb8c96b },
    40:  { nom: 'Culture',                   couleur: 0xdcc06a },
    50:  { nom: 'Bâti',                      couleur: 0xb03a2e },
    60:  { nom: 'Sol nu / épars',            couleur: 0x9e9080 },
    70:  { nom: 'Neige / glace',             couleur: 0xf2f2f2 },
    80:  { nom: 'Eau',                       couleur: 0x3a6ea5 },
    90:  { nom: 'Zone humide herbacée',      couleur: 0x5c8a72 },
    95:  { nom: 'Mangrove',                  couleur: 0x2f6b4f },
    100: { nom: 'Mousse / lichen',           couleur: 0xb7ab8e },
    0:   { nom: 'Inconnu',                   couleur: 0x777777 }, // valeur "no data" / repli
  },
};
