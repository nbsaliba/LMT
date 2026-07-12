// ============================================================================
// Détection heuristique "smartphone" : combine l'user-agent et les capacités
// tactiles/pointeur. Volontairement simple — il n'existe pas de détection
// 100% fiable, mais cette combinaison couvre la grande majorité des cas
// (à ajuster si besoin selon votre parc d'appareils cible).
// ============================================================================
export function isSmartphone() {
  const ua = navigator.userAgent || navigator.vendor || '';
  const uaLooksMobile = /Android|iPhone|iPod|Windows Phone/i.test(ua);
  // iPad se signale parfois comme "Mac" en desktop-mode : on s'appuie alors sur le tactile.
  const isIpadLike = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
  const narrowViewport = Math.min(window.innerWidth, window.innerHeight) < 600;

  if (uaLooksMobile) return true;
  // Tablette type iPad : on la traite comme "smartphone" (mode podomètre) seulement
  // si l'écran est aussi étroit qu'un téléphone ; sinon on la laisse en mode desktop.
  if (isIpadLike) return narrowViewport;
  return coarsePointer && hasTouch && narrowViewport;
}
