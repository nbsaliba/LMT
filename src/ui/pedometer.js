// ============================================================================
// Pedometer : détection de pas à partir de l'accéléromètre du smartphone
// (API DeviceMotion). Principe : on isole la composante dynamique de
// l'accélération (magnitude moins une moyenne glissante qui absorbe la
// gravité et les mouvements lents), puis on détecte les pics qui dépassent
// un seuil, avec un intervalle minimal entre deux pas pour éviter les
// faux-positifs (rebonds).
//
// ATTENTION : c'est une heuristique simple, pas un podomètre certifié —
// la sensibilité (`threshold`) peut nécessiter un réglage selon l'appareil
// (position du téléphone : main, poche, brassard...). Prévoir un retour
// manuel (slider) en secours si la détection est peu fiable sur un appareil
// donné.
// ============================================================================
export class Pedometer {
  constructor({ onStep, threshold = 1.3, minStepIntervalMs = 300 } = {}) {
    this.onStep = onStep;
    this.threshold = threshold;
    this.minStepIntervalMs = minStepIntervalMs;
    this._lastStepTime = 0;
    this._smoothedMag = null;
    this._rising = false;
    this._active = false;
    this._handleMotion = this._handleMotion.bind(this);
  }

  static isSupported() {
    return typeof DeviceMotionEvent !== 'undefined';
  }

  /**
   * iOS 13+ exige une autorisation explicite, demandée suite à un geste
   * utilisateur (ex. clic sur "Démarrer la marche"). Sur Android et la
   * plupart des navigateurs desktop, aucune permission n'est nécessaire.
   * @returns {Promise<boolean>} true si l'accès est autorisé.
   */
  static async requestPermission() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        return (await DeviceMotionEvent.requestPermission()) === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }

  start() {
    if (this._active || !Pedometer.isSupported()) return;
    this._active = true;
    window.addEventListener('devicemotion', this._handleMotion);
  }

  stop() {
    this._active = false;
    window.removeEventListener('devicemotion', this._handleMotion);
  }

  _handleMotion(event) {
    const acc = event.accelerationIncludingGravity ?? event.acceleration;
    if (!acc || acc.x == null) return;

    const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);

    // Moyenne glissante exponentielle : suit la gravité + les mouvements lents.
    this._smoothedMag = this._smoothedMag == null ? mag : this._smoothedMag * 0.9 + mag * 0.1;
    const dynamic = mag - this._smoothedMag;

    const now = performance.now();
    const sinceLastStep = now - this._lastStepTime;

    // Réarmement du détecteur : soit le signal est redescendu sous le seuil
    // bas (cas idéal), soit l'intervalle minimal entre deux pas est déjà
    // écoulé — ce second cas évite qu'une marche soutenue, où le signal
    // dynamique reste durablement entre 0.3×seuil et le seuil (la moyenne
    // glissante rattrape le rythme de marche), ne bloque le verrou `_rising`
    // indéfiniment après les tout premiers pas.
    if (dynamic < this.threshold * 0.3 || sinceLastStep > this.minStepIntervalMs) {
      this._rising = false;
    }

    if (dynamic > this.threshold && !this._rising && sinceLastStep > this.minStepIntervalMs) {
      this._rising = true;
      this._lastStepTime = now;
      this.onStep?.();
    }
  }
}
