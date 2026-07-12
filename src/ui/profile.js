// ============================================================================
// Mini profil altimétrique (SVG), échantillonné directement depuis le MNT
// le long du tracé réel (et non plus une fonction analytique synthétique).
// ============================================================================
export class ProfileWidget {
  constructor(svgEl, route, dem, samples = 80) {
    this.svg = svgEl;
    this.route = route;
    this.W = 220; this.H = 70; this.PAD = 6;
    this.samples = samples;

    this.heights = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = route.positionAt(t); // p.y = altitude + eyeHeight (approximation suffisante pour un mini-profil)
      this.heights.push(p.y);
    }
    this.hMin = Math.min(...this.heights);
    this.hMax = Math.max(...this.heights);

    let d = '';
    this.heights.forEach((h, i) => {
      const px = this.PAD + (i / samples) * (this.W - 2 * this.PAD);
      const py = this.H - this.PAD - ((h - this.hMin) / (this.hMax - this.hMin || 1)) * (this.H - 2 * this.PAD);
      d += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1) + ' ';
    });
    this.svg.innerHTML = `<path d="${d}" fill="none" stroke="#8fd3ff" stroke-width="2"/>
      <circle id="profile-marker" cx="${this.PAD}" cy="${this.H / 2}" r="4" fill="#ff6b6b"/>`;
    this.marker = this.svg.querySelector('#profile-marker');
  }

  update(t) {
    const px = this.PAD + t * (this.W - 2 * this.PAD);
    const idx = Math.round(t * this.samples);
    const h = this.heights[idx];
    const py = this.H - this.PAD - ((h - this.hMin) / (this.hMax - this.hMin || 1)) * (this.H - 2 * this.PAD);
    this.marker.setAttribute('cx', px);
    this.marker.setAttribute('cy', py);
  }
}
