// ============================================================================
// NarrationAudio : lit à voix haute le texte d'un point narratif, soit via
// un fichier audio attaché (property `audio` du GeoJSON), soit via la
// synthèse vocale du navigateur (Web Speech API) si aucun fichier n'est
// fourni — ou si le fichier attaché échoue à charger/jouer.
//
// Limites à connaître :
//  - La synthèse vocale dépend des voix installées dans le navigateur/l'OS
//    (qualité et disponibilité du français variables selon la plateforme).
//  - Les navigateurs bloquent l'audio programmatique tant qu'aucun geste
//    utilisateur n'a eu lieu sur la page : appelez `unlock()` dans un
//    gestionnaire de clic (voir main.js, sur le bouton "Marcher").
// ============================================================================
export class NarrationAudio {
  constructor({ lang = 'fr-FR', rate = 1.0, volume = 1.0, enabled = true } = {}) {
    this.lang = lang;
    this.rate = rate;
    this.volume = volume;
    this.enabled = enabled;
    this._unlocked = false;

    this._audioEl = new Audio();
    this._audioEl.preload = 'auto';
  }

  setEnabled(value) {
    this.enabled = value;
    if (!value) this.stop();
  }

  setVolume(value) {
    this.volume = value;
    this._audioEl.volume = value;
  }

  /** À appeler une fois lors d'un geste utilisateur (clic) pour lever les restrictions d'autoplay. */
  unlock() {
    if (this._unlocked) return;
    this._unlocked = true;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
    // "Amorce" silencieuse de l'élément <audio> (nécessaire sur certains navigateurs mobiles).
    this._audioEl.muted = true;
    this._audioEl.play().catch(() => {}).finally(() => {
      this._audioEl.pause();
      this._audioEl.currentTime = 0;
      this._audioEl.muted = false;
    });
  }

  stop() {
    this._audioEl.pause();
    this._audioEl.currentTime = 0;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  /**
   * Joue la narration d'un point (voir NarrativeTrack) : fichier audio attaché
   * en priorité, repli sur la synthèse vocale du texte sinon.
   * @param {{texte:string, audio:?string}} item
   */
  play(item) {
    this.stop();
    if (!this.enabled || !item) return;

    if (item.audio) {
      this._audioEl.src = item.audio;
      this._audioEl.volume = this.volume;
      this._audioEl.play().catch(() => this._speak(item.texte));
    } else {
      this._speak(item.texte);
    }
  }

  _speak(text) {
    if (!text || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ''));
    utterance.lang = this.lang;
    utterance.rate = this.rate;
    utterance.volume = this.volume;
    window.speechSynthesis.speak(utterance);
  }
}
