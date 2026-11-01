import { useState, useEffect, useRef } from 'preact/hooks';
import { useApp, aller, Feuille, Champ, Vignette, Bac, PhotoStockee, IconRetour, IconLoupe, IconCamera, Etincelle } from '../base.jsx';
import { liste, compteParStatut, estEnStock, envoisAFaire, articlesARevoir, rechercherArticles, trouverMarque, chercherMarques } from '../../logic/calc.js';
import { STATUT, STATUTS, statutSuivant, ETATS_VINTED, CATEGORIES, MOTIFS_SORTIE, nouvelId } from '../../data/schema.js';
import { fmtE } from '../../logic/rules.js';
import { fmtCourt, isoDate, diffDays } from '../../logic/dates.js';
import { changerStatut, enregistrerVente, remettreEnLigne, sortirDuStock, supprimerArticle } from '../actions.js';
import { compresserPhoto } from '../../util/photo.js';

function useLarge() {
  const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 900px)') : null;
  const [large, setLarge] = useState(mq ? mq.matches : false);
  useEffect(() => {
    if (!mq) return;
    const f = () => setLarge(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return large;
}

const TUILES = [
  ['a_completer', 'Achetés · à compléter'],
  ['a_preparer', 'À préparer'],
  ['a_photographier', 'À photographier'],
  ['a_mettre_en_ligne', 'À mettre en ligne'],
  ['en_ligne', 'En ligne'],
  ['vendu', 'À envoyer'],
  ['revoir', 'En ligne depuis 30 j +'],
  ['envoye', 'Envoyés'],
  ['retour', 'Retours / litiges'],
  ['finalise', 'Finalisés'],
  ['sorti', 'Sortis du stock']
];

function libelle(statut, s) {
  if (statut === 'revoir') return `En ligne depuis ${s.delaiEnLigne} j +`;
  return STATUT[statut]?.label || 'Stock';
}

function ligneArticle(a, today, statut) {
  const morceaux = [a.marque, a.taille, a.etat].filter(Boolean);
  if (statut === 'vendu' || a.statut === 'vendu') return `${fmtE(a.prixVente)} · envoyer avant le ${a.envoiLimite ? fmtCourt(a.envoiLimite) : '?'}`;
  if (a.statut === 'en_ligne' && a.enLigneAt) return `${fmtE(a.prixAffiche)} · en ligne depuis ${diffDays(isoDate(new Date(a.enLigneAt)), today)} j`;
  return [...morceaux, STATUT[a.statut]?.court].filter(Boolean).join(' · ') || STATUT[a.statut]?.court;
}

export function Stock({ statut }) {
  const { state, store, s, today, route, toast } = useApp();
  const large = useLarge();
  const [q, setQ] = useState(route.params.q || '');
  const [sel, setSel] = useState(null);
  const [bacSheet, setBacSheet] = useState(false);
  const counts = compteParStatut(state);
  const enStock = liste(state.articles).filter(estEnStock);
  const valeur = enStock.reduce((t, a) => t + (a.cout || 0), 0);
  const envois = envoisAFaire(state, today);
  const revoir = articlesARevoir(state, today);
  const urgent = envois.filter((e) => e.restants != null && e.restants <= 1).length;
  const ouvertId = route.params.a;

  useEffect(() => setSel(null), [statut]);

  let articles = [];
  if (q.trim()) articles = rechercherArticles(state, q);
  else if (statut === 'revoir') articles = revoir.map((r) => r.article);
  else if (statut === 'vendu') articles = envois.map((e) => e.article);
  else if (statut) {
    articles = liste(state.articles).filter((a) => a.statut === statut);
    articles.sort((a, b) =>
      statut === 'en_ligne'
        ? (a.enLigneAt || '').localeCompare(b.enLigneAt || '')
        : String(a.bac || 'zz').localeCompare(String(b.bac || 'zz'), 'fr', { numeric: true }) || (b.achatAt || '').localeCompare(a.achatAt || '')
    );
  }

  const href = (a) => {
    if (!large) return `#/article/${a.id}`;
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    p.set('a', a.id);
    return `#/stock${statut ? '/' + statut : ''}?${p}`;
  };

  const selection = sel ? articles.filter((a) => sel.has(a.id)) : [];
  const basculer = (id) => {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  };

  const suivantLot = statut && statutSuivant(statut);
  const actionLot = () => {
    if (!selection.length) return;
    if (statut === 'revoir') {
      for (const a of selection) store.patch('articles', a.id, { prixAffiche: Math.max(1, Math.round((a.prixAffiche || a.revente || 0) * 0.9)) });
      toast(`Prix baissé de 10 % sur ${selection.length} article${selection.length > 1 ? 's' : ''}.`);
    } else if (suivantLot) {
      for (const a of selection) changerStatut(store, a, suivantLot);
      toast(`${selection.length} → ${STATUT[suivantLot].court}`);
    }
    setSel(null);
  };
  const labelLot = statut === 'revoir' ? 'Baisser de 10 %' : statut === 'vendu' ? 'Marquer envoyés' : statut === 'envoye' ? 'Marquer finalisés' : suivantLot ? `Passer à « ${STATUT[suivantLot].court} »` : null;

  const liste_ = (
    <div class="liste col" style="gap:10px">
      <header class="top">
        <div class="col">
          <span class="sur">{enStock.length} pièces · {fmtE(valeur)} au prix d’achat</span>
          <h1>{statut ? libelle(statut, s) : 'Stock'}</h1>
        </div>
        <a class="small strong" href="#/marques" style="padding:10px 0">Marques</a>
      </header>
      {statut && <a class="retour" href="#/stock"><IconRetour size={20} />Tout le stock</a>}
      <label class="search">
        <IconLoupe size={20} />
        <span class="sr">Rechercher dans le stock</span>
        <input type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Marque, pièce, taille ou n° de bac" autocomplete="off" />
      </label>

      {!statut && !q.trim() && (
        <>
          <section class="grid2" aria-label="Lots à traiter">
            {TUILES.filter(([id]) => (id === 'revoir' ? revoir.length : counts[id]) || ['a_completer', 'a_preparer', 'a_photographier', 'a_mettre_en_ligne', 'en_ligne'].includes(id)).map(([id, label]) => {
              const n = id === 'revoir' ? revoir.length : counts[id] || 0;
              const cls = id === 'vendu' && n ? (urgent ? 'tile warn' : 'tile') : id === 'a_photographier' && n ? 'tile dark' : id === 'revoir' ? 'tile soft' : 'tile';
              return (
                <a key={id} class={cls} href={`#/stock/${id}`}>
                  <b>{n}</b>
                  <span>{id === 'vendu' && urgent ? `${label} · ${urgent} urgent${urgent > 1 ? 's' : ''}` : id === 'revoir' ? libelle('revoir', s) : label}</span>
                </a>
              );
            })}
          </section>
          <h2 class="section-t">Derniers ajouts</h2>
          {liste(state.articles)
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
            .slice(0, 6)
            .map((a) => <LigneArticle key={a.id} a={a} href={href(a)} today={today} actif={ouvertId === a.id} />)}
        </>
      )}

      {(statut || q.trim()) && (
        <>
          {statut && labelLot && articles.length > 0 && (
            <div class="row between">
              <span class="small muted">{articles.length} article{articles.length > 1 ? 's' : ''}</span>
              <button class="btn s ghost" onClick={() => setSel(sel ? null : new Set())}>{sel ? 'Annuler' : 'Sélectionner'}</button>
            </div>
          )}
          {sel && (
            <div class="hero" style="padding:12px 14px;gap:8px;position:sticky;top:8px;z-index:5">
              <div class="row between">
                <span class="strong">{selection.length} sélectionné{selection.length > 1 ? 's' : ''}</span>
                <button class="btn s ghost" style="color:inherit;border-color:var(--hero-track)" onClick={() => setSel(new Set(articles.map((a) => a.id)))}>Tout</button>
              </div>
              <div class="row wrap">
                {labelLot && <button class="btn s light" disabled={!selection.length} onClick={actionLot}>{labelLot}</button>}
                {statut !== 'vendu' && statut !== 'envoye' && <button class="btn s ghost" style="color:inherit;border-color:var(--hero-track)" disabled={!selection.length} onClick={() => setBacSheet(true)}>Changer de bac</button>}
              </div>
            </div>
          )}
          {articles.length === 0 && <p class="vide-etat">{q.trim() ? 'Aucun article ne correspond.' : 'Rien ici pour l’instant.'}</p>}
          {articles.map((a) =>
            sel ? (
              <button key={a.id} class={'item' + (sel.has(a.id) ? ' sel' : '')} aria-pressed={sel.has(a.id)} onClick={() => basculer(a.id)}>
                <input type="checkbox" checked={sel.has(a.id)} tabIndex={-1} aria-hidden="true" style="width:20px;height:20px;accent-color:var(--accent)" />
                <Vignette article={a} />
                <span class="col grow"><span class="t ellipsis">{a.titre || 'Sans titre'}</span><span class="st ellipsis">{ligneArticle(a, today, statut)}</span></span>
                <Bac bac={a.bac} />
              </button>
            ) : (
              <LigneArticle key={a.id} a={a} href={href(a)} today={today} statut={statut} actif={ouvertId === a.id} />
            )
          )}
        </>
      )}
      {bacSheet && (
        <BacFeuille
          onClose={() => setBacSheet(false)}
          onOk={(bac) => {
            for (const a of selection) store.patch('articles', a.id, { bac });
            toast(`${selection.length} article${selection.length > 1 ? 's' : ''} → bac ${bac}`);
            setSel(null);
            setBacSheet(false);
          }}
        />
      )}
    </div>
  );

  return (
    <main class={'page' + (large ? ' full' : '')}>
      {large ? (
        <div class="split">
          {liste_}
          <aside class="panneau">{ouvertId && state.articles[ouvertId] ? <div class="card"><ArticleFiche id={ouvertId} compact /></div> : null}</aside>
        </div>
      ) : (
        liste_
      )}
    </main>
  );
}

function LigneArticle({ a, href, today, statut, actif }) {
  return (
    <a class={'item' + (actif ? ' sel' : '')} href={href}>
      <Vignette article={a} />
      <span class="col grow">
        <span class="t ellipsis">{a.titre || 'Sans titre'}{a.horsRegle ? ' · hors règle' : ''}</span>
        <span class="st ellipsis">{ligneArticle(a, today, statut)}</span>
      </span>
      <Bac bac={a.bac} />
    </a>
  );
}

function BacFeuille({ onClose, onOk, init = '' }) {
  const [bac, setBac] = useState(init);
  return (
    <Feuille titre="Ranger dans le bac" onClose={onClose}>
      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px">
        {Array.from({ length: 15 }, (_, i) => String(i + 1)).map((b) => (
          <button key={b} class="chip" aria-pressed={bac === b} onClick={() => setBac(b)}>{b}</button>
        ))}
      </div>
      <Champ label="Autre bac"><input class="input" value={bac} onInput={(e) => setBac(e.currentTarget.value.trim())} /></Champ>
      <button class="btn primary" disabled={!bac} onClick={() => onOk(bac)}>Valider</button>
    </Feuille>
  );
}

export function ArticlePage({ id }) {
  return (
    <main class="page">
      <button class="retour" onClick={() => (history.length > 1 ? history.back() : aller('/stock'))}><IconRetour size={20} />Retour</button>
      <ArticleFiche id={id} />
    </main>
  );
}

const RISQUE = { faible: ['green', 'faible'], moyen: ['orange', 'moyen'], eleve: ['red', 'élevé'] };

export function ArticleFiche({ id, compact = false }) {
  const { state, store, s, today, toast, confirmer } = useApp();
  const a = state.articles[id];
  const [feuille, setFeuille] = useState(null);
  const [suggest, setSuggest] = useState(false);
  const fileRef = useRef(null);
  if (!a) return <p class="vide-etat">Article introuvable.</p>;

  const maj = (patch) => store.patch('articles', a.id, patch);
  const num = (v) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const fiche = a.marque ? trouverMarque(state, a.marque) : null;
  const lieu = state.lieux[a.lieuId];
  const suivant = STATUT[a.statut]?.stock ? statutSuivant(a.statut) : null;
  const joursEnLigne = a.enLigneAt ? diffDays(isoDate(new Date(a.enLigneAt)), today) : null;
  const marques = suggest && a.marque ? chercherMarques(state, a.marque).slice(0, 5) : [];

  const ajouterPhoto = async (e) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    const { photo, vignette } = await compresserPhoto(f);
    const pid = nouvelId();
    store.putPhoto(pid, photo, { role: 'piece' });
    maj({ photoIds: [...(a.photoIds || []), pid], thumb: a.thumb || vignette });
  };

  let action = null;
  if (a.statut === 'a_mettre_en_ligne') action = { label: 'Mis en ligne sur Vinted', go: () => setFeuille('enligne') };
  else if (suivant) action = { label: `Fait → ${STATUT[suivant].court}`, go: () => changerStatut(store, a, suivant) };
  else if (a.statut === 'en_ligne') action = { label: 'Vendu', go: () => setFeuille('vente') };
  else if (a.statut === 'retour') action = { label: 'Remettre en ligne', go: () => remettreEnLigne(store, a) };

  return (
    <div class="col" style="gap:12px">
      {(a.photoIds || []).length > 0 ? (
        <div class="col" style="gap:8px">
          <PhotoStockee id={a.photoIds[0]} />
          {a.photoIds.length > 1 && (
            <div class="photos">{a.photoIds.slice(1, 4).map((p) => <PhotoStockee key={p} id={p} class="" />)}</div>
          )}
        </div>
      ) : null}
      <input ref={fileRef} type="file" accept="image/*" style="display:none" onChange={ajouterPhoto} />

      <div class="row between" style="align-items:flex-start">
        <div class="col grow">
          <span class="row wrap" style="gap:6px">
            <span class="pill accent">{STATUT[a.statut]?.label}</span>
            {a.horsRegle && <span class="pill red">Hors règle</span>}
            {a.demo && <span class="pill">Exemple</span>}
            {a.lotId && <span class="pill">Lot</span>}
          </span>
          <input class="input" style="font-size:19px;font-weight:700;border-color:transparent;padding-left:0;background:transparent" value={a.titre || ''} placeholder="Titre de l’article" aria-label="Titre" onChange={(e) => maj({ titre: e.currentTarget.value })} />
        </div>
        <button class="col" style="background:none;border:0;padding:0;cursor:pointer" onClick={() => setFeuille('bac')} aria-label="Changer de bac"><Bac bac={a.bac} /></button>
      </div>

      {a.statut === 'vendu' && a.envoiLimite && (
        <div class="card warn tight"><span class="strong">À envoyer avant le {fmtCourt(a.envoiLimite)} au soir</span><span class="small">Sinon Vinted annule la vente.</span></div>
      )}
      {a.statut === 'en_ligne' && joursEnLigne >= s.delaiEnLigne && (
        <div class="card soft tight">
          <span class="strong">En ligne depuis {joursEnLigne} jours</span>
          <div class="row wrap">
            <button class="btn s ghost" onClick={() => maj({ prixAffiche: Math.max(1, Math.round((a.prixAffiche || a.revente || 0) * 0.9)) })}>Baisser de 10 %</button>
            <button class="btn s ghost" onClick={() => maj({ prixAffiche: Math.max(1, Math.round((a.prixAffiche || a.revente || 0) * 0.8)) })}>Baisser de 20 %</button>
            <button class="btn s ghost" onClick={() => setFeuille('sortir')}>Sortir du stock</button>
          </div>
        </div>
      )}

      <div class="btns">
        {action && <button class="btn primary big" onClick={action.go}>{action.label}</button>}
        {a.statut === 'vendu' && <button class="btn primary big" onClick={() => changerStatut(store, a, 'envoye')}>Colis déposé</button>}
        {a.statut === 'envoye' && <button class="btn primary big" onClick={() => changerStatut(store, a, 'finalise')}>Finalisé (argent reçu)</button>}
        {!(a.photoIds || []).length && <button class="btn s ghost" onClick={() => fileRef.current?.click()}><IconCamera size={18} />Ajouter une photo</button>}
      </div>

      <div class="card">
        <Champ label="Marque">
          <input class="input" value={a.marque || ''} autocomplete="off" onInput={(e) => { maj({ marque: e.currentTarget.value }); setSuggest(true); }} />
        </Champ>
        {marques.length > 0 && marques[0].nom !== a.marque && (
          <div class="chips">{marques.map((m) => <button key={m.nom} class="chip" style="font-size:14px;font-weight:600" onClick={() => { maj({ marque: m.nom }); setSuggest(false); }}>{m.nom}</button>)}</div>
        )}
        {fiche && (
          <span class="row wrap" style="gap:6px">
            <span class="pill">{fiche.lo}–{fiche.hi} €</span>
            <span class={'pill ' + RISQUE[fiche.risque][0]}>Contrefaçon : {RISQUE[fiche.risque][1]}</span>
          </span>
        )}
        <div class="grid2">
          <Champ label="Catégorie">
            <select class="input" value={a.categorie || ''} onChange={(e) => maj({ categorie: e.currentTarget.value })}>
              <option value="">—</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Champ>
          <Champ label="Taille"><input class="input" value={a.taille || ''} onChange={(e) => maj({ taille: e.currentTarget.value })} /></Champ>
        </div>
        <Champ label="État Vinted">
          <select class="input" value={a.etat || ''} onChange={(e) => maj({ etat: e.currentTarget.value })}>
            <option value="">—</option>
            {ETATS_VINTED.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Champ>
        <div class="grid3">
          <Champ label="Coût (€)"><input class="input" inputMode="decimal" value={a.cout ?? ''} onChange={(e) => maj({ cout: num(e.currentTarget.value) ?? 0 })} /></Champ>
          <Champ label="Revente (€)"><input class="input" inputMode="decimal" value={a.revente ?? ''} onChange={(e) => maj({ revente: num(e.currentTarget.value) })} /></Champ>
          <Champ label="Prix affiché"><input class="input" inputMode="decimal" value={a.prixAffiche ?? ''} onChange={(e) => maj({ prixAffiche: num(e.currentTarget.value) })} /></Champ>
        </div>
        {a.prixVente != null && (
          <Champ label="Prix de vente (€)"><input class="input" inputMode="decimal" value={a.prixVente ?? ''} onChange={(e) => maj({ prixVente: num(e.currentTarget.value) })} /></Champ>
        )}
        <Champ label="Notes"><textarea class="input" value={a.notes || ''} onChange={(e) => maj({ notes: e.currentTarget.value })} /></Champ>
      </div>

      <div class="card tight">
        <div class="ligne"><span>Acheté</span><span>{a.achatAt ? fmtCourt(isoDate(new Date(a.achatAt))) : '—'}{lieu ? ` · ${lieu.nom.split(' – ')[0]}` : ''}</span></div>
        {a.enLigneAt && <div class="ligne"><span>En ligne depuis</span><span>{joursEnLigne} j</span></div>}
        {a.venduAt && <div class="ligne"><span>Vendu le</span><span>{fmtCourt(isoDate(new Date(a.venduAt)))}</span></div>}
        {a.prixVente != null && <div class="ligne"><span>Marge</span><span>{fmtE((a.prixVente || 0) - (a.cout || 0) - (s.hypotheses.emballage || 0))}</span></div>}
        {a.ia && <div class="ligne"><span>Analyse photo</span><span>{a.ia.potentiel} · {Math.round(a.ia.revente_min)}–{Math.round(a.ia.revente_max)} €</span></div>}
        {a.controle && <div class="ligne"><span>Contrôle contrefaçon</span><span>{Object.values(a.controle).filter(Boolean).length}/4 OK</span></div>}
      </div>

      <div class="btns">
        {['vendu', 'envoye'].includes(a.statut) && <button class="btn s ghost" onClick={() => changerStatut(store, a, 'retour')}>Retour / litige</button>}
        {a.statut === 'retour' && <button class="btn s ghost" onClick={() => changerStatut(store, a, 'finalise', { finaliseAt: new Date().toISOString() })}>Litige réglé, argent reçu</button>}
        {['vendu', 'envoye'].includes(a.statut) && <button class="btn s ghost" onClick={async () => { if (await confirmer('Annuler la vente et remettre l’article en ligne ?')) remettreEnLigne(store, a); }}>Vente annulée</button>}
        {a.statut !== 'sorti' && !['vendu', 'envoye', 'finalise'].includes(a.statut) && <button class="btn s ghost" onClick={() => setFeuille('sortir')}>Sortir du stock (donné, jeté, lot)</button>}
        <button class="btn s danger" onClick={async () => { if (await confirmer('Supprimer définitivement cet article ?')) { supprimerArticle(store, state, a); aller('/stock'); } }}>Supprimer</button>
      </div>

      {feuille === 'vente' && <VenteFeuille a={a} onClose={() => setFeuille(null)} />}
      {feuille === 'enligne' && <EnLigneFeuille a={a} onClose={() => setFeuille(null)} />}
      {feuille === 'sortir' && <SortirFeuille a={a} onClose={() => setFeuille(null)} />}
      {feuille === 'bac' && <BacFeuille init={a.bac || ''} onClose={() => setFeuille(null)} onOk={(bac) => { maj({ bac }); setFeuille(null); }} />}
    </div>
  );
}

export function VenteFeuille({ a, onClose }) {
  const { store, s, today, toast } = useApp();
  const [prix, setPrix] = useState(String(a.prixAffiche ?? a.revente ?? ''));
  const [jour, setJour] = useState(today);
  return (
    <Feuille titre="Vente" onClose={onClose}>
      <span class="small muted">{a.titre}</span>
      <Champ label="Prix de vente (€)"><input class="input" inputMode="decimal" value={prix} onInput={(e) => setPrix(e.currentTarget.value)} /></Champ>
      <Champ label="Date de la vente"><input class="input" type="date" value={jour} max={today} onInput={(e) => setJour(e.currentTarget.value)} /></Champ>
      <button
        class="btn primary big"
        onClick={() => {
          enregistrerVente(store, a, Number(String(prix).replace(',', '.')), jour, s);
          toast('Vente enregistrée. Délai d’envoi lancé.');
          onClose();
        }}
      >
        Enregistrer la vente
      </button>
    </Feuille>
  );
}

function EnLigneFeuille({ a, onClose }) {
  const { store } = useApp();
  const [prix, setPrix] = useState(String(a.prixAffiche ?? a.revente ?? ''));
  return (
    <Feuille titre="Mis en ligne" onClose={onClose}>
      <Champ label="Prix affiché sur Vinted (€)"><input class="input" inputMode="decimal" value={prix} onInput={(e) => setPrix(e.currentTarget.value)} /></Champ>
      <button class="btn primary big" onClick={() => { changerStatut(store, a, 'en_ligne', { prixAffiche: Number(String(prix).replace(',', '.')) || null }); onClose(); }}>Valider</button>
    </Feuille>
  );
}

function SortirFeuille({ a, onClose }) {
  const { store } = useApp();
  const [motif, setMotif] = useState(MOTIFS_SORTIE[0]);
  const [montant, setMontant] = useState('');
  return (
    <Feuille titre="Sortir du stock" onClose={onClose}>
      <div class="chips">{MOTIFS_SORTIE.map((m) => <button key={m} class="chip" aria-pressed={motif === m} onClick={() => setMotif(m)}>{m}</button>)}</div>
      {motif === 'Vendu en lot' && <Champ label="Montant reçu pour cette pièce (€)"><input class="input" inputMode="decimal" value={montant} onInput={(e) => setMontant(e.currentTarget.value)} /></Champ>}
      <button class="btn primary" onClick={() => { sortirDuStock(store, a, motif, String(montant).replace(',', '.')); onClose(); }}>Valider</button>
    </Feuille>
  );
}
