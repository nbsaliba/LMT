// ============================================================================
// Démo FPS terrain — Vue hybride (fondu par rayon) uniquement.
// Toutes les données (MNT, OCS, tracé, points) sont chargées depuis des
// fichiers GeoTIFF / GeoJSON en projection métrique (voir src/core/config.js).
// ============================================================================
import * as THREE from 'three';
import { CONFIG } from './core/config.js';
import { GeoRaster } from './core/geoRaster.js';
import { loadGeoJSON, extractLineCoords, extractPoints } from './core/geoJson.js';
import { RouteCurve } from './core/routeCurve.js';
import { buildTerrainMesh } from './terrain/terrainBuilder.js';
import { buildDecorations } from './terrain/decorations.js';
import { HybridView } from './ui/hybridView.js';
import { NarrativeTrack } from './ui/narrative.js';
import { NarrationAudio } from './ui/narrationAudio.js';
import { ProfileWidget } from './ui/profile.js';
import { isSmartphone } from './core/deviceDetect.js';
import { Pedometer } from './ui/pedometer.js';

const $ = (id) => document.getElementById(id);

const _warnedOnce = new Set();
/** Exécute fn en isolant toute exception : log en console + avertissement
 * discret une seule fois par `label`, sans jamais interrompre l'appelant. */
function safely(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[${label}]`, err);
    if (!_warnedOnce.has(label)) {
      _warnedOnce.add(label);
      showTransientWarning(`Problème (${label}) — voir console`);
    }
  }
}

function showTransientWarning(msg) {
  const el = $('status-banner');
  el.textContent = msg;
  el.style.background = '#7a5a22';
  el.style.display = 'block';
  clearTimeout(showTransientWarning._t);
  showTransientWarning._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// Détecté tout de suite (avant le chargement des données) pour que le CSS
// du mode mobile s'applique sans flash de l'interface desktop.
const IS_MOBILE = isSmartphone();
document.body.classList.add(IS_MOBILE ? 'mode-mobile' : 'mode-desktop');
$('welcome-note').textContent = IS_MOBILE
  ? 'Ton téléphone va utiliser l\u2019accéléromètre pour détecter tes pas : autorise l\u2019accès aux capteurs de mouvement si on te le demande.'
  : 'Utilise le curseur ou le bouton « Marcher » en bas de l\u2019écran pour avancer sur le sentier.';

async function main() {
  setStatus('Chargement du tracé et des points…');

  // ---- 1. GeoJSON d'abord (léger, rapide) pour connaître l'emprise utile ----
  const [routeGJ, imagePointsGJ, narrativePointsGJ] = await Promise.all([
    loadGeoJSON(CONFIG.data.route),
    loadGeoJSON(CONFIG.data.imagePoints),
    loadGeoJSON(CONFIG.data.narrativePoints),
  ]);

  const lineCoords = extractLineCoords(routeGJ);
  const imagePoints = extractPoints(imagePointsGJ);
  const narrativePoints = extractPoints(narrativePointsGJ);

  // ---- 2. Origine locale de scène + emprise utile (recentrage + fenêtrage) --
  const routeBBox = lineCoords.reduce((bb, [x, y]) => ({
    minX: Math.min(bb.minX, x), maxX: Math.max(bb.maxX, x),
    minY: Math.min(bb.minY, y), maxY: Math.max(bb.maxY, y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

  const origin = { x: (routeBBox.minX + routeBBox.maxX) / 2, y: (routeBBox.minY + routeBBox.maxY) / 2 };

  // Réglages allégés en mode smartphone (maillage/décors plus légers).
  if (IS_MOBILE) Object.assign(CONFIG.terrain, CONFIG.mobileOverrides);
  const maxPixels = IS_MOBILE ? CONFIG.raster.maxWindowPixelsMobile : CONFIG.raster.maxWindowPixelsDesktop;

  const clipBBox = {
    minX: routeBBox.minX - CONFIG.terrain.margin, maxX: routeBBox.maxX + CONFIG.terrain.margin,
    minY: routeBBox.minY - CONFIG.terrain.margin, maxY: routeBBox.maxY + CONFIG.terrain.margin,
  };

  // ---- 3. MNT + OCS : uniquement la fenêtre utile, sous-échantillonnée -------
  // (jamais le GeoTIFF entier — décisif pour de vrais fichiers volumineux, en
  // particulier sur une connexion mobile)
  setStatus('Chargement du relief et de l\u2019occupation du sol (zone du tracé uniquement)…');
  const [dem, landcover] = await Promise.all([
    GeoRaster.loadClipped(CONFIG.data.dem, clipBBox, maxPixels),
    GeoRaster.loadClipped(CONFIG.data.landcover, clipBBox, maxPixels),
  ]);

  setStatus('Construction du terrain…');

  // ---- 4. Scène three.js --------------------------------------------------
  const container = $('scene-container');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc5e8);
  scene.fog = new THREE.Fog(0x9fc5e8, 30, 400);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov, window.innerWidth / window.innerHeight, CONFIG.camera.near, CONFIG.camera.far
  );
  // L'antialiasing coûte cher sur GPU mobile ; on le désactive sur smartphone
  // pour réduire le risque de perte de contexte WebGL (voir gestion ci-dessous).
  const renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // ---- Perte/récupération du contexte WebGL ----------------------------------
  // Sur mobile, un GPU en tension peut couper silencieusement le contexte
  // WebGL : le canvas reste alors figé sur la dernière image rendue, sans
  // aucune erreur JS (la logique applicative — caméra, capteurs, podomètre —
  // continue, elle, de tourner normalement en arrière-plan). Sans ce
  // gestionnaire, le navigateur ne tente même pas de restaurer le contexte.
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    console.warn('Contexte WebGL perdu — tentative de récupération…');
    showTransientWarning('Rendu 3D interrompu (mémoire GPU) — récupération en cours…');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    console.info('Contexte WebGL restauré.');
    showTransientWarning('Rendu 3D restauré.');
  });

  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(120, 200, 60);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  // ---- 5. Terrain + décors --------------------------------------------------
  const terrain = buildTerrainMesh(dem, landcover, routeBBox, origin);
  scene.add(terrain);
  scene.add(buildDecorations(dem, landcover, terrain.userData.bounds, origin, {
    maxAttempts: CONFIG.terrain.maxDecorations,
  }));

  // ---- 6. Tracé / caméra ------------------------------------------------------
  const route = new RouteCurve(lineCoords, dem, origin, CONFIG.camera.eyeHeight);

  // ---- 7. Points-images (vue hybride) + points narratifs ---------------------
  const hybrid = new HybridView(route, imagePoints, $('overlay-images'), dem);
  const narrative = new NarrativeTrack(route, narrativePoints, dem, CONFIG.camera.eyeHeight);
  const narrationAudio = new NarrationAudio({
    lang: CONFIG.narration.lang,
    rate: CONFIG.narration.rate,
    volume: CONFIG.narration.volume,
    enabled: CONFIG.narration.enabledByDefault,
  });

  // ---- 8. Profil altimétrique -------------------------------------------------
  const profile = new ProfileWidget($('profile-svg'), route, dem);

  // ---- 9. UI : slider / lecture / rayon ---------------------------------------
  const slider = $('progress-slider');
  const progressLabel = $('progress-label');
  const playBtn = $('play-btn');
  const narrativeEl = $('narrative');
  const zoneLabel = $('zone-label');
  const radiusSlider = $('radius-slider');
  const radiusLabel = $('radius-label');
  const narrationToggle = $('narration-toggle');

  narrationToggle.checked = CONFIG.narration.enabledByDefault;
  narrationToggle.addEventListener('change', () => {
    narrationAudio.unlock();
    narrationAudio.setEnabled(narrationToggle.checked);
  });

  radiusSlider.min = CONFIG.hybrid.minRadiusMeters;
  radiusSlider.max = CONFIG.hybrid.maxRadiusMeters;
  radiusSlider.value = CONFIG.hybrid.defaultRadiusMeters;
  radiusLabel.textContent = `${radiusSlider.value} m`;
  radiusSlider.addEventListener('input', (e) => {
    hybrid.setRadiusMeters(Number(e.target.value));
    radiusLabel.textContent = `${e.target.value} m`;
  });

  let progress = 0; // 0..1
  let playing = false;
  let lastNarrativeIndex = -2; // valeur impossible pour forcer le premier déclenchement

  function setProgress(t) {
    progress = Math.min(Math.max(t, 0), 1);
    slider.value = Math.round(progress * 1000);

    const meters = route.tToMeters(progress);
    const steps = Math.round(meters / CONFIG.walk.stepLengthMeters);
    progressLabel.textContent = `${steps} pas (${meters.toFixed(0)} m)`;

    // La mise à jour caméra est la partie critique : elle ne doit jamais être
    // court-circuitée par une erreur dans une fonctionnalité annexe.
    const { pos, look } = route.cameraPoseAt(progress);
    camera.position.copy(pos);
    camera.lookAt(look);

    // Chaque fonctionnalité annexe est isolée : si l'une d'elles lève une
    // erreur (donnée inattendue dans vos fichiers, capteur, audio…), les
    // autres continuent de fonctionner et surtout la scène 3D continue de
    // s'afficher/avancer (sans ce garde-fou, une exception non interceptée
    // ici interrompait aussi le rendu de la frame en cours, donnant
    // l'impression d'une image figée alors que la marche progressait bel et
    // bien en arrière-plan).
    safely('mini-profil', () => profile.update(progress));
    safely('fondu images', () => hybrid.update(progress));
    safely('narration', () => {
      const narrativeIndex = narrative.activeIndexAt(progress);
      narrativeEl.textContent = narrative.itemAt(progress)?.texte ?? '';
      if (narrativeIndex !== lastNarrativeIndex) {
        lastNarrativeIndex = narrativeIndex;
        narrationAudio.play(narrative.items[narrativeIndex] ?? null);
      }
    });
    safely('occupation du sol', () => {
      const code = landcover.sampleNearest(pos.x + origin.x, pos.z + origin.y);
      zoneLabel.textContent = CONFIG.landcoverPalette[code]?.nom ?? '—';
    });
  }

  slider.addEventListener('input', () => {
    narrationAudio.unlock();
    playing = false; playBtn.textContent = '▶ Marcher';
    setProgress(slider.value / 1000);
  });
  playBtn.addEventListener('click', () => {
    narrationAudio.unlock();
    playing = !playing;
    playBtn.textContent = playing ? '⏸ Pause' : '▶ Marcher';
  });

  setProgress(0);
  clearStatus();

  // ---- 9bis. Écran d'accueil : démarrage manuel + podomètre sur smartphone --
  const welcomeScreen = $('welcome-screen');
  const startBtn = $('start-btn');
  let pedometer = null;

  startBtn.disabled = false;
  startBtn.textContent = 'Démarrer la marche';

  startBtn.addEventListener('click', async () => {
    narrationAudio.unlock();
    welcomeScreen.style.display = 'none';

    if (IS_MOBILE) {
      const granted = Pedometer.isSupported() && await Pedometer.requestPermission();
      if (granted) {
        pedometer = new Pedometer({
          onStep: () => safely('podomètre', () => {
            const dT = CONFIG.walk.stepLengthMeters / Math.max(route.totalLengthMeters, 1);
            setProgress(progress + dT);
          }),
        });
        pedometer.start();
      } else {
        // Repli si les capteurs de mouvement sont indisponibles/refusés :
        // avance automatique en continu (aucun contrôle manuel n'est affiché en mode mobile).
        playing = true;
      }
    }
  }, { once: true });

  // ---- 10. Boucle de rendu ------------------------------------------------------
  function animate() {
    requestAnimationFrame(animate);
    if (playing) {
      safely('avance automatique', () => {
        const dT = CONFIG.walk.metersPerFrame / Math.max(route.totalLengthMeters, 1);
        setProgress(progress + dT);
        if (progress >= 1) playing = false;
      });
    }
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Un smartphone met souvent la page en pause (verrouillage d'écran, appli
  // basculée en arrière-plan) : on force un rendu immédiat au retour, au cas
  // où la dernière frame affichée serait obsolète.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      renderer.render(scene, camera);
    }
  });
}

function setStatus(msg) {
  const el = $('status-banner');
  el.textContent = msg;
  el.style.display = 'block';
}
function clearStatus() {
  $('status-banner').style.display = 'none';
}
function showError(err) {
  console.error(err);
  const el = $('status-banner');
  el.textContent = `Erreur : ${err.message}`;
  el.style.background = '#7a2222';
  el.style.display = 'block';
}

main().catch(showError);
