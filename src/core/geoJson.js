// ============================================================================
// Chargement des fichiers GeoJSON (tracé, points-images, points narratifs).
// Toutes les coordonnées sont supposées métriques (ex. UTM 36N), dans le
// même système que le MNT et l'OCS.
// ============================================================================

export async function loadGeoJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Impossible de charger ${url} (HTTP ${res.status})`);
  return res.json();
}

/** Extrait la première géométrie LineString (ou MultiLineString aplatie) d'un FeatureCollection. */
export function extractLineCoords(geojson) {
  const feature = geojson.features?.find(f =>
    f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
  ) ?? (geojson.type === 'LineString' || geojson.type === 'MultiLineString' ? { geometry: geojson } : null);

  if (!feature) throw new Error('Aucune géométrie LineString trouvée dans le fichier du parcours.');

  if (feature.geometry.type === 'LineString') return feature.geometry.coordinates;
  // MultiLineString : on concatène les segments dans l'ordre du fichier
  return feature.geometry.coordinates.flat();
}

/** Extrait tous les points (Feature Point) d'un FeatureCollection, avec leurs propriétés. */
export function extractPoints(geojson) {
  const feats = geojson.features?.filter(f => f.geometry?.type === 'Point') ?? [];
  return feats.map(f => ({
    coords: f.geometry.coordinates, // [x, y] (le z éventuel est ignoré : on utilise le MNT)
    properties: f.properties ?? {},
  }));
}
