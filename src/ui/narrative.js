// ============================================================================
// Points narratifs : chaque Feature Point du GeoJSON narratif est projeté sur
// le tracé (paramètre t). Le point "actif" à un instant donné est le dernier
// dont le t est <= progression. En plus du texte, chaque point peut porter
// un fichier audio (property `audio`) ; à défaut, la narration est lue par
// synthèse vocale (voir NarrationAudio dans narrationAudio.js).
// ============================================================================
export class NarrativeTrack {
  constructor(route, narrativePoints, dem, eyeHeight) {
    this.items = narrativePoints
      .map(pt => ({
        t: route.projectPointToT(pt.coords[0], pt.coords[1], dem, eyeHeight),
        texte: pt.properties.texte ?? '',
        titre: pt.properties.titre ?? '',
        audio: pt.properties.audio ?? null, // chemin/URL vers un fichier audio (optionnel)
      }))
      .sort((a, b) => a.t - b.t);
  }

  /** Index (dans this.items) du point narratif actif pour une progression t donnée, ou -1 si aucun. */
  activeIndexAt(t) {
    let idx = -1;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].t <= t) idx = i; else break;
    }
    return idx;
  }

  itemAt(t) {
    const idx = this.activeIndexAt(t);
    return idx >= 0 ? this.items[idx] : null;
  }

  textAt(t) {
    return this.itemAt(t)?.texte ?? '';
  }
}
