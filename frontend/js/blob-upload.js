/**
 * DAMA — Upload direct vers Vercel Blob
 *
 * Utilise un jeton généré par /api/upload/token (voir backend/routes/upload.js).
 * Le fichier part directement du navigateur vers Vercel Blob : il ne passe
 * jamais par notre fonction serverless, qui elle est plafonnée à 4.5 Mo sur
 * Vercel. Sans ça, une vidéo prise avec un téléphone (souvent 20-100+ Mo)
 * échouerait systématiquement.
 *
 * Usage (dans une page admin) :
 *   <script type="module" src="../js/blob-upload.js"></script>
 *   ... plus loin ...
 *   const { url } = await window.uploadLargeFile(file, (pct) => { ... });
 */
import { put } from "https://esm.sh/@vercel/blob@0.27.1/client";

/**
 * Bug corrigé (26/08/2026) : sur iPhone/iPad (et Safari en général), l'envoi
 * restait bloqué à "0%" indéfiniment, sans jamais réussir ni afficher
 * d'erreur.
 *
 * Cause : dès qu'on passe un callback `onUploadProgress` au SDK
 * @vercel/blob, celui-ci envoie le fichier via `fetch()` en flux continu
 * (streaming, avec l'option `duplex: "half"`) pour pouvoir mesurer la
 * progression. Or Safari/WebKit — le moteur utilisé par TOUS les
 * navigateurs sur iOS/iPadOS, y compris Chrome et Firefox — supporte très
 * mal ce mode de streaming pour de gros fichiers : la requête ne part
 * jamais vraiment, sans erreur ni timeout. Sur ordinateur (Chrome/Edge/
 * Firefox), ce mode fonctionne normalement, d'où le fait que ça marchait
 * "chez nous" mais pas sur iPhone/iPad.
 *
 * Fix : sur les appareils Apple, on n'envoie pas `onUploadProgress` au SDK.
 * Le fichier part alors en un seul bloc classique (non streamé), ce qui
 * fonctionne de façon fiable partout — on perd juste le % en temps réel
 * sur ces appareils (product-form.html affiche un indicateur "en cours"
 * à la place).
 */
function isAppleWebkitDevice() {
  const ua = navigator.userAgent || "";
  const isIOSFamily =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ se déclare comme "Mac" mais a un écran tactile
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafariBrowser = /^((?!chrome|crios|fxios|android).)*safari/i.test(ua);
  return isIOSFamily || isSafariBrowser;
}

window.uploadLargeFile = async function uploadLargeFile(file, onProgress) {
  const filename = `${Date.now()}-${file.name}`.replace(/\s+/g, "-");
  const { token } = await window.api.getUploadToken(filename);

  const safeToTrackProgress = !isAppleWebkitDevice();

  const result = await put(filename, file, {
    access: "public",
    token,
    multipart: file.size > 8 * 1024 * 1024, // fichiers >8 Mo envoyés en plusieurs parties
    onUploadProgress:
      safeToTrackProgress && onProgress
        ? (event) => onProgress(Math.round(event.percentage))
        : undefined,
  });

  return result; // { url, pathname, ... }
};
