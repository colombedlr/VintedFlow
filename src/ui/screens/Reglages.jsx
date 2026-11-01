import { useState } from 'preact/hooks';
import { useApp, Champ, IconRetour, IconCadenas } from '../base.jsx';
import { nextMonday, fmtCourt } from '../../logic/dates.js';
import { liste } from '../../logic/calc.js';
import { fmtE } from '../../logic/rules.js';
import { exporterExcel, exporterCSV, exporterJSON } from '../../util/export.js';
import { effacerExemples } from '../../data/seed.js';
import { TYPES_TEMPS } from '../../data/schema.js';
import { tempsDe } from '../../logic/taches.js';

const CHAMPS_DISCIPLINE = [
  ['minRevente', 'Revente minimum (€)'],
  ['multiple', 'Revente ≥ … × le prix'],
  ['budgetHebdo', 'Budget achats par semaine (€)'],
  ['reserve', 'Réserve de sécurité (€)'],
  ['piecesMax', 'Pièces max par sortie'],
  ['sortiesMaxSemaine', 'Sorties max par semaine']
];

export function Reglages() {
  const { store, state, s, today, toast, essai, confirmer } = useApp();
  const brut = state.settings.main;
  const [disc, setDisc] = useState({ ...(brut.pending?.values || s.discipline) });
  const maj = (patch) => store.patch('settings', 'main', patch);
  const num = (v) => Number(String(v).replace(',', '.'));
  const lundi = nextMonday(today);
  const change = CHAMPS_DISCIPLINE.some(([k]) => num(disc[k]) !== s.discipline[k]);
  const nbExemples = liste(state.articles).filter((a) => a.demo).length;

  const programmer = () => {
    const values = Object.fromEntries(CHAMPS_DISCIPLINE.map(([k]) => [k, num(disc[k]) || s.discipline[k]]));
    maj({ pending: { effectiveFrom: lundi, values } });
    toast(`Changement programmé pour le ${fmtCourt(lundi)}.`);
  };

  return (
    <main class="page">
      <a class="retour" href="#/bilan"><IconRetour size={20} />Bilan</a>
      <header class="top"><div class="col"><span class="sur">{brut.appName || 'VintedFlow'}</span><h1>Réglages</h1></div></header>

      <section class="card">
        <span class="row strong"><IconCadenas size={18} />Règles et budgets</span>
        <span class="small muted">Pour tenir la discipline, un changement ici ne s’applique que le lundi suivant.</span>
        {brut.pending && (
          <div class="card warn tight">
            <span class="strong">Prévu pour le {fmtCourt(brut.pending.effectiveFrom)}</span>
            <span class="small">{CHAMPS_DISCIPLINE.filter(([k]) => brut.pending.values[k] !== s.discipline[k]).map(([k, l]) => `${l} : ${brut.pending.values[k]}`).join(' · ') || 'Aucun changement'}</span>
            <button class="btn s ghost" onClick={() => { maj({ pending: null }); setDisc({ ...s.discipline }); }}>Annuler ce changement</button>
          </div>
        )}
        <div class="grid2">
          {CHAMPS_DISCIPLINE.map(([k, l]) => (
            <Champ key={k} label={`${l} · actuel ${s.discipline[k]}`}>
              <input class="input" inputMode="decimal" value={disc[k]} onInput={(e) => setDisc({ ...disc, [k]: e.currentTarget.value })} />
            </Champ>
          ))}
        </div>
        <button class="btn primary" disabled={!change} onClick={programmer}>Appliquer le {fmtCourt(lundi)}</button>
      </section>

      <section class="card">
        <span class="strong">Objectif et statut</span>
        <Champ label="Bénéfice net visé par mois (€)"><input class="input" inputMode="decimal" value={brut.objectif} onChange={(e) => maj({ objectif: num(e.currentTarget.value) || brut.objectif })} /></Champ>
        <div class="chips" role="group" aria-label="Statut">
          <button class="chip" aria-pressed={brut.statut === 'particulier'} onClick={() => maj({ statut: 'particulier' })}>Particulier</button>
          <button class="chip" aria-pressed={brut.statut === 'micro'} onClick={() => maj({ statut: 'micro' })}>Micro-entreprise</button>
        </div>
        {brut.statut === 'micro' ? (
          <>
            <span class="small muted">Cotisations calculées sur tes ventes : {String(brut.cotisations.acre ? brut.cotisations.tauxAcre * 100 : brut.cotisations.taux * 100).replace('.', ',')} %.</span>
            <button class="chip" aria-pressed={!!brut.cotisations.acre} onClick={() => maj({ cotisations: { acre: !brut.cotisations.acre } })}>ACRE la première année</button>
          </>
        ) : (
          <span class="small muted">Aucune cotisation n’est calculée. Bascule sur « Micro-entreprise » le jour où tu déclares.</span>
        )}
      </section>

      <section class="card">
        <span class="strong">Hypothèses de départ</span>
        <span class="small muted">Remplacées automatiquement par tes vraies moyennes après 3 semaines et 10 ventes.</span>
        <div class="grid3">
          <Champ label="Achat moyen"><input class="input" inputMode="decimal" value={brut.hypotheses.achatMoyen} onChange={(e) => maj({ hypotheses: { achatMoyen: num(e.currentTarget.value) } })} /></Champ>
          <Champ label="Revente moy."><input class="input" inputMode="decimal" value={brut.hypotheses.reventeMoyenne} onChange={(e) => maj({ hypotheses: { reventeMoyenne: num(e.currentTarget.value) } })} /></Champ>
          <Champ label="Emballage"><input class="input" inputMode="decimal" value={brut.hypotheses.emballage} onChange={(e) => maj({ hypotheses: { emballage: num(e.currentTarget.value) } })} /></Champ>
        </div>
      </section>

      <section class="card">
        <span class="strong">Transport</span>
        <div class="grid2">
          <Champ label="Ticket RTM (€)"><input class="input" inputMode="decimal" value={brut.transport.ticket} onChange={(e) => maj({ transport: { ticket: num(e.currentTarget.value) } })} /></Champ>
          <Champ label="Abonnement Voi (€/mois)"><input class="input" inputMode="decimal" value={brut.transport.voiAbonnement} onChange={(e) => maj({ transport: { voiAbonnement: num(e.currentTarget.value) } })} /></Champ>
          <Champ label="Voi : déblocage (€)"><input class="input" inputMode="decimal" value={brut.transport.voiDeblocage} onChange={(e) => maj({ transport: { voiDeblocage: num(e.currentTarget.value) } })} /></Champ>
          <Champ label="Voi : €/min après 20 min"><input class="input" inputMode="decimal" value={brut.transport.voiMinute} onChange={(e) => maj({ transport: { voiMinute: num(e.currentTarget.value) } })} /></Champ>
        </div>
        <span class="xs muted">Depuis le 1er novembre 2026, un trajet RTM coûte 1,60 € sur carte rechargeable au lieu de 2 €.</span>
      </section>

      <section class="card">
        <span class="strong">Temps pro et perso (heures par jour)</span>
        <span class="small muted">Sert à vérifier que tes tâches tiennent dans la journée. Le temps pro inclut les blocs de la journée type.</span>
        <div class="grid2">
          {[['pro', 'semaine', 'Pro en semaine'], ['pro', 'weekend', 'Pro le week-end'], ['perso', 'semaine', 'Perso en semaine'], ['perso', 'weekend', 'Perso le week-end']].map(([t, j, l]) => (
            <Champ key={t + j} label={l}>
              <input class="input" inputMode="decimal" value={String(Math.round((tempsDe(brut)[t][j] / 60) * 10) / 10).replace('.', ',')} onChange={(e) => maj({ temps: { [t]: { ...tempsDe(brut)[t], [j]: Math.round(num(e.currentTarget.value) * 60) || tempsDe(brut)[t][j] } } })} />
            </Champ>
          ))}
        </div>
      </section>

      <section class="card">
        <span class="strong">Journée type</span>
        {['semaine', 'weekend'].map((k) => (
          <div key={k} class="col" style="gap:6px">
            <span class="small strong muted">{k === 'semaine' ? 'En semaine' : 'Le week-end'}</span>
            {brut.journee[k].map((b, i) => (
              <div key={i} class="row">
                <span class="small grow">{TYPES_TEMPS[b.type] || b.type}</span>
                <input class="input" style="width:110px" type="time" value={b.debut} aria-label={`Début ${TYPES_TEMPS[b.type]}`} onChange={(e) => maj({ journee: { [k]: brut.journee[k].map((x, j) => (j === i ? { ...x, debut: e.currentTarget.value } : x)) } })} />
                <input class="input" style="width:110px" type="time" value={b.fin} aria-label={`Fin ${TYPES_TEMPS[b.type]}`} onChange={(e) => maj({ journee: { [k]: brut.journee[k].map((x, j) => (j === i ? { ...x, fin: e.currentTarget.value } : x)) } })} />
              </div>
            ))}
          </div>
        ))}
      </section>

      <section class="card">
        <span class="strong">Délais</span>
        <div class="grid2">
          <Champ label="Baisse de prix après (jours en ligne)"><input class="input" inputMode="numeric" value={brut.delaiEnLigne} onChange={(e) => maj({ delaiEnLigne: num(e.currentTarget.value) || 30 })} /></Champ>
          <Champ label="Délai d’envoi Vinted (jours ouvrés)"><input class="input" inputMode="numeric" value={brut.delaiEnvoiJoursOuvres} onChange={(e) => maj({ delaiEnvoiJoursOuvres: num(e.currentTarget.value) || 5 })} /></Champ>
        </div>
      </section>

      <section class="card">
        <span class="strong">Données</span>
        {essai && <span class="small muted">Dans la version d’essai, les téléchargements sont bloqués : l’export marchera dans la version installée.</span>}
        <button class="btn ghost" disabled={essai} onClick={() => exporterExcel(state)}>Exporter tout en Excel</button>
        <button class="btn ghost" disabled={essai} onClick={() => exporterCSV(state)}>Exporter les articles en CSV</button>
        <button class="btn s ghost" disabled={essai} onClick={() => exporterJSON(state)}>Sauvegarde complète (JSON)</button>
        {nbExemples > 0 && (
          <button class="btn s danger" onClick={async () => { if (await confirmer(`Effacer les ${nbExemples} articles d’exemple ?`)) { effacerExemples(store); toast('Exemples effacés.'); } }}>Effacer les {nbExemples} articles d’exemple</button>
        )}
      </section>

      <section class="card">
        <span class="strong">Compte et synchronisation</span>
        {store.status.mode === 'firebase' ? (
          <>
            <span class="small">Connecté : {store.email}</span>
            <span class="small muted">{store.status.online ? (store.status.pending ? 'Envoi des dernières modifications…' : 'Tout est synchronisé.') : 'Hors ligne : tout est gardé sur l’appareil et partira au retour du réseau.'}</span>
            <button class="chip" aria-pressed={!!brut.gemini?.actif} onClick={() => maj({ gemini: { actif: !brut.gemini?.actif } })}>Analyse photo intégrée (Gemini, payant)</button>
            <Champ label="Modèle Gemini pour l’analyse photo"><input class="input" value={brut.gemini?.modele || ''} onChange={(e) => maj({ gemini: { modele: e.currentTarget.value.trim() } })} /></Champ>
            <button class="btn s ghost" onClick={async () => { if (await confirmer('Se déconnecter ?')) store.signOut(); }}>Se déconnecter</button>
          </>
        ) : (
          <span class="small muted">{essai ? 'Version d’essai : les données restent dans ce navigateur.' : 'Données sur cet appareil uniquement, en attendant Firebase.'}</span>
        )}
      </section>
      <p class="xs muted" style="text-align:center">Réserve {fmtE(s.discipline.reserve)} · Règle : revente ≥ {s.discipline.minRevente} € et ≥ {s.discipline.multiple} × le prix</p>
    </main>
  );
}
