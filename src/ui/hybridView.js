// ============================================================================
// Vue hybride (fondu par rayon) :
//  - la caméra avance en continu le long du tracé (comme un rendu 3D classique)
//  - chaque point-image du GeoJSON est automatiquement projeté sur le tracé
//    (paramètre t) ; quand la progression s'approche de ce t à moins de
//    `rayon` mètres, l'image correspondante apparaît en fondu par-dessus la
//    vue 3D, avec une opacité maximale au point exact et un dégradé linéaire
//    de part et d'autre.
// ============================================================================
import { CONFIG } from '../core/config.js';

export class HybridView {
  /**
   * @param {RouteCurve} route
   * @param {Array<{coords:[number,number], properties:object}>} imagePoints
   * @param {HTMLElement} overlayContainer - conteneur DOM où injecter les <img>
   * @param {GeoRaster} dem
   */
  constructor(route, imagePoints, overlayContainer, dem) {
    this.route = route;
    this.overlayContainer = overlayContainer;
    this.radiusMeters = CONFIG.hybrid.defaultRadiusMeters;

    this.items = imagePoints.map((pt, i) => {
      const [x, y] = pt.coords;
      const t = route.projectPointToT(x, y, dem, CONFIG.camera.eyeHeight);
      const maxOpacity = pt.properties.opacite_max ?? CONFIG.hybrid.defaultMaxOpacity;
      const rayon = pt.properties.rayon_m ?? null; // rayon spécifique en mètres, sinon rayon global

      const el = document.createElement('img');
      el.className = 'key-image';
      el.alt = pt.properties.titre ?? `point-image-${i}`;
      el.src = pt.properties.image ?? '';
      el.onerror = () => {
        // repli visuel si l'image référencée est introuvable
        el.replaceWith(this._placeholderFor(pt.properties));
      };
      overlayContainer.appendChild(el);

      return { el, t, maxOpacity, rayonOverride: rayon, titre: pt.properties.titre ?? '' };
    });
  }

  _placeholderFor(properties) {
    const div = document.createElement('div');
    div.className = 'key-image key-image-placeholder';
    div.textContent = properties.titre ?? 'Image indisponible';
    this.items.forEach(it => { if (it.titre === properties.titre) it.el = div; });
    return div;
  }

  setRadiusMeters(meters) {
    this.radiusMeters = meters;
  }

  /** À appeler à chaque frame avec la progression t (0..1) le long du tracé. */
  update(t) {
    const currentMeters = this.route.tToMeters(t);
    for (const item of this.items) {
      const itemMeters = this.route.tToMeters(item.t);
      const rayon = item.rayonOverride ?? this.radiusMeters;
      const dist = Math.abs(currentMeters - itemMeters);
      const opacity = dist < rayon ? item.maxOpacity * (1 - dist / rayon) : 0;
      item.el.style.opacity = opacity;
    }
  }

  /** Le point-image actuellement le plus visible (utile pour un libellé UI, debug, etc.) */
  activeItem() {
    return this.items.reduce((best, it) => {
      const op = parseFloat(it.el.style.opacity || '0');
      return op > (best?.op ?? 0) ? { it, op } : best;
    }, null)?.it ?? null;
  }
}
