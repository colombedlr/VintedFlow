// Adaptateur Firestore : écrit d'abord dans le téléphone (cache persistant),
// puis synchronise tout seul avec la base en ligne quand le réseau revient.
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDoc,
  getDocFromCache,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { COLLECTIONS } from './schema.js';

let dbInstance = null;

export function getDb(app, emulateur) {
  if (dbInstance) return dbInstance;
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true
  });
  if (emulateur) connectFirestoreEmulator(dbInstance, emulateur.host, emulateur.port);
  return dbInstance;
}

export function firestoreAdapter({ app, uid, emulateur, onSignOut }) {
  const db = getDb(app, emulateur);
  const enAttente = { ecritures: 0, collections: {} };
  let statusCb = () => {};

  const publier = () => {
    const pending = enAttente.ecritures + Object.values(enAttente.collections).filter(Boolean).length;
    statusCb({ pending, enAttenteEcritures: enAttente.ecritures });
  };

  const suivre = (promesse) => {
    enAttente.ecritures++;
    publier();
    promesse
      .catch((e) => statusCb({ erreur: e?.message || String(e) }))
      .finally(() => {
        enAttente.ecritures--;
        publier();
      });
  };

  const ref = (coll, id) => doc(db, 'users', uid, coll, id);

  return {
    mode: 'firebase',
    start({ onCollection, onStatus }) {
      statusCb = onStatus;
      for (const name of COLLECTIONS) {
        onSnapshot(
          collection(db, 'users', uid, name),
          { includeMetadataChanges: true },
          (snap) => {
            const docs = {};
            snap.forEach((d) => {
              docs[d.id] = { ...d.data(), id: d.id };
            });
            enAttente.collections[name] = snap.metadata.hasPendingWrites;
            onCollection(name, docs, { fromCache: snap.metadata.fromCache });
            publier();
          },
          (err) => onStatus({ erreur: err?.message || String(err) })
        );
      }
      const majReseau = () => onStatus({ online: navigator.onLine });
      window.addEventListener('online', majReseau);
      window.addEventListener('offline', majReseau);
    },
    write(coll, id, data, merge) {
      suivre(setDoc(ref(coll, id), data, { merge }));
    },
    remove(coll, id) {
      suivre(deleteDoc(ref(coll, id)));
    },
    async getPhoto(id) {
      const r = ref('photos', id);
      try {
        const s = await getDocFromCache(r);
        if (s.exists()) return s.data().data;
      } catch {
        /* pas en cache */
      }
      try {
        const s = await getDoc(r);
        return s.exists() ? s.data().data : null;
      } catch {
        return null;
      }
    },
    putPhoto(id, data, meta = {}) {
      suivre(setDoc(ref('photos', id), { data, ...meta, createdAt: new Date().toISOString() }));
    },
    removePhoto(id) {
      suivre(deleteDoc(ref('photos', id)));
    },
    signOut: onSignOut
  };
}
