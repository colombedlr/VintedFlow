import { useState } from 'preact/hooks';
import { useApp, aller, Feuille, Champ, IconRetour, IconLoupe, Etincelle } from '../base.jsx';
import { chercherMarques, trouverMarque, statsParMarque, liste } from '../../logic/calc.js';
import { CONTROLES_CONTREFACON, normaliser } from '../../data/marques.js';
import { prixMaxParPiece, fmtE } from '../../logic/rules.js';
import { iaDisponible, analyserMarque } from '../../ai/gemini.js';

const RISQUE = { faible: ['green', 'faible'], moyen: ['orange', 'moyen'], eleve: ['red', 'élevé'] };
const POT = { fort: 'solid', moyen: 'accent', faible: '' };

export function Marques() {
  const { state, store, s, today, route, toast } = useApp();
  const [q, setQ] = useState(route.params.q || '');
  const [sel, setSel] = useState(route.params.q || null);
  const [edition, setEdition] = useState(null);
  const [chargement, setChargement] = useState(false);
  const resultats = chercherMarques(state, q);
  const fiche = sel ? trouverMarque(state, sel) : resultats.length === 1 ? resultats[0] : null;
  const stats = statsParMarque(state, today);
  const hist = fiche ? stats[normaliser(fiche.nom)] : null;
  const regle = { minRevente: s.discipline.minRevente, multiple: s.discipline.multiple };
  const inconnue = q.trim().length > 1 && !resultats.length;

  const chercherEnLigne = async () => {
    setChargement(true);
    try {
      const r = await analyserMarque(q.trim());
      store.put('marques', { nom: q.trim(), cat: r.cat || '', pot: r.pot || 'faible', lo: Math.round(r.lo || 0), hi: Math.round(r.hi || 0), risque: r.risque || 'moyen', note: r.note || '', source: 'ia' });
      setSel(q.trim());
      toast('Fiche ajoutée à ton catalogue.');
    } catch (e) {
      toast(e?.message || 'Recherche impossible.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <main class="page">
      <a class="retour" href="#/stock"><IconRetour size={20} />Stock</a>
      <header class="top">
        <div class="col"><span class="sur">Catalogue · marche hors ligne</span><h1>Marques</h1></div>
        <button class="btn s ghost" onClick={() => setEdition({ nom: q, pot: 'moyen', lo: 15, hi: 30, risque: 'faible', note: '' })}>+ Marque</button>
      </header>
      <label class="search">
        <IconLoupe size={20} />
        <span class="sr">Nom de la marque</span>
        <input type="search" value={q} placeholder="Écris une marque…" autocomplete="off" onInput={(e) => { setQ(e.currentTarget.value); setSel(null); }} />
      </label>

      {!fiche && !inconnue && (
        <div class="chips">
          {resultats.slice(0, q ? 12 : 24).map((m) => (
            <button key={m.nom} class="chip" style="font-size:14px;font-weight:600" onClick={() => setSel(m.nom)}>{m.nom}</button>
          ))}
        </div>
      )}

      {inconnue && (
        <section class="card">
          <span class="strong">« {q.trim()} » n’est pas dans ton catalogue</span>
          <span class="small muted">Avec du réseau, l’IA peut te donner une première fiche, qui s’ajoute à ton catalogue. Sinon, crée-la à la main.</span>
          {s.gemini?.actif && iaDisponible() && <button class="btn dark" disabled={chargement} onClick={chercherEnLigne}><Etincelle />{chargement ? 'Recherche…' : 'Chercher en ligne'}</button>}
          <button class="btn ghost" onClick={() => setEdition({ nom: q.trim(), pot: 'faible', lo: 5, hi: 15, risque: 'faible', note: '' })}>Créer la fiche</button>
        </section>
      )}

      {fiche && (
        <section class="card" aria-label="Fiche marque">
          <div class="row between">
            <span class="big" style="font-size:20px">{fiche.nom}</span>
            <span class={'pill ' + POT[fiche.pot]}>Potentiel {fiche.pot}</span>
          </div>
          {fiche.cat && <span class="small muted">{fiche.cat}</span>}
          <div class="grid2">
            <div class="stat"><span>Revente habituelle</span><b>{fiche.lo}–{fiche.hi} €</b></div>
            <div class="stat"><span>Prix max à payer</span><b>{fiche.hi < regle.minRevente ? 'Ne passe pas' : fmtE(prixMaxParPiece(Math.round((fiche.lo + fiche.hi) / 2), regle))}</b></div>
          </div>
          <span class="small">
            <b>Ton historique :</b>{' '}
            {hist?.n ? `${hist.n} vendue${hist.n > 1 ? 's' : ''}, ${fmtE(Math.round(hist.moyenne))} en moyenne${hist.delaiMoyen != null ? `, vendue en ${Math.round(hist.delaiMoyen)} j` : ''}` : 'aucune vente pour l’instant'}
            {hist?.stock ? ` · ${hist.stock} en stock` : ''}
          </span>
          {fiche.note && <span class="small muted">{fiche.note}</span>}
          {fiche.source !== 'catalogue' && <span class="xs muted">Source : {fiche.source === 'ia' ? 'analyse en ligne' : 'ta fiche'}</span>}
          {fiche.source === 'catalogue' && <span class="xs muted">Estimation de départ, remplacée par tes ventes dès 3 ventes de la marque.</span>}

          <div class="sep" />
          <div class="row between">
            <span class="strong">Contrefaçon</span>
            <span class={'pill ' + RISQUE[fiche.risque][0]}>Risque {RISQUE[fiche.risque][1]}</span>
          </div>
          {fiche.risque === 'faible' ? (
            <span class="small muted">Contrefaçons rares sur cette marque : un coup d’œil à l’étiquette suffit.</span>
          ) : (
            <>
              <span class="small">Sur le terrain, ces 4 contrôles débloquent l’achat. Un doute = tu passes.</span>
              <ul class="small" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
                {CONTROLES_CONTREFACON.map((c) => <li key={c.id}>{c.label}</li>)}
              </ul>
            </>
          )}
          {fiche.hi < regle.minRevente && <div class="feu rouge" style="padding:12px 14px"><span class="strong">Revente sous {regle.minRevente} € : ne passe jamais la règle.</span></div>}
          <div class="btns">
            {fiche.hi >= regle.minRevente && <a class="btn primary" href={`#/verifier?marque=${encodeURIComponent(fiche.nom)}`}>Vérifier une pièce {fiche.nom}</a>}
            <button class="btn s ghost" onClick={() => setEdition({ ...fiche, id: fiche.source !== 'catalogue' ? fiche.id : undefined })}>Modifier la fiche</button>
            <button class="btn s ghost" onClick={() => { setSel(null); setQ(''); }}>Autre marque</button>
          </div>
        </section>
      )}

      {edition && <EditionMarque init={edition} onClose={() => setEdition(null)} onSave={(nom) => { setQ(nom); setSel(nom); }} />}
    </main>
  );
}

function EditionMarque({ init, onClose, onSave }) {
  const { store, state } = useApp();
  const [f, setF] = useState({ nom: init.nom || '', cat: init.cat || '', pot: init.pot || 'moyen', lo: init.lo ?? 15, hi: init.hi ?? 30, risque: init.risque || 'faible', note: init.note || '' });
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const enregistrer = () => {
    if (!f.nom.trim()) return;
    const existant = liste(state.marques).find((m) => normaliser(m.nom) === normaliser(f.nom));
    const data = { ...f, nom: f.nom.trim(), lo: Number(f.lo) || 0, hi: Number(f.hi) || 0, source: 'perso', alias: init.alias || [] };
    if (existant) store.patch('marques', existant.id, data);
    else store.put('marques', data);
    onSave(data.nom);
    onClose();
  };
  return (
    <Feuille titre="Fiche marque" onClose={onClose}>
      <Champ label="Nom"><input class="input" value={f.nom} onInput={maj('nom')} /></Champ>
      <Champ label="Pièces typiques"><input class="input" value={f.cat} onInput={maj('cat')} /></Champ>
      <div class="grid2">
        <Champ label="Revente basse (€)"><input class="input" type="number" inputMode="decimal" value={f.lo} onInput={maj('lo')} /></Champ>
        <Champ label="Revente haute (€)"><input class="input" type="number" inputMode="decimal" value={f.hi} onInput={maj('hi')} /></Champ>
      </div>
      <div class="grid2">
        <Champ label="Potentiel">
          <select class="input" value={f.pot} onChange={maj('pot')}><option value="fort">Fort</option><option value="moyen">Moyen</option><option value="faible">Faible</option></select>
        </Champ>
        <Champ label="Risque contrefaçon">
          <select class="input" value={f.risque} onChange={maj('risque')}><option value="faible">Faible</option><option value="moyen">Moyen</option><option value="eleve">Élevé</option></select>
        </Champ>
      </div>
      <Champ label="Note"><textarea class="input" value={f.note} onInput={maj('note')} /></Champ>
      <button class="btn primary" onClick={enregistrer}>Enregistrer</button>
    </Feuille>
  );
}
