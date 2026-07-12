// ============================================================================
// RouteCurve : transforme le tracé linéaire (GeoJSON, coordonnées métriques)
// en une courbe THREE.js, drapée sur le MNT, avec :
//  - une vraie longueur métrique (utilisée pour le podomètre simulé)
//  - une fonction de projection d'un point quelconque (point-image, point
//    narratif) sur le paramètre t (0..1) le plus proche de la courbe.
// ============================================================================
import * as THREE from 'three';

export class RouteCurve {
  /**
   * @param {Array<[number,number]>} lineCoordsUTM - coordonnées [x,y] du tracé
   * @param {GeoRaster} dem - MNT pour draper le tracé
   * @param {{x:number,y:number}} origin - origine locale de la scène (recentrage)
   * @param {number} eyeHeight - hauteur des yeux au-dessus du sol (m)
   */
  constructor(lineCoordsUTM, dem, origin, eyeHeight) {
    this.origin = origin;

    // Points 3D drapés sur le MNT, en repère local de scène (x=est, y=altitude, z=nord)
    this.points = lineCoordsUTM.map(([x, y]) => {
      const z = dem.sampleBilinear(x, y) ?? 0;
      return new THREE.Vector3(x - origin.x, z + eyeHeight, y - origin.y);
    });

    this.curve = new THREE.CatmullRomCurve3(this.points, false, 'catmullrom', 0.2);

    // Longueur réelle du tracé (m), calculée à partir des sommets d'origine (avant lissage)
    this.totalLengthMeters = 0;
    for (let i = 1; i < lineCoordsUTM.length; i++) {
      const [x0, y0] = lineCoordsUTM[i - 1];
      const [x1, y1] = lineCoordsUTM[i];
      this.totalLengthMeters += Math.hypot(x1 - x0, y1 - y0);
    }

    // Table de correspondance t -> position, pré-échantillonnée pour la projection de points
    this._sampleCount = 400;
    this._samples = [];
    for (let i = 0; i <= this._sampleCount; i++) {
      const t = i / this._sampleCount;
      this._samples.push({ t, p: this.curve.getPointAt(t) });
    }
  }

  positionAt(t) {
    return this.curve.getPointAt(Math.min(Math.max(t, 0), 0.999));
  }

  /** Position caméra + point visé, pour un t donné (0..1). */
  cameraPoseAt(t) {
    const tt = Math.min(Math.max(t, 0), 0.999);
    const pos = this.curve.getPointAt(tt);
    const look = this.curve.getPointAt(Math.min(tt + 0.01, 1));
    return { pos, look };
  }

  /**
   * Projette un point du monde réel (x,y en coordonnées carte) sur le tracé
   * et renvoie le paramètre t (0..1) du point le plus proche de la courbe.
   * Utilisé pour positionner automatiquement points-images / points narratifs
   * le long du parcours, sans les coder en dur.
   */
  projectPointToT(xUTM, yUTM, dem, eyeHeight) {
    const z = dem.sampleBilinear(xUTM, yUTM) ?? 0;
    const target = new THREE.Vector3(xUTM - this.origin.x, z + eyeHeight, yUTM - this.origin.y);
    let best = { t: 0, distSq: Infinity };
    for (const s of this._samples) {
      const d = s.p.distanceToSquared(target);
      if (d < best.distSq) best = { t: s.t, distSq: d };
    }
    return best.t;
  }

  /** Convertit une distance parcourue (m) en paramètre t (0..1). */
  metersToT(meters) {
    return this.totalLengthMeters > 0
      ? Math.min(Math.max(meters / this.totalLengthMeters, 0), 1)
      : 0;
  }

  tToMeters(t) {
    return t * this.totalLengthMeters;
  }
}
