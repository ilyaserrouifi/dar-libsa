/**
 * DAMA — Compression d'image côté navigateur (Canvas)
 *
 * Pourquoi : sur iPhone/iPad, un upload "direct vers un stockage externe"
 * (streaming) peut rester bloqué à 0% si la photo est encore dans iCloud
 * ("Optimiser le stockage de l'appareil") — Safari doit d'abord la
 * retélécharger en haute résolution, et l'upload attend sans jamais
 * avancer ni afficher d'erreur claire.
 *
 * La solution : on lit le fichier entièrement en mémoire (FileReader),
 * on le redimensionne et le ré-encode en JPEG léger (~100-400 Ko) via un
 * <canvas>, puis on envoie directement cette chaîne (data URL) avec le
 * reste du formulaire — plus aucun flux réseau qui peut rester bloqué.
 * Même technique que l'admin Dar Chakaf.
 */
function compressImageFile(file, maxDimension = 1600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith("image/")) {
      reject(new Error("Le fichier choisi n'est pas une image."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDimension || h > maxDimension) {
          if (w > h) {
            h = Math.round(h * (maxDimension / w));
            w = maxDimension;
          } else {
            w = Math.round(w * (maxDimension / h));
            h = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Impossible de lire cette image (fichier corrompu ou format non supporté)."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.readAsDataURL(file);
  });
}

window.compressImageFile = compressImageFile;
