// ============================================================================
// Construction du maillage 3D du terrain :
//  - géométrie = échantillonnage du MNT (GeoTIFF) sur une grille régulière
//  - couleur par sommet = classe ESA WorldCover échantillonnée dans l'OCS
// L'emprise du maillage est celle du tracé, étendue d'une marge (config).
// ============================================================================
import * as THREE from 'three';
import { CONFIG } from '../core/config.js';

function colorForClass(code) {
  const entry = CONFIG.landcoverPalette[code] ?? CONFIG.landcoverPalette[0];
  const c = new THREE.Color(entry.couleur);
  return [c.r, c.g, c.b];
}

/**
 * @param {GeoRaster} dem
 * @param {GeoRaster} landcover
 * @param {{minX,minY,maxX,maxY}} routeBBox - emprise du tracé en coordonnées carte
 * @param {{x:number,y:number}} origin
 * @returns {THREE.Mesh}
 */
export function buildTerrainMesh(dem, landcover, routeBBox, origin) {
  const { margin, gridCellSize, maxGridDivisions } = CONFIG.terrain;

  const xmin = routeBBox.minX - margin, xmax = routeBBox.maxX + margin;
  const ymin = routeBBox.minY - margin, ymax = routeBBox.maxY + margin;

  const width = xmax - xmin, depth = ymax - ymin;
  const NX = Math.min(maxGridDivisions, Math.max(4, Math.round(width / gridCellSize)));
  const NZ = Math.min(maxGridDivisions, Math.max(4, Math.round(depth / gridCellSize)));

  const positions = [], colors = [], indices = [];

  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j <= NZ; j++) {
      const x = xmin + (i / NX) * width;
      const y = ymin + (j / NZ) * depth; // "y" carte = nord, deviendra z en scène
      const elevation = dem.sampleBilinear(x, y) ?? 0;
      positions.push(x - origin.x, elevation, y - origin.y);

      const code = landcover.sampleNearest(x, y);
      const [r, g, b] = colorForClass(code);
      colors.push(r, g, b);
    }
  }

  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const a = i * (NZ + 1) + j, b = a + 1, c = (i + 1) * (NZ + 1) + j, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })
  );
  mesh.userData.bounds = { xmin, xmax, ymin, ymax, NX, NZ };
  return mesh;
}
