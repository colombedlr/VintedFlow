// Compression des photos : assez nettes pour reconnaître la pièce, assez légères pour le téléphone.

async function charger(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* repli ci-dessous */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function redimensionner(img, cote, qualite) {
  const w = img.width;
  const h = img.height;
  const r = Math.min(1, cote / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * r);
  canvas.height = Math.round(h * r);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', qualite);
}

// Renvoie { photo (~60-120 Ko), vignette (~5 Ko) } en data URL JPEG.
export async function compresserPhoto(file) {
  const img = await charger(file);
  const photo = redimensionner(img, 900, 0.7);
  const vignette = redimensionner(img, 160, 0.6);
  if (img.close) img.close();
  return { photo, vignette };
}

export function tailleKo(dataUrl) {
  return Math.round((dataUrl.length * 3) / 4 / 1024);
}

export function base64De(dataUrl) {
  return dataUrl.split(',')[1];
}
