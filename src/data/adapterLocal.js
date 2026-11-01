// Adaptateur local : données dans ce navigateur uniquement (version d'essai, tests).
import { COLLECTIONS } from './schema.js';
import { fusion } from './store.js';

function lire(cle, defaut) {
  try {
    const v = localStorage.getItem(cle);
    return v ? JSON.parse(v) : defaut;
  } catch {
    return defaut;
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false;
  }
}

export function localAdapter(prefixe = 'vintedflow') {
  const memoire = Object.fromEntries(COLLECTIONS.map((c) => [c, lire(`${prefixe}:${c}`, {})]));
  const photos = new Map();
  let statusCb = null;

  const majReseau = () => statusCb && statusCb({ online: navigator.onLine });

  return {
    mode: 'local',
    start({ onCollection, onStatus }) {
      statusCb = onStatus;
      for (const c of COLLECTIONS) onCollection(c, { ...memoire[c] }, { fromCache: false });
      window.addEventListener('online', majReseau);
      window.addEventListener('offline', majReseau);
    },
    write(coll, id, data, merge) {
      memoire[coll] = { ...memoire[coll], [id]: merge ? fusion(memoire[coll][id] || { id }, data) : data };
      ecrire(`${prefixe}:${coll}`, memoire[coll]);
    },
    remove(coll, id) {
      const copie = { ...memoire[coll] };
      delete copie[id];
      memoire[coll] = copie;
      ecrire(`${prefixe}:${coll}`, memoire[coll]);
    },
    async getPhoto(id) {
      if (photos.has(id)) return photos.get(id);
      return lire(`${prefixe}:photo:${id}`, null);
    },
    putPhoto(id, data) {
      photos.set(id, data);
      ecrire(`${prefixe}:photo:${id}`, data);
    },
    removePhoto(id) {
      photos.delete(id);
      try {
        localStorage.removeItem(`${prefixe}:photo:${id}`);
      } catch {
        /* rien */
      }
    }
  };
}
