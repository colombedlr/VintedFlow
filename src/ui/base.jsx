import { createContext } from 'preact';
import { useContext, useEffect, useState, useRef } from 'preact/hooks';
import { isoDate } from '../logic/dates.js';

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function useStoreVersion(store) {
  const [, setV] = useState(0);
  useEffect(() => store.subscribe((v) => setV(v)), [store]);
  return store.version;
}

function lireRoute() {
  const h = (location.hash || '#/').slice(1);
  const [chemin, query] = h.split('?');
  const segs = chemin.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  return { segs, params, brut: h };
}

export function useRoute() {
  const [r, setR] = useState(lireRoute);
  useEffect(() => {
    const f = () => {
      setR(lireRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

export const aller = (chemin) => {
  location.hash = chemin.startsWith('#') ? chemin : '#' + chemin;
};

export function useMaintenant(intervalle = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalle);
    return () => clearInterval(t);
  }, [intervalle]);
  return now;
}

export const aujourdhuiIso = (now) => isoDate(now);

export function Feuille({ titre, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div class="voile" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="feuille" role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1} ref={ref}>
        <div class="poignee" aria-hidden="true" />
        <div class="row between">
          <h2 class="big" style="font-size:20px">{titre}</h2>
          <button class="btn s ghost" onClick={onClose}>Fermer</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Champ({ label, children }) {
  return (
    <label class="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Vignette({ article }) {
  if (article?.thumb) {
    return (
      <span class="thumb">
        <img src={article.thumb} alt="" />
      </span>
    );
  }
  return (
    <span class="thumb" aria-hidden="true">
      <IconCamera size={20} />
    </span>
  );
}

export function Bac({ bac }) {
  const vide = bac == null || bac === '';
  return (
    <span class={'bac' + (vide ? ' vide' : '')} aria-label={vide ? 'Pas de bac' : `Bac ${bac}`}>
      <small>BAC</small>
      <b>{vide ? '–' : bac}</b>
    </span>
  );
}

export function PhotoStockee({ id, class: cls = 'photo-grande' }) {
  const { store } = useApp();
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let vivant = true;
    store.getPhoto(id).then((d) => vivant && setSrc(d));
    return () => {
      vivant = false;
    };
  }, [id]);
  if (!src) return <div class={cls} aria-label="Photo en cours de chargement" />;
  return <img class={cls} src={src} alt="Photo de l’article" />;
}

/* ---------- Icônes (traits) ---------- */
const S = ({ size = 24, sw = 2, children, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={sw} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);
export const IconSoleil = (p) => <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></S>;
export const IconCal = (p) => <S {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></S>;
export const IconPlus = (p) => <S sw={2.5} {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconBoite = (p) => <S {...p}><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></S>;
export const IconBarres = (p) => <S {...p}><path d="M5 20V11M12 20V4M19 20v-6" /></S>;
export const IconCamera = (p) => <S {...p}><rect x="3" y="6" width="18" height="14" rx="3" /><circle cx="12" cy="13" r="3.5" /><path d="M9 6l1.5-2h3L15 6" /></S>;
export const IconTag = (p) => <S {...p}><path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></S>;
export const IconLoupe = (p) => <S sw={2.4} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></S>;
export const IconRetour = (p) => <S sw={2.2} {...p}><path d="M15 6l-6 6 6 6" /></S>;
export const IconCheck = (p) => <S sw={3} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></S>;
export const IconX = (p) => <S sw={3} {...p}><path d="M6 6l12 12M18 6L6 18" /></S>;
export const IconAlerte = (p) => <S sw={3} {...p}><path d="M12 5v9M12 19h.01" /></S>;
export const IconCadenas = (p) => <S sw={2.2} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></S>;
export const IconHorloge = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>;
export const IconFleche = (p) => <S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>;
export const IconReglages = (p) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></S>;
export const IconHorsLigne = (p) => <S sw={2.2} {...p}><path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" /></S>;
export const IconPin = (p) => <S {...p}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></S>;
export const Etincelle = ({ size = 14, color = 'var(--lilac)' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" fill={color} /></svg>
);
