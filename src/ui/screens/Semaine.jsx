import { useState } from 'preact/hooks';
import { useApp, aller, Feuille, Champ, IconCadenas } from '../base.jsx';
import { addDays, mondayOf, fmtCourt, jourCourt, dayOfMonth, dayOfWeek } from '../../logic/dates.js';
import { semaineInfo, liste } from '../../logic/calc.js';
import { proposerSemaine, lieuxOuverts, tourneesDuJour, coutTournee, heureDepart, accesTexte } from '../../logic/planning.js';
import { fmtE } from '../../logic/rules.js';
import { MODES_ACCES } from '../../data/lieux.js';

const STATUT_SORTIE = { prevue: 'Prévue', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' };

export function Semaine() {
  const { store, state, s, today, route, toast, confirmer } = useApp();
  const offset = Math.max(0, Math.min(1, Number(route.params.w || 0)));
  const lundi = addDays(mondayOf(today), 7 * offset);
  const sem = semaineInfo(state, lundi, s);
  const toutes = liste(state.sorties).filter((so) => so.date >= lundi && so.date <= sem.dimanche).sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  const [edit, setEdit] = useState(null);
  const max = s.discipline.sortiesMaxSemaine;
  const actives = sem.sorties.length;
  const nbLieux = liste(state.lieux).length;
  const aValider = liste(state.lieux).filter((l) => l.aValider).length;

  const proposer = () => {
    const props = proposerSemaine(state, lundi, s).filter((p) => p.date >= today);
    if (!props.length) {
      toast('Aucun lieu ouvert trouvé cette semaine : vérifie le carnet des lieux.');
      return;
    }
    for (const p of props) store.put('sorties', { ...p, statut: 'prevue' });
    toast(`${props.length} sortie${props.length > 1 ? 's' : ''} proposée${props.length > 1 ? 's' : ''}. Ajuste puis verrouille.`);
  };

  const verrouiller = async () => {
    const msg = sem.nonAlloue > 0
      ? `Verrouiller ? ${fmtE(sem.nonAlloue)} ne sont pas encore répartis : ils pourront servir à une sortie imprévue cette semaine.`
      : 'Verrouiller la semaine ? Les budgets ne pourront plus changer avant lundi prochain.';
    if (!(await confirmer(msg))) return;
    store.put('semaines', { id: lundi, lundi, budget: sem.budget, verrouillee: true, verrouilleeLe: new Date().toISOString() });
    toast('Semaine verrouillée.');
  };

  return (
    <main class="page">
      <header class="top">
        <div class="col">
          <span class="sur">Du {fmtCourt(lundi)} au {fmtCourt(sem.dimanche)}</span>
          <h1>Semaine</h1>
        </div>
        <a class="small strong" href="#/lieux" style="padding:10px 0">Lieux ({nbLieux})</a>
      </header>

      <div class="chips" role="group" aria-label="Choix de la semaine">
        <button class="chip" aria-pressed={offset === 0} onClick={() => aller('/semaine')}>Cette semaine</button>
        <button class="chip" aria-pressed={offset === 1} onClick={() => aller('/semaine?w=1')}>Semaine prochaine</button>
      </div>

      <section class="grid3" aria-label="Résumé">
        <div class="card tight"><b class="big" style="font-size:20px">{fmtE(sem.budget)}</b><span class="xs muted">budget achats</span></div>
        <div class="card tight"><b class="big" style="font-size:20px">{actives}</b><span class="xs muted">sorties sur {max} max</span></div>
        <div class="card tight"><b class="big" style="font-size:20px">{fmtE(Math.round(sem.transport))}</b><span class="xs muted">transport</span></div>
      </section>

      {sem.verrouillee ? (
        <div class="card soft tight">
          <span class="row strong"><IconCadenas size={18} />Semaine verrouillée</span>
          <span class="small">Dépensé {fmtE(sem.depense)} · reste {fmtE(sem.restant)}{sem.nonAlloue > 0 ? ` · ${fmtE(sem.nonAlloue)} non répartis` : ''}</span>
        </div>
      ) : (
        sem.nonAlloue > 0 && actives > 0 && <p class="small muted" style="padding:0 4px">{fmtE(sem.nonAlloue)} pas encore répartis entre les sorties.</p>
      )}

      {toutes.length === 0 && (
        <div class="card">
          <span class="strong">Aucune sortie prévue</span>
          <span class="small muted">L’app propose une routine : vide-greniers et puces le week-end tôt, ressourceries en semaine l’après-midi, dans la limite de {max} sorties et de {fmtE(sem.budget)}.</span>
          {!sem.verrouillee && <button class="btn primary" onClick={proposer}>Proposer ma semaine</button>}
        </div>
      )}

      {toutes.map((so) => {
        const lieux = (so.lieuxIds || []).map((id) => state.lieux[id]).filter(Boolean);
        const premier = lieux[0];
        const annulee = so.statut === 'annulee';
        const auj = so.date === today;
        return (
          <button
            key={so.id}
            class="item"
            style={`${auj && !annulee ? 'background:var(--hero);color:var(--on-hero);' : ''}${annulee ? 'opacity:.55;' : ''}`}
            onClick={() => (auj && so.statut !== 'annulee' ? aller(`/sortie/${so.id}`) : setEdit(so.id))}
          >
            <span class="col" style="width:46px;align-items:center;gap:0">
              <span class="xs strong" style="letter-spacing:.06em;opacity:.8">{jourCourt(so.date).toUpperCase().replace('.', '')}</span>
              <span class="big" style="font-size:20px">{dayOfMonth(so.date)}</span>
            </span>
            <span class="col grow">
              <span class="t ellipsis">{lieux.map((l) => l.nom.split(' – ')[0].split(' (')[0]).join(' → ') || 'Lieux à choisir'}</span>
              <span class="st ellipsis" style={auj ? 'color:var(--hero-muted)' : ''}>
                {annulee ? 'Annulée' : `Départ ${heureDepart(state, so)} · ${premier ? accesTexte(premier.acces) : ''}${so.statut !== 'prevue' ? ' · ' + STATUT_SORTIE[so.statut] : ''}`}
              </span>
            </span>
            <span class="pill accent big" style="font-size:14px;padding:8px 10px">{fmtE(so.budget)}</span>
          </button>
        );
      })}

      {!sem.verrouillee && toutes.length > 0 && (
        <div class="btns">
          {actives < max && sem.nonAlloue > 0 && <button class="btn ghost" onClick={() => setEdit('nouvelle')}>+ Ajouter une sortie</button>}
          <button class="btn primary big" onClick={verrouiller}><IconCadenas size={20} />Valider et verrouiller la semaine</button>
          <p class="xs muted" style="text-align:center">Budgets figés jusqu’à lundi prochain.</p>
        </div>
      )}
      {sem.verrouillee && offset === 0 && actives < max && sem.nonAlloue > 0 && (
        <button class="btn ghost" onClick={() => setEdit('nouvelle')}>Sortie imprévue ({fmtE(sem.nonAlloue)} disponibles)</button>
      )}

      <a class="item" href="#/lieux">
        <span class="col grow">
          <span class="t">Carnet des lieux</span>
          <span class="st">{nbLieux} lieux{aValider ? ` · ${aValider} à valider` : ''}</span>
        </span>
      </a>

      {edit && <EditeurSortie id={edit === 'nouvelle' ? null : edit} lundi={lundi} sem={sem} onClose={() => setEdit(null)} />}
    </main>
  );
}

function EditeurSortie({ id, lundi, sem, onClose }) {
  const { store, state, s, today, toast, confirmer } = useApp();
  const existante = id ? state.sorties[id] : null;
  const verrou = sem.verrouillee;
  const jours = Array.from({ length: 7 }, (_, i) => addDays(lundi, i)).filter((d) => d >= today);
  const [date, setDate] = useState(existante?.date || jours[0] || today);
  const [heure, setHeure] = useState(existante?.heure || ([0, 6].includes(dayOfWeek(date)) ? '07:00' : '14:00'));
  const [lieuxIds, setLieuxIds] = useState(existante?.lieuxIds || []);
  const autres = sem.alloue - (existante && existante.statut !== 'annulee' ? existante.budget || 0 : 0);
  const budgetMax = Math.max(0, sem.budget - autres);
  const [budget, setBudget] = useState(existante?.budget ?? Math.min(budgetMax, 30));
  const [pieces, setPieces] = useState(existante?.piecesMax ?? s.discipline.piecesMax);
  const [tous, setTous] = useState(false);

  const ouverts = lieuxOuverts(state, date).map((x) => x.lieu);
  const proposes = tous ? liste(state.lieux).filter((l) => l.actif !== false) : ouverts;
  const tournees = tourneesDuJour(state, date);
  const choisis = lieuxIds.map((x) => state.lieux[x]).filter(Boolean);
  const transport = coutTournee(choisis, s.transport);

  const basculer = (lid) => setLieuxIds(lieuxIds.includes(lid) ? lieuxIds.filter((x) => x !== lid) : [...lieuxIds, lid]);

  const enregistrer = () => {
    if (!lieuxIds.length) return toast('Choisis au moins un lieu.');
    const b = verrou && existante ? existante.budget : Math.min(Number(budget) || 0, budgetMax);
    if (b <= 0) return toast('Il n’y a plus de budget à répartir cette semaine.');
    const data = { date, heure, lieuxIds, budget: b, piecesMax: Math.max(1, Number(pieces) || s.discipline.piecesMax), transportPrevu: transport };
    if (existante) store.patch('sorties', existante.id, data);
    else store.put('sorties', { ...data, statut: 'prevue' });
    onClose();
  };

  return (
    <Feuille titre={existante ? 'Sortie' : 'Nouvelle sortie'} onClose={onClose}>
      <Champ label="Jour">
        <select class="input" value={date} onChange={(e) => setDate(e.currentTarget.value)} disabled={existante && existante.statut !== 'prevue'}>
          {jours.map((d) => <option key={d} value={d}>{fmtCourt(d)}</option>)}
        </select>
      </Champ>
      <Champ label="Heure d’arrivée sur place">
        <input class="input" type="time" value={heure} onInput={(e) => setHeure(e.currentTarget.value)} />
      </Champ>

      {tournees.length > 0 && !lieuxIds.length && (
        <div class="col" style="gap:6px">
          <span class="small strong">Tournées possibles ce jour-là</span>
          {tournees.slice(0, 3).map((t) => (
            <button key={t.ligne} class="item" onClick={() => { setLieuxIds(t.lieux.map((l) => l.id)); if (t.debut) setHeure(t.debut); }}>
              <span class="col grow">
                <span class="t">{t.lieux.map((l) => l.nom.split(' – ')[0].split(' (')[0]).join(' → ')}</span>
                <span class="st">{t.ligne} · dès {t.debut}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div class="col" style="gap:6px">
        <span class="small strong">Lieux ({tous ? 'tous' : 'ouverts ce jour-là'})</span>
        <div class="chips">
          {proposes.map((l) => (
            <button key={l.id} class="chip" aria-pressed={lieuxIds.includes(l.id)} onClick={() => basculer(l.id)} style="font-weight:600;font-size:14px">
              {l.nom.split(' – ')[0]}
            </button>
          ))}
          {!proposes.length && <span class="small muted">Aucun lieu ouvert ce jour-là dans ton carnet.</span>}
        </div>
        <button class="btn s ghost" onClick={() => setTous(!tous)}>{tous ? 'Seulement les lieux ouverts' : 'Voir tous les lieux'}</button>
      </div>

      <div class="grid2">
        <Champ label={verrou ? 'Budget (verrouillé)' : `Budget (max ${fmtE(budgetMax)})`}>
          <input class="input" type="number" inputMode="decimal" min="0" max={budgetMax} value={budget} disabled={verrou && !!existante} onInput={(e) => setBudget(e.currentTarget.value)} />
        </Champ>
        <Champ label="Pièces max (sacs)">
          <input class="input" type="number" inputMode="numeric" min="1" value={pieces} onInput={(e) => setPieces(e.currentTarget.value)} />
        </Champ>
      </div>
      <p class="small muted">Transport estimé : {fmtE(transport)} aller-retour.</p>

      <div class="btns">
        <button class="btn primary" onClick={enregistrer}>Enregistrer</button>
        {existante && existante.statut === 'prevue' && (
          <button
            class="btn danger"
            onClick={async () => {
              if (verrou) {
                if (await confirmer('Annuler cette sortie ? Son budget ne sera pas redistribué.')) store.patch('sorties', existante.id, { statut: 'annulee', budgetPerdu: true });
              } else if (await confirmer('Supprimer cette sortie ?')) store.remove('sorties', existante.id);
              onClose();
            }}
          >
            {verrou ? 'Annuler la sortie' : 'Supprimer'}
          </button>
        )}
      </div>
    </Feuille>
  );
}
