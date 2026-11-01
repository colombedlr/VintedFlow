import { useEffect, useState, useCallback } from 'preact/hooks';
import { Ctx, Feuille, useStoreVersion, useRoute, useMaintenant, IconSoleil, IconCal, IconPlus, IconBoite, IconBarres, IconHorsLigne, Etincelle } from './base.jsx';
import { isoDate } from '../logic/dates.js';
import { settingsEffectifs } from '../logic/calc.js';
import { premierDemarrage } from '../data/seed.js';
import { Aujourdhui } from './screens/Aujourdhui.jsx';
import { Semaine } from './screens/Semaine.jsx';
import { Lieux, LieuFiche } from './screens/Lieux.jsx';
import { SortieMode } from './screens/Sortie.jsx';
import { Verifier } from './screens/Verifier.jsx';
import { Marques } from './screens/Marques.jsx';
import { Stock, ArticlePage } from './screens/Stock.jsx';
import { Bilan } from './screens/Bilan.jsx';
import { Reglages } from './screens/Reglages.jsx';
import { MenuAjouter } from './screens/Ajouter.jsx';
import { Taches } from './screens/Taches.jsx';

export function EtatSynchro({ store }) {
  const st = store.status;
  if (st.mode === 'local') return <span class="sync local">Sur cet appareil</span>;
  if (!st.online)
    return (
      <span class="sync off">
        <IconHorsLigne size={14} /> Hors ligne · gardé sur l’appareil
      </span>
    );
  if (st.pending > 0) return <span class="sync attente"><span class="dot" />Envoi en cours…</span>;
  return <span class="sync ok"><span class="dot" />Synchronisé</span>;
}

const ONGLETS = [
  { id: 'aujourdhui', label: 'Aujourd’hui', href: '#/', Icon: IconSoleil },
  { id: 'semaine', label: 'Semaine', href: '#/semaine', Icon: IconCal },
  { id: 'plus' },
  { id: 'stock', label: 'Stock', href: '#/stock', Icon: IconBoite },
  { id: 'bilan', label: 'Bilan', href: '#/bilan', Icon: IconBarres }
];

function ongletActif(segs) {
  const s = segs[0] || 'aujourdhui';
  if (['stock', 'article', 'marques'].includes(s)) return 'stock';
  if (['semaine', 'lieux', 'lieu'].includes(s)) return 'semaine';
  if (['bilan', 'reglages'].includes(s)) return 'bilan';
  if (s === 'aujourdhui' || s === 'taches') return s === 'taches' ? 'taches' : 'aujourdhui';
  return s;
}

export function App({ store, essai = false, sansConfig = false }) {
  useStoreVersion(store);
  const route = useRoute();
  const now = useMaintenant();
  const today = isoDate(now);
  const [toast, setToast] = useState(null);
  const [plus, setPlus] = useState(false);
  const [dialogue, setDialogue] = useState(null);
  const confirmer = useCallback((message, ok = 'Confirmer') => new Promise((resolve) => setDialogue({ message, ok, resolve })), []);
  const fermerDialogue = (v) => {
    dialogue?.resolve(v);
    setDialogue(null);
  };
  const s0 = store.state.settings.main;

  useEffect(() => {
    if (store.status.ready && store.status.confirmed && !store.state.settings.main) premierDemarrage(store, today);
  }, [store.status.ready, store.status.confirmed, !!s0]);

  useEffect(() => {
    if (s0?.pending && s0.pending.effectiveFrom <= today) {
      store.patch('settings', 'main', { discipline: s0.pending.values, pending: null });
    }
  }, [s0?.pending?.effectiveFrom, today]);

  useEffect(() => {
    if (store.app && s0?.gemini?.modele) {
      import('../ai/gemini.js').then(({ configurerIA }) => configurerIA(store.app, s0.gemini.modele));
    }
  }, [s0?.gemini?.modele]);

  const montrer = useCallback((msg) => {
    setToast(msg);
    clearTimeout(montrer.t);
    montrer.t = setTimeout(() => setToast(null), 2600);
  }, []);

  if (!store.status.ready || !s0) {
    return (
      <div class="page" style="justify-content:center;align-items:center;min-height:100dvh">
        <span class="row" style="font-family:var(--display);font-weight:700;font-size:22px"><Etincelle size={18} color="var(--accent)" /> VintedFlow</span>
        <p class="muted small">{store.status.online || store.status.mode === 'local' ? 'Chargement…' : 'Chargement depuis l’appareil…'}</p>
      </div>
    );
  }

  const s = settingsEffectifs(s0, today);
  const ctx = { store, state: store.state, s, today, now, toast: montrer, confirmer, essai, sansConfig, route, ouvrirPlus: () => setPlus(true) };
  const segs = route.segs;
  const ecran = segs[0] || 'aujourdhui';
  const pleinEcran = ecran === 'sortie' || ecran === 'verifier';
  const actif = ongletActif(segs);

  let contenu;
  switch (ecran) {
    case 'semaine': contenu = <Semaine />; break;
    case 'lieux': contenu = <Lieux />; break;
    case 'lieu': contenu = <LieuFiche id={segs[1]} />; break;
    case 'sortie': contenu = <SortieMode id={segs[1]} />; break;
    case 'verifier': contenu = <Verifier />; break;
    case 'marques': contenu = <Marques />; break;
    case 'stock': contenu = <Stock statut={segs[1]} />; break;
    case 'article': contenu = <ArticlePage id={segs[1]} />; break;
    case 'bilan': contenu = <Bilan />; break;
    case 'reglages': contenu = <Reglages />; break;
    case 'taches': contenu = <Taches />; break;
    default: contenu = <Aujourdhui />;
  }

  return (
    <Ctx.Provider value={ctx}>
      <div class="app">
        {!pleinEcran && (
          <nav class="nav-large" aria-label="Navigation principale">
            <div class="liens">
              <span class="marque-app"><Etincelle size={16} color="var(--accent)" />{s.appName || 'VintedFlow'}</span>
              <a href="#/" aria-current={actif === 'aujourdhui' ? 'page' : undefined}>Aujourd’hui</a>
              <a href="#/taches" aria-current={actif === 'taches' ? 'page' : undefined}>Tâches</a>
              <a href="#/semaine" aria-current={actif === 'semaine' ? 'page' : undefined}>Semaine</a>
              <a href="#/stock" aria-current={actif === 'stock' ? 'page' : undefined}>Stock</a>
              <a href="#/bilan" aria-current={actif === 'bilan' ? 'page' : undefined}>Bilan</a>
            </div>
            <div class="row">
              <EtatSynchro store={store} />
              <button class="btn s primary" onClick={() => setPlus(true)}>+ Ajouter</button>
            </div>
          </nav>
        )}
        {essai && !pleinEcran && <div class="bandeau" style="margin:12px 16px 0;text-align:center">Version d’essai : tes saisies restent dans ce navigateur.</div>}
        {sansConfig && !pleinEcran && <div class="bandeau" style="margin:12px 16px 0;text-align:center">Firebase n’est pas encore branché : données sur cet appareil seulement.</div>}
        {contenu}
        {!pleinEcran && (
          <nav class="tabs" aria-label="Onglets">
            {ONGLETS.map((o) =>
              o.id === 'plus' ? (
                <button key="plus" class="plus" aria-label="Ajouter : achat, vente, dépense, temps" onClick={() => setPlus(true)}>
                  <IconPlus size={28} />
                </button>
              ) : (
                <a key={o.id} class="tab" href={o.href} aria-current={actif === o.id ? 'page' : undefined}>
                  <o.Icon size={24} />
                  <span>{o.label}</span>
                </a>
              )
            )}
          </nav>
        )}
        {plus && <MenuAjouter onClose={() => setPlus(false)} />}
        {dialogue && (
          <Feuille titre="Confirmer" onClose={() => fermerDialogue(false)}>
            <p style="font-size:16px;line-height:1.45">{dialogue.message}</p>
            <div class="btns">
              <button class="btn primary" onClick={() => fermerDialogue(true)}>{dialogue.ok}</button>
              <button class="btn ghost" onClick={() => fermerDialogue(false)}>Annuler</button>
            </div>
          </Feuille>
        )}
        {toast && <div class="toast" role="status">{toast}</div>}
      </div>
    </Ctx.Provider>
  );
}
