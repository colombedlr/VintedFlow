import { useState } from 'preact/hooks';
import { useApp, Feuille, Champ, Etincelle, IconReglages } from '../base.jsx';
import { objectifMois, tresorerie, heuresMois, rentabiliteParLieu, statsParMarque, statsParCategorie, ecarts } from '../../logic/calc.js';
import { fmtE } from '../../logic/rules.js';
import { monthKey, mondayOf, nomMois } from '../../logic/dates.js';
import { TYPES_TEMPS } from '../../data/schema.js';

const arr = (n) => Math.round(n);

export function Bilan() {
  const { state, s, today } = useApp();
  const [feuille, setFeuille] = useState(null);
  const obj = objectifMois(state, today);
  const t = tresorerie(state, today);
  const heures = heuresMois(state, monthKey(today));
  const parHeure = heures >= 0.5 ? obj.benefice / heures : null;
  const lieux = rentabiliteParLieu(state, today).slice(0, 5);
  const marques = Object.values(statsParMarque(state, today)).filter((m) => m.n > 0).sort((a, b) => b.profit - a.profit).slice(0, 5);
  const categories = Object.values(statsParCategorie(state, today)).filter((m) => m.n > 0).sort((a, b) => b.profit - a.profit).slice(0, 5);
  const ecartsSemaine = ecarts(state, mondayOf(today));
  const ecartsMois = ecarts(state, today.slice(0, 8) + '01');
  const maxLieu = Math.max(1, ...lieux.map((l) => l.parHeure || 0));

  return (
    <main class="page">
      <header class="top">
        <div class="col">
          <span class="sur">{nomMois(today)} · jour {obj.jourDuMois} sur {obj.joursDansMois}</span>
          <h1>Bilan</h1>
        </div>
        <a class="btn s ghost" href="#/reglages" aria-label="Réglages"><IconReglages size={20} /></a>
      </header>

      <section class="hero" aria-label="Objectif du mois">
        <span class="kicker"><Etincelle />Bénéfice net du mois</span>
        <span class="row" style="align-items:baseline;gap:8px">
          <span class="big" style={`font-size:46px;${obj.benefice < 0 ? 'color:#ffb3bd' : ''}`}>{fmtE(arr(obj.benefice))}</span>
          <span class="muted">sur {fmtE(obj.objectif)}</span>
        </span>
        <span class="bar"><span style={`width:${Math.round(obj.progression * 100)}%`} /></span>
        <div class="grid3">
          <div class="stat"><b>{obj.nb}</b><span>ventes</span></div>
          <div class="stat"><b>{obj.ventesRestantes}</b><span>encore à faire</span></div>
          <div class="stat"><b>{obj.rythme.toFixed(1).replace('.', ',')}</b><span>par jour</span></div>
        </div>
        <span class="xs muted">Marge moyenne {fmtE(Math.round(obj.moyennes.marge * 10) / 10)} par vente ({obj.moyennes.source}).</span>
      </section>

      {ecartsSemaine.length > 0 && (
        <div class="card danger tight">
          <span class="strong">{ecartsSemaine.length} achat{ecartsSemaine.length > 1 ? 's' : ''} hors règle cette semaine</span>
          <span class="small">{fmtE(ecartsSemaine.reduce((x, a) => x + (a.cout || 0), 0))} dépensés en dehors du cadre · {ecartsMois.length} ce mois-ci.</span>
        </div>
      )}

      <section class="card" aria-label="Argent retirable">
        <div class="row between" style="align-items:baseline">
          <span class="strong">Tu peux retirer</span>
          <span class="big" style="font-size:26px;color:var(--green-ink)">{fmtE(arr(t.retirable))}</span>
        </div>
        <div class="ligne"><span>Disponible (banque, espèces, porte-monnaie Vinted)</span><span>{fmtE(arr(t.disponible))}</span></div>
        <div class="ligne"><span>Réserve de sécurité</span><span>− {fmtE(t.reserve)}</span></div>
        <div class="ligne"><span>Achats encore prévus cette semaine</span><span>− {fmtE(arr(t.budgetSemaineRestant))}</span></div>
        {s.statut === 'micro' && <div class="ligne"><span>Cotisations URSSAF du mois à garder</span><span>− {fmtE(arr(t.cotisDues))}</span></div>}
        <div class="sep" />
        <div class="ligne"><span>Dont porte-monnaie Vinted</span><span>{fmtE(arr(t.porteMonnaie))}</span></div>
        <div class="ligne"><span>En attente chez Vinted · {t.nbAttente} vente{t.nbAttente > 1 ? 's' : ''}</span><span>{fmtE(arr(t.attente))}</span></div>
        <div class="ligne"><span>Stock · {t.nbStock} pièces au prix d’achat</span><span>{fmtE(arr(t.valeurStock))}</span></div>
        <div class="grid2">
          <button class="btn s ghost" onClick={() => setFeuille('virement_vinted')}>Vinted → banque</button>
          <button class="btn s ghost" onClick={() => setFeuille('retrait_perso')}>J’ai retiré pour moi</button>
        </div>
        <span class="xs muted">Le bénéfice compte ce que tu as vendu. L’argent retirable compte ce que tu as vraiment en poche, moins ce qui doit rester dans l’activité.</span>
      </section>

      <section class="card" aria-label="Temps">
        <div class="row between" style="align-items:baseline">
          <span class="strong">Par heure travaillée</span>
          <span class="big" style="font-size:20px">{parHeure != null ? fmtE(Math.round(parHeure * 10) / 10) : '–'}</span>
        </div>
        <span class="small muted">{heures.toFixed(1).replace('.', ',')} h ce mois (sorties + chronos)</span>
        <button class="btn s ghost" onClick={() => setFeuille('temps')}>Ajouter du temps</button>
      </section>

      <section class="card" aria-label="Lieux qui valent le trajet">
        <span class="strong">Lieux qui valent le trajet</span>
        {lieux.length === 0 && <span class="small muted">Apparaît après tes premières sorties.</span>}
        {lieux.map((r) => (
          <div key={r.lieu.id} class="row">
            <span class="grow small strong ellipsis">{r.lieu.nom.split(' – ')[0]}</span>
            <span class="bar" style="width:90px;height:8px"><span style={`width:${r.parHeure != null ? Math.max(4, Math.round((Math.max(0, r.parHeure) / maxLieu) * 100)) : 0}%;background:${r.parHeure != null && r.parHeure < 8 ? 'var(--red)' : 'var(--accent)'}`} /></span>
            <span class="small strong" style="width:70px;text-align:right">{r.parHeure != null ? `${fmtE(Math.round(r.parHeure * 10) / 10)}/h` : 'trop tôt'}</span>
          </div>
        ))}
      </section>

      {marques.length > 0 && (
        <section class="card" aria-label="Marques">
          <span class="strong">Marques qui rapportent</span>
          {marques.map((m) => (
            <div key={m.nom} class="ligne"><span>{m.nom} · {m.n} vendue{m.n > 1 ? 's' : ''}{m.delaiMoyen != null ? ` en ${Math.round(m.delaiMoyen)} j` : ''}</span><span>{fmtE(arr(m.profit))}</span></div>
          ))}
        </section>
      )}
      {categories.length > 0 && (
        <section class="card" aria-label="Catégories">
          <span class="strong">Catégories qui rapportent</span>
          {categories.map((m) => (
            <div key={m.nom} class="ligne"><span>{m.nom} · {m.n} vendue{m.n > 1 ? 's' : ''}</span><span>{fmtE(arr(m.profit))}</span></div>
          ))}
        </section>
      )}

      <section class="card tight" aria-label="Détail du mois">
        <span class="strong">Détail du mois</span>
        <div class="ligne"><span>Ventes encaissées</span><span>{fmtE(arr(obj.ca))}</span></div>
        <div class="ligne"><span>Coût d’achat des pièces vendues</span><span>− {fmtE(arr(obj.coutVendus))}</span></div>
        <div class="ligne"><span>Emballages</span><span>− {fmtE(Math.round(obj.emballages * 10) / 10)}</span></div>
        <div class="ligne"><span>Transport des sorties</span><span>− {fmtE(Math.round(obj.transport * 10) / 10)}</span></div>
        <div class="ligne"><span>Abonnement Voi et autres frais</span><span>− {fmtE(Math.round((obj.fixes + obj.depenses) * 10) / 10)}</span></div>
        {s.statut === 'micro' && <div class="ligne"><span>Cotisations URSSAF</span><span>− {fmtE(arr(obj.cotisations))}</span></div>}
        <div class="sep" />
        <div class="ligne"><span class="strong" style="color:var(--ink)">Bénéfice net</span><span>{fmtE(arr(obj.benefice))}</span></div>
      </section>

      {feuille && <MouvementFeuille type={feuille} onClose={() => setFeuille(null)} />}
    </main>
  );
}

export function MouvementFeuille({ type, onClose }) {
  const { store, today, toast } = useApp();
  const [montant, setMontant] = useState('');
  const [note, setNote] = useState('');
  const [typeTemps, setTypeTemps] = useState('preparation');
  const [jour, setJour] = useState(today);
  const titres = { virement_vinted: 'Virement Vinted → banque', retrait_perso: 'Retrait pour moi', depense: 'Dépense', temps: 'Temps travaillé' };
  const valider = () => {
    const n = Number(String(montant).replace(',', '.'));
    if (!(n > 0)) return toast('Indique un montant.');
    if (type === 'temps') store.put('temps', { type: typeTemps, minutes: n, date: jour });
    else store.put('mouvements', { type, montant: n, date: jour, note });
    toast('Enregistré.');
    onClose();
  };
  return (
    <Feuille titre={titres[type]} onClose={onClose}>
      {type === 'temps' && (
        <div class="chips">{Object.entries(TYPES_TEMPS).filter(([k]) => k !== 'sourcing').map(([k, v]) => <button key={k} class="chip" aria-pressed={typeTemps === k} onClick={() => setTypeTemps(k)}>{v}</button>)}</div>
      )}
      <Champ label={type === 'temps' ? 'Minutes' : 'Montant (€)'}><input class="input" inputMode="decimal" value={montant} onInput={(e) => setMontant(e.currentTarget.value)} /></Champ>
      <Champ label="Date"><input class="input" type="date" value={jour} max={today} onInput={(e) => setJour(e.currentTarget.value)} /></Champ>
      {type === 'depense' && <Champ label="Pour quoi ?"><input class="input" value={note} placeholder="Boost Vinted, cintres… (les emballages sont déjà comptés)" onInput={(e) => setNote(e.currentTarget.value)} /></Champ>}
      <button class="btn primary" onClick={valider}>Enregistrer</button>
    </Feuille>
  );
}
