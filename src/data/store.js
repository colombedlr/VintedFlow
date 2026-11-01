// La base unique de l'app : un état en mémoire, alimenté par l'adaptateur (Firestore ou local).
import { COLLECTIONS, nouvelId, maintenant } from './schema.js';

const estObjet = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function fusion(base, patch) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === undefined) continue;
    out[k] = estObjet(v) && estObjet(out[k]) ? fusion(out[k], v) : v;
  }
  return out;
}

export function createStore(adapter) {
  const state = Object.fromEntries(COLLECTIONS.map((c) => [c, {}]));
  const listeners = new Set();
  const loaded = new Set();
  const confirmed = new Set();
  const status = {
    mode: adapter.mode,
    ready: false,
    confirmed: false,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    pending: 0,
    erreur: null
  };
  let version = 0;
  let scheduled = false;

  function emit() {
    version++;
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      listeners.forEach((l) => l(version));
    });
  }

  adapter.start({
    onCollection(name, docs, meta = {}) {
      state[name] = docs;
      loaded.add(name);
      if (!meta.fromCache) confirmed.add(name);
      status.ready = loaded.size === COLLECTIONS.length;
      status.confirmed = confirmed.size === COLLECTIONS.length;
      emit();
    },
    onStatus(patch) {
      Object.assign(status, patch);
      emit();
    }
  });

  const store = {
    state,
    status,
    get version() {
      return version;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get(coll, id) {
      return state[coll][id] || null;
    },
    put(coll, data) {
      const id = data.id || nouvelId();
      const now = maintenant();
      const doc = { ...data, id, createdAt: data.createdAt || now, updatedAt: now };
      state[coll] = { ...state[coll], [id]: doc };
      adapter.write(coll, id, doc, false);
      emit();
      return id;
    },
    patch(coll, id, partial) {
      const now = maintenant();
      const cur = state[coll][id] || { id };
      const doc = fusion(cur, { ...partial, updatedAt: now });
      state[coll] = { ...state[coll], [id]: doc };
      adapter.write(coll, id, { ...partial, updatedAt: now }, true);
      emit();
    },
    remove(coll, id) {
      if (!state[coll][id]) return;
      const copie = { ...state[coll] };
      delete copie[id];
      state[coll] = copie;
      adapter.remove(coll, id);
      emit();
    },
    getPhoto: (id) => adapter.getPhoto(id),
    putPhoto: (id, data, meta) => adapter.putPhoto(id, data, meta),
    removePhoto: (id) => adapter.removePhoto(id),
    signOut: () => adapter.signOut && adapter.signOut()
  };
  return store;
}
