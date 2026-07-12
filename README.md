# Démo FPS terrain — Vue hybride (fondu par rayon)

Réécriture du fichier HTML monolithique d'origine en un petit projet
structuré, qui lit de **vraies données géographiques** (MNT GeoTIFF,
occupation du sol GeoTIFF, tracé et points en GeoJSON, tous en projection
métrique — UTM 36N par défaut) au lieu de fonctions synthétiques codées en dur.

Seule la **vue 3 (hybride, fondu par rayon)** a été conservée, comme demandé :
la caméra avance en continu le long du tracé, et les points-images du GeoJSON
apparaissent en fondu lorsque la progression s'approche d'eux, avec un rayon
d'influence réglable **en mètres réels** le long du parcours.

## Arborescence

```
demo-fps-terrain-hybride/
├── index.html                     # page + UI (slider, rayon, bandeau narratif)
├── src/
│   ├── main.js                    # orchestration : chargement, scène, boucle de rendu
│   ├── core/
│   │   ├── config.js              # chemins des données, palette OCS, réglages
│   │   ├── geoRaster.js           # lecture GeoTIFF (geotiff.js) + échantillonnage
│   │   ├── geoJson.js             # lecture GeoJSON (tracé, points)
│   │   ├── routeCurve.js          # courbe 3D du tracé + projection auto des points
│   │   └── deviceDetect.js        # détection heuristique smartphone vs desktop
│   ├── terrain/
│   │   ├── terrainBuilder.js      # maillage terrain depuis le MNT, coloré par l'OCS
│   │   └── decorations.js         # arbres/rochers placés selon les vraies classes OCS
│   └── ui/
│       ├── hybridView.js          # fondu par rayon des points-images
│       ├── narrative.js           # texte + audio narratif selon la progression réelle
│       ├── narrationAudio.js      # lecture audio : fichier attaché, ou TTS en repli
│       ├── pedometer.js           # podomètre par accéléromètre (mode smartphone)
│       └── profile.js             # mini profil altimétrique (SVG)
├── data/                          # <- VOS FICHIERS RÉELS vont ici (voir data/README.md)
│   ├── mnt.tif
│   ├── occupation_sol.tif
│   ├── parcours.geojson
│   ├── points_images.geojson
│   └── points_narratifs.geojson
├── sample-data/                   # jeu de données d'exemple généré (pour tester la démo)
│   ├── generate_sample_data.py
│   └── img/*.svg
└── tools/
    └── landcover_to_geojson.py    # conversion OCS GeoTIFF -> GeoJSON (optionnel, non utilisé par la démo)
```

## Écran d'accueil et mode smartphone

Au chargement, un écran de bienvenue ("Lebanon Mountain Trail") s'affiche
au-dessus de la scène (qui continue de se charger en arrière-plan). Le bouton
"Démarrer la marche" reste désactivé ("Chargement…") tant que les données ne
sont pas prêtes.

L'appareil est détecté au chargement (`src/core/deviceDetect.js`, heuristique
user-agent + tactile + largeur d'écran) :

- **Smartphone** : seule une petite fenêtre d'avancement (pas / mètres) reste
  affichée — pas de titres, pas de bouton "Marcher", pas de réglage de rayon,
  pas de case "Narration audio" (elle reste active par défaut, sans bouton
  visible). La progression est pilotée par un **podomètre basé sur
  l'accéléromètre** (`src/ui/pedometer.js`, API DeviceMotion) : chaque pas
  détecté fait avancer la marche le long du tracé réel. Sur iOS 13+, le clic
  sur "Démarrer la marche" déclenche la demande d'autorisation d'accès aux
  capteurs de mouvement (obligatoire). Si les capteurs sont indisponibles ou
  refusés, la démo bascule automatiquement sur une avance continue (puisqu'en
  mode smartphone aucun contrôle manuel n'est affiché).
  ⚠️ La détection de pas par accéléromètre est une heuristique simple
  (seuil sur la composante dynamique de l'accélération) — pas un podomètre
  certifié. Le seuil (`threshold` dans `Pedometer`) peut nécessiter un
  réglage selon la façon dont le téléphone est porté (main, poche...).
- **Desktop** : interface complète inchangée (slider, bouton "Marcher",
  rayon d'influence, case "Narration audio").

## Pourquoi l'image reste figée sur smartphone mais pas sur PC

Piste la plus probable : **perte de contexte WebGL**. Un GPU mobile dispose
de bien moins de mémoire/puissance qu'un GPU de PC ; quand il est en tension,
le navigateur peut couper silencieusement le contexte WebGL
(`webglcontextlost`) — le canvas reste alors figé sur la dernière image
rendue, **sans lever d'erreur JS**. La logique applicative (position caméra,
capteurs, podomètre) continue, elle, de tourner normalement en arrière-plan,
ce qui explique que le compteur de pas avance quand même pendant que l'image
ne bouge plus. Sur PC, le GPU a largement la marge nécessaire, donc ça ne se
produit jamais.

Corrections apportées (`src/main.js`) :
- **Gestion explicite de `webglcontextlost`/`webglcontextrestored`** : le
  navigateur ne tente une restauration du contexte que si vous appelez
  `event.preventDefault()` dans le gestionnaire de perte — sans ça, le
  contexte reste perdu indéfiniment. Un avertissement discret s'affiche à
  l'écran dans les deux cas (perte / restauration), pour que ce soit visible
  même sans outils de développement branchés.
- **Rendu allégé sur smartphone** : antialiasing désactivé, pixel ratio
  plafonné à 1.5 (au lieu de suivre `window.devicePixelRatio`, qui peut
  valoir 3 sur certains téléphones et tripler inutilement la charge GPU).
- **Rendu forcé au retour au premier plan** (`visibilitychange`), au cas où
  un verrouillage d'écran ou un passage en arrière-plan laisserait une image
  obsolète affichée.

**Pour confirmer le diagnostic sur votre appareil** : reliez le téléphone en
debug distant (`chrome://inspect` sur Android avec le câble USB, Web
Inspector sur iOS/Safari avec un Mac) et regardez la console au moment où
l'image se fige — si vous voyez `Contexte WebGL perdu…`, c'est confirmé, et
la version corrigée devrait déjà s'en remettre automatiquement. Si l'image
reste figée sans ce message, la cause est différente (à investiguer avec le
message d'erreur affiché par le garde-fou `safely()` mis en place
précédemment).

## Robustesse : plus d'« image figée » (erreurs annexes isolées)

Chaque fonctionnalité annexe de `setProgress` (mini-profil, fondu des
points-images, narration/audio, libellé d'occupation du sol) est maintenant
isolée dans un bloc `safely(label, fn)` (`src/main.js`) : si l'une d'elles
lève une erreur — donnée inattendue dans vos fichiers, capteur, lecture
audio… — les autres continuent de fonctionner, et surtout **la scène 3D
continue de s'afficher et d'avancer**. Auparavant, une exception non
interceptée dans l'une de ces fonctions annexes interrompait aussi le rendu
de la frame en cours (la caméra avançait bien en interne, mais
`renderer.render()` n'était plus jamais rappelé) : d'où l'impression d'une
image figée alors que le compteur de pas continuait, lui, de se mettre à
jour normalement (il est calculé *avant* les blocs isolés).
La première erreur rencontrée pour chaque fonctionnalité affiche aussi un
avertissement discret à l'écran pendant quelques secondes (utile sur
smartphone, sans accès aux outils de développement) ; le détail complet
reste dans la console.

Si vous voyez cet avertissement en usage réel, ouvrez la console
développeur (ou reliez le téléphone en debug distant — `chrome://inspect`
sur Android, Web Inspector sur iOS/Safari) pour voir l'erreur précise et
la corriger à la source (ex. point narratif mal formé, fichier audio
introuvable…).

## Mini-profil altimétrique en mode smartphone

Le profil altimétrique (avec le marqueur de position en temps réel) fait de
nouveau partie de la petite fenêtre d'avancement affichée en mode
smartphone — regroupé avec le compteur pas/mètres, en haut à droite de
l'écran. Le reste de l'interface (titres, boutons, réglages) reste masqué,
comme demandé.

## Performance sur smartphone / avec de vrais fichiers volumineux

Deux optimisations ont été ajoutées spécifiquement pour ça :

1. **Lecture fenêtrée + sous-échantillonnée du MNT/OCS** (`GeoRaster.loadClipped`,
   dans `src/core/geoRaster.js`) : le GeoJSON du tracé est chargé en premier
   (léger), ce qui permet de calculer l'emprise réellement utile (tracé +
   marge) *avant* de toucher au MNT/OCS. Seule cette fenêtre est ensuite lue,
   et décimée à `raster.maxWindowPixelsDesktop`/`maxWindowPixelsMobile`
   pixels de côté max (voir `config.js`) — jamais le GeoTIFF entier.
   ⚠️ **Le gain réseau dépend du serveur qui héberge vos données** : la
   lecture fenêtrée s'appuie sur les requêtes HTTP `Range` (206 partiel).
   La plupart des hébergeurs statiques de production (Nginx, Apache, GitHub
   Pages, Netlify, Vercel, Cloudflare Pages…) les supportent nativement — le
   gain sera donc réel en production. En revanche, **`python3 -m http.server`
   (utilisé dans ce README pour les tests locaux) ne supporte PAS `Range`** :
   il renvoie toujours le fichier entier (testé et confirmé). Le code ne
   plante pas pour autant (repli automatique via l'option `allowFullFile`
   de geotiff.js), mais vous ne verrez pas le gain réseau en local avec ce
   serveur — seulement le gain mémoire/CPU du sous-échantillonnage. Pour
   valider le gain réseau en local, utilisez un serveur qui supporte `Range`,
   par exemple :
   ```bash
   npx serve .   # supporte Range par défaut
   ```
2. **Budget de décors plafonné** (`terrain.maxDecorations`) : le nombre de
   tentatives de placement d'arbres/rochers est désormais fixe, quelle que
   soit la longueur réelle du tracé (auparavant, un pas fixe en mètres sur un
   tracé de plusieurs kilomètres pouvait générer un nombre d'itérations bien
   plus élevé que sur le jeu d'exemple).

En mode smartphone, un profil plus léger s'applique automatiquement
(`config.mobileOverrides`) : maillage plus grossier, moins de décors, et une
résolution de fenêtre raster réduite (`maxWindowPixelsMobile`).

**Si le chargement reste lent malgré ça avec vos vrais fichiers**, la cause la
plus probable est la taille/résolution native de vos GeoTIFF source. Le geste
le plus efficace reste de les pré-découper et pré-compresser en amont avec
GDAL, avant de les déposer dans `data/` :
```bash
# Découper sur l'emprise du tracé (+ marge), et convertir en COG compressé
gdalwarp -te <xmin> <ymin> <xmax> <ymax> -of COG -co COMPRESS=DEFLATE \
  mnt_source.tif data/mnt.tif
gdalwarp -te <xmin> <ymin> <xmax> <ymax> -of COG -co COMPRESS=DEFLATE \
  ocs_source.tif data/occupation_sol.tif
```
Un format **COG (Cloud Optimized GeoTIFF)** est structuré en tuiles avec
niveaux de résolution réduite (« overviews »), ce qui maximise l'efficacité
des requêtes `Range` de geotiff.js — un simple GeoTIFF non tuilé peut forcer
un rapatriement plus large que nécessaire même avec `Range` supporté.

## Lancer la démo

Un jeu de données d'exemple a déjà été généré dans `data/` (reproduisant les
3 zones — forêt / prairie / rocher — de la démo d'origine, mais à partir de
vrais fichiers GeoTIFF/GeoJSON en UTM 36N). Pour la relancer vous-même :

```bash
pip install numpy rasterio --break-system-packages
python3 sample-data/generate_sample_data.py
```

Le chargement se fait par `fetch()` (GeoTIFF + GeoJSON), donc **il faut servir
le dossier via un petit serveur HTTP** (ouvrir `index.html` directement en
`file://` ne fonctionnera pas, à cause des restrictions CORS des navigateurs) :

```bash
cd demo-fps-terrain-hybride
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/
```
(pratique et suffisant pour tester fonctionnellement, mais voir la section
*Performance* ci-dessous : ce serveur ne supporte pas les requêtes `Range`,
utilisez plutôt `npx serve .` si vous voulez vérifier le gain réseau du
chargement fenêtré du MNT/OCS.)

⚠️ Pour tester le podomètre sur un vrai smartphone, l'accès aux capteurs de
mouvement (`DeviceMotionEvent`) exige un contexte sécurisé : servez la démo
en **HTTPS** (ou via `localhost` en local sur le même appareil — un simple
`http://<ip-locale>:8000` depuis un autre appareil sur le réseau ne suffira
pas, il faudra un tunnel HTTPS type `ngrok` ou un déploiement réel).

## Utiliser vos propres données

1. Reprojetez vos fichiers dans une même projection métrique (voir
   `data/README.md` pour les commandes `gdalwarp`/`ogr2ogr`).
2. Déposez-les dans `data/` en respectant les noms de `src/core/config.js`
   (ou modifiez ce fichier pour pointer vers vos noms/chemins).
3. Ajoutez vos points-images (`data/points_images.geojson`) en indiquant le
   chemin de chaque photo dans la propriété `image`.
4. Rafraîchissez la page.

Le détail des schémas attendus (MNT, OCS, tracé, points-images, points
narratifs) est dans **`data/README.md`**.

## Choix techniques notables

- **Tout se fait dans le navigateur**, sans étape de build : `three.js` et
  `geotiff.js` sont chargés via `importmap` (CDN). Le MNT et l'OCS sont donc
  parsés côté client directement depuis les `.tif`.
- **OCS conservée en GeoTIFF** (pas de conversion GeoJSON nécessaire pour la
  démo) : l'échantillonnage ponctuel (valeur à x,y) est plus simple et plus
  rapide que des tests point-dans-polygone pour colorer un maillage et placer
  des décors. Le script `tools/landcover_to_geojson.py` reste disponible si
  vous avez besoin du GeoJSON pour un autre usage (QGIS, stats de surface…).
- **Points-images et points narratifs positionnés automatiquement** : chaque
  point est projeté sur le tracé (paramètre `t` le plus proche), à partir de
  ses coordonnées réelles — plus besoin de coder en dur des positions le long
  du parcours comme dans la démo d'origine.
- **Podomètre basé sur la longueur métrique réelle** du tracé (calculée à
  partir des sommets GeoJSON), convertie en "pas" via une longueur de pas
  moyenne configurable (`config.walk.stepLengthMeters`).
- **Narration audio des points narratifs** : fichier audio attaché
  (propriété `audio` du GeoJSON) si présent, sinon lecture du texte par
  synthèse vocale (Web Speech API, `fr-FR` par défaut). Se déclenche une
  seule fois par point atteint (pas en boucle), activable/désactivable dans
  l'UI. Le premier clic sur "▶ Marcher" ou sur le slider sert aussi à lever
  les restrictions d'autoplay audio des navigateurs.
- **Rayon d'influence en mètres réels** (et non plus en % arbitraire du
  parcours), pour un réglage qui a un sens physique quelle que soit la
  longueur du tracé.
