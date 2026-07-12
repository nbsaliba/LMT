// ============================================================================
// GeoRaster : chargement d'un GeoTIFF (mono-bande) directement dans le
// navigateur via geotiff.js, et échantillonnage à des coordonnées métriques
// (mêmes coordonnées que le GeoJSON, ex. UTM 36N).
// ============================================================================
import { fromUrl } from 'geotiff';

export class GeoRaster {
  constructor({ data, width, height, bbox, noData }) {
    this.data = data;       // Float64Array (ou similaire) de taille width*height
    this.width = width;
    this.height = height;
    this.bbox = bbox;       // [xmin, ymin, xmax, ymax] en coordonnées carte
    this.noData = noData;
    this.pixelWidth  = (bbox[2] - bbox[0]) / width;
    this.pixelHeight = (bbox[3] - bbox[1]) / height; // toujours positif ici
  }

  static async load(url) {
    // `allowFullFile` : filet de sécurité si le serveur ne supporte pas les
    // requêtes HTTP Range (ex. certains serveurs de dev basiques) — sans ça,
    // geotiff.js lève une erreur au lieu de simplement charger le fichier entier.
    const tiff = await fromUrl(url, { allowFullFile: true });
    const image = await tiff.getImage();
    const bbox = image.getBoundingBox(); // [xmin, ymin, xmax, ymax]
    const width = image.getWidth();
    const height = image.getHeight();
    const rasters = await image.readRasters({ interleave: false });
    const data = rasters[0]; // bande 1
    let noData = image.getGDALNoData();
    if (noData === undefined || noData === null) noData = null;
    return new GeoRaster({ data, width, height, bbox, noData });
  }

  /**
   * Charge uniquement la zone utile du GeoTIFF (fenêtre autour du tracé),
   * sous-échantillonnée si nécessaire à `maxPixels` de côté maximum.
   * Essentiel pour de vrais MNT/OCS potentiellement très volumineux : sans
   * ça, `load()` télécharge et décode l'intégralité du fichier même quand
   * le tracé n'en occupe qu'une petite portion — très pénalisant sur mobile.
   *
   * @param {string} url
   * @param {{minX:number,minY:number,maxX:number,maxY:number}} bboxWorld - zone utile (m)
   * @param {number} maxPixels - résolution max en sortie (côté le plus long)
   */
  static async loadClipped(url, bboxWorld, maxPixels = 1000) {
    const tiff = await fromUrl(url, { allowFullFile: true });
    const image = await tiff.getImage();
    const full = image.getBoundingBox(); // [xmin, ymin, xmax, ymax]
    const width = image.getWidth();
    const height = image.getHeight();
    const pxW = (full[2] - full[0]) / width;
    const pxH = (full[3] - full[1]) / height;

    // Intersection de la zone demandée avec l'emprise réelle du raster.
    const xmin = Math.max(bboxWorld.minX, full[0]);
    const xmax = Math.min(bboxWorld.maxX, full[2]);
    const ymin = Math.max(bboxWorld.minY, full[1]);
    const ymax = Math.min(bboxWorld.maxY, full[3]);
    if (xmin >= xmax || ymin >= ymax) {
      throw new Error(`${url} : le tracé est en dehors de l'emprise du raster.`);
    }

    // Fenêtre en indices pixel (ligne 0 = haut = ymax, comme _toPixel).
    let col0 = Math.max(0, Math.floor((xmin - full[0]) / pxW));
    let col1 = Math.min(width, Math.ceil((xmax - full[0]) / pxW));
    let row0 = Math.max(0, Math.floor((full[3] - ymax) / pxH));
    let row1 = Math.min(height, Math.ceil((full[3] - ymin) / pxH));

    const winW = Math.max(1, col1 - col0);
    const winH = Math.max(1, row1 - row0);
    const scale = Math.min(1, maxPixels / Math.max(winW, winH));
    const outW = Math.max(1, Math.round(winW * scale));
    const outH = Math.max(1, Math.round(winH * scale));

    const rasters = await image.readRasters({
      window: [col0, row0, col1, row1],
      width: outW,
      height: outH,
      interleave: false,
    });
    const data = rasters[0];

    const clippedBBox = [
      full[0] + col0 * pxW, full[3] - row1 * pxH,
      full[0] + col1 * pxW, full[3] - row0 * pxH,
    ];

    let noData = image.getGDALNoData();
    if (noData === undefined || noData === null) noData = null;
    return new GeoRaster({ data, width: outW, height: outH, bbox: clippedBBox, noData });
  }

  /** Convertit une coordonnée carte (x,y) en indices pixel flottants (col,row depuis le haut). */
  _toPixel(x, y) {
    const col = (x - this.bbox[0]) / this.pixelWidth;
    const row = (this.bbox[3] - y) / this.pixelHeight; // ligne 0 = haut = ymax (nord)
    return [col, row];
  }

  _valueAt(col, row) {
    col = Math.min(Math.max(col, 0), this.width - 1);
    row = Math.min(Math.max(row, 0), this.height - 1);
    return this.data[row * this.width + col];
  }

  /** Échantillonnage plus-proche-voisin (à utiliser pour des données catégorielles comme l'OCS). */
  sampleNearest(x, y) {
    const [col, row] = this._toPixel(x, y);
    const v = this._valueAt(Math.round(col), Math.round(row));
    return (this.noData !== null && v === this.noData) ? null : v;
  }

  /** Échantillonnage bilinéaire (à utiliser pour des données continues comme le MNT). */
  sampleBilinear(x, y) {
    const [col, row] = this._toPixel(x, y);
    const c0 = Math.floor(col), r0 = Math.floor(row);
    const fc = col - c0, fr = row - r0;
    const v00 = this._valueAt(c0, r0);
    const v10 = this._valueAt(c0 + 1, r0);
    const v01 = this._valueAt(c0, r0 + 1);
    const v11 = this._valueAt(c0 + 1, r0 + 1);
    if ([v00, v10, v01, v11].some(v => this.noData !== null && v === this.noData)) {
      return this.sampleNearest(x, y);
    }
    const top = v00 * (1 - fc) + v10 * fc;
    const bot = v01 * (1 - fc) + v11 * fc;
    return top * (1 - fr) + bot * fr;
  }

  contains(x, y) {
    return x >= this.bbox[0] && x <= this.bbox[2] && y >= this.bbox[1] && y <= this.bbox[3];
  }
}
