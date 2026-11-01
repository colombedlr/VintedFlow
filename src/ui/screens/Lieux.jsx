import { useState } from 'preact/hooks';
import { useApp, aller, Champ, IconRetour, IconLoupe } from '../base.jsx';
import { liste, rentabiliteParLieu } from '../../logic/calc.js';
import { coutTrajet, accesTexte } from '../../logic/planning.js';
import { fmtE } from '../../logic/rules.js';
import { TYPES_LIEU, MODES_ACCES } from '../../data/lieux.js';
import { normaliser } from '../../data/marques.js';

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export function horairesTexte(l) {
  if (!l.ouverture?.length) return 'Horaires à trouver';
  return l.ouverture
    .map((o) => {
      if (o.date) return `le ${new Date(o.date + 'T12:00').toLocaleDateString('fr-FR')} ${o.debut || ''}–${o.fin || ''}`;
      const j = [1, 2, 3, 4, 5, 6, 0].filter((d) => o.jours?.includes(d)).map((d) => JOURS[d].toLowerCase()).join(', ');
      const sem = o.semaines?.length ? ` (${o.semaines.map((n) => (n === 1 ? '1er' : `${n}e`)).join(' et ')} du mois)` : '';
      return `${j}${sem} ${o.debut || ''}–${o.fin || ''}`;
    })
    .join(' · ');
}

export function Lieux() {
  const { state, store, today } = useApp();
  const [q, setQ] = useState('');
  const rent = Object.fromEntries(rentabiliteParLieu(state, today).map((r) => [r.lieu.id, r]));
  const k = normaliser(q);
  const lieux = liste(state.lieux)
    .filter((l) => !k || normaliser(`${l.nom} ${l.adresse} ${TYPES_LIEU[l.type]}`).includes(k))
    .sort((a, b) => (b.aValider ? 0 : 1) - (a.aValider ? 0 : 1) || a.nom.localeCompare(b.nom));

  const ajouter = () => {
    const id = store.put('lieux', { nom: 'Nouveau lieu', type: 'vide-grenier', adresse: '', ouverture: [], heureIdeale: '', acces: { mode: 'tram', ligne: '', minutes: 20, detail: '' }, notes: '', aValider: false, actif: true });
    aller(`/lieu/${id}`);
  };

  return (
    <main class="page">
      <a class="retour" href="#/semaine"><IconRetour size={20} />Semaine</a>
      <header class="top">
        <div class="col">
          <span class="sur">Depuis Saint-Pierre / Sainte-Thérèse</span>
          <h1>Lieux</h1>
        </div>
        <button class="btn s primary" onClick={ajouter}>+ Lieu</button>
      </header>
      <label class="search">
        <IconLoupe size={20} />
        <span class="sr">Rechercher un lieu</span>
        <input type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Nom, quartier, type…" />
      </label>
      {lieux.map((l) => {
        const r = rent[l.id];
        return (
          <a key={l.id} class="item" href={`#/lieu/${l.id}`} style={l.actif === false ? 'opacity:.55' : ''}>
            <span class="col grow">
              <span class="t ellipsis">{l.nom}</span>
              <span class="st ellipsis">{TYPES_LIEU[l.type] || l.type} · {horairesTexte(l)}</span>
              <span class="st ellipsis">{accesTexte(l.acces)} · {l.acces?.minutes ?? '?'} min</span>
            </span>
            <span class="col" style="align-items:flex-end;gap:6px">
              {l.aValider && <span class="pill orange">À valider</span>}
              {r?.parHeure != null && <span class="pill accent">{fmtE(Math.round(r.parHeure * 10) / 10)}/h</span>}
            </span>
          </a>
        );
      })}
    </main>
  );
}

export function LieuFiche({ id }) {
  const { state, store, s, today, toast, confirmer } = useApp();
  const l = state.lieux[id];
  if (!l) return <main class="page"><a class="retour" href="#/lieux"><IconRetour size={20} />Lieux</a><p class="vide-etat">Lieu introuvable.</p></main>;
  const r = rentabiliteParLieu(state, today).find((x) => x.lieu.id === id);
  const maj = (patch) => store.patch('lieux', id, patch);
  const majAcces = (patch) => maj({ acces: { ...l.acces, ...patch } });
  const ouverture = l.ouverture || [];
  const majOuv = (i, patch) => maj({ ouverture: ouverture.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  return (
    <main class="page">
      <a class="retour" href="#/lieux"><IconRetour size={20} />Lieux</a>
      <header class="top">
        <div class="col grow">
          <span class="sur">{TYPES_LIEU[l.type]}</span>
          <h1 style="font-size:22px">{l.nom}</h1>
        </div>
      </header>

      {l.aValider && (
        <div class="card warn tight">
          <span class="strong">Infos trouvées en ligne, à confirmer</span>
          <span class="small">Vérifie horaires et accès, puis valide.</span>
          <button class="btn s dark" onClick={() => { maj({ aValider: false }); toast('Lieu validé.'); }}>C’est vérifié</button>
        </div>
      )}

      <div class="card">
        <span class="strong">Rentabilité</span>
        {r && r.heures >= 0.5 ? (
          <div class="grid3">
            <div class="stat"><b>{r.parHeure != null ? fmtE(Math.round(r.parHeure * 10) / 10) : '–'}</b><span>par heure</span></div>
            <div class="stat"><b>{r.achetes}</b><span>achetées</span></div>
            <div class="stat"><b>{r.vendus}</b><span>vendues</span></div>
          </div>
        ) : (
          <span class="small muted">Pas encore assez de sorties ici pour calculer ce que le lieu rapporte par heure.</span>
        )}
      </div>

      <div class="card">
        <Champ label="Nom"><input class="input" value={l.nom} onChange={(e) => maj({ nom: e.currentTarget.value })} /></Champ>
        <Champ label="Type">
          <select class="input" value={l.type} onChange={(e) => maj({ type: e.currentTarget.value })}>
            {Object.entries(TYPES_LIEU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Champ>
        <Champ label="Adresse"><input class="input" value={l.adresse || ''} onChange={(e) => maj({ adresse: e.currentTarget.value })} /></Champ>
        {l.adresse && (
          <a class="small strong" href={`https://maps.apple.com/?daddr=${encodeURIComponent(l.adresse)}&dirflg=r`} target="_blank" rel="noopener">Itinéraire en transports (Plans)</a>
        )}
        <Champ label="Heure d’arrivée idéale"><input class="input" type="time" value={l.heureIdeale || ''} onChange={(e) => maj({ heureIdeale: e.currentTarget.value })} /></Champ>
      </div>

      <div class="card">
        <span class="strong">Ouverture</span>
        {ouverture.map((o, i) => (
          <div key={i} class="col" style="gap:8px;border-top:1px solid var(--line);padding-top:10px">
            {o.date ? (
              <Champ label="Date (événement ponctuel)"><input class="input" type="date" value={o.date} onChange={(e) => majOuv(i, { date: e.currentTarget.value })} /></Champ>
            ) : (
              <div class="chips">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <button key={d} class="chip" style="min-width:52px" aria-pressed={!!o.jours?.includes(d)} onClick={() => majOuv(i, { jours: o.jours?.includes(d) ? o.jours.filter((x) => x !== d) : [...(o.jours || []), d] })}>{JOURS[d]}</button>
                ))}
              </div>
            )}
            {o.semaines?.length > 0 && <span class="small muted">Seulement {o.semaines.map((n) => (n === 1 ? '1er' : `${n}e`)).join(' et ')} du mois</span>}
            <div class="grid2">
              <Champ label="De"><input class="input" type="time" value={o.debut || ''} onChange={(e) => majOuv(i, { debut: e.currentTarget.value })} /></Champ>
              <Champ label="À"><input class="input" type="time" value={o.fin || ''} onChange={(e) => majOuv(i, { fin: e.currentTarget.value })} /></Champ>
            </div>
            <button class="btn s ghost" onClick={() => maj({ ouverture: ouverture.filter((_, j) => j !== i) })}>Retirer ce créneau</button>
          </div>
        ))}
        <div class="grid2">
          <button class="btn s ghost" onClick={() => maj({ ouverture: [...ouverture, { jours: [], debut: '09:00', fin: '13:00' }] })}>+ Créneau régulier</button>
          <button class="btn s ghost" onClick={() => maj({ ouverture: [...ouverture, { date: today, debut: '07:00', fin: '13:00' }] })}>+ Date ponctuelle</button>
        </div>
      </div>

      <div class="card">
        <span class="strong">Accès depuis chez toi</span>
        <Champ label="Mode">
          <select class="input" value={l.acces?.mode || 'tram'} onChange={(e) => majAcces({ mode: e.currentTarget.value })}>
            {Object.entries(MODES_ACCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Champ>
        <div class="grid2">
          <Champ label="Ligne"><input class="input" value={l.acces?.ligne || ''} placeholder="T1, M1, bus 40…" onChange={(e) => majAcces({ ligne: e.currentTarget.value })} /></Champ>
          <Champ label="Minutes"><input class="input" type="number" inputMode="numeric" value={l.acces?.minutes ?? ''} onChange={(e) => majAcces({ minutes: Number(e.currentTarget.value) || 0 })} /></Champ>
        </div>
        <Champ label="Trajet"><input class="input" value={l.acces?.detail || ''} onChange={(e) => majAcces({ detail: e.currentTarget.value })} /></Champ>
        <span class="small muted">Aller-retour estimé : {fmtE(coutTrajet(l.acces, s.transport))}</span>
      </div>

      <div class="card">
        <Champ label="Notes"><textarea class="input" value={l.notes || ''} onChange={(e) => maj({ notes: e.currentTarget.value })} /></Champ>
        <button class="btn s ghost" onClick={() => maj({ actif: l.actif === false })}>{l.actif === false ? 'Réactiver ce lieu' : 'Ne plus proposer ce lieu'}</button>
        <button class="btn s danger" onClick={async () => { if (await confirmer('Supprimer ce lieu ?')) { store.remove('lieux', id); aller('/lieux'); } }}>Supprimer</button>
      </div>
    </main>
  );
}
