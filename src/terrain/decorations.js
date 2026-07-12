// ============================================================================
// Décors procéduraux : place des arbres sur les cellules "couvert arboré"
// (code ESA 10) et des rochers sur les cellules "sol nu/épars" ou "neige/glace"
// (codes 60/70), en échantillonnant l'OCS réelle plutôt que des seuils en dur.
// ============================================================================
import * as THREE from 'three';

function seededRandom(seed) {
  let s = seed;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

const TREE_CODES = new Set([10]);
const ROCK_CODES = new Set([60, 70]);

export function buildDecorations(dem, landcover, bounds, origin, { maxAttempts = 4000, seed = 42 } = {}) {
  const rnd = seededRandom(seed);
  const group = new THREE.Group();

  const treeGeoTop = new THREE.ConeGeometry(1.4, 3.2, 6);
  const treeGeoTrunk = new THREE.CylinderGeometry(0.25, 0.3, 1.4, 5);
  const treeMatTop = new THREE.MeshStandardMaterial({ color: 0x2e5c33, flatShading: true });
  const treeMatTrunk = new THREE.MeshStandardMaterial({ color: 0x5b4327, flatShading: true });
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6e675d, flatShading: true });

  const { xmin, xmax, ymin, ymax } = bounds;
  const area = Math.max(1, (xmax - xmin) * (ymax - ymin));
  // Pas calculé pour respecter le budget total `maxAttempts`, quelle que soit
  // la taille réelle de l'emprise (un tracé de 10 km ne doit pas générer
  // 100x plus d'itérations qu'un tracé de 500 m).
  const step = Math.sqrt(area / maxAttempts);

  for (let x = xmin; x < xmax; x += step) {
    for (let y = ymin; y < ymax; y += step) {
      // léger décalage aléatoire pour casser la régularité de la grille
      const jx = x + (rnd() - 0.5) * step;
      const jy = y + (rnd() - 0.5) * step;
      const code = landcover.sampleNearest(jx, jy);
      if (code == null) continue;

      const elevation = dem.sampleBilinear(jx, jy) ?? 0;
      const sx = jx - origin.x, sz = jy - origin.y;

      if (TREE_CODES.has(code) && rnd() < 0.35) {
        const top = new THREE.Mesh(treeGeoTop, treeMatTop);
        const trunk = new THREE.Mesh(treeGeoTrunk, treeMatTrunk);
        const s = 0.7 + rnd() * 0.8;
        trunk.position.set(sx, elevation + 0.7 * s, sz);
        top.position.set(sx, elevation + 2.2 * s, sz);
        trunk.scale.setScalar(s); top.scale.setScalar(s);
        group.add(trunk, top);
      } else if (ROCK_CODES.has(code) && rnd() < 0.25) {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        const s = 0.6 + rnd() * 1.6;
        rock.scale.set(s, s * 0.7, s);
        rock.position.set(sx, elevation + s * 0.3, sz);
        rock.rotation.y = rnd() * Math.PI;
        group.add(rock);
      }
    }
  }
  return group;
}
