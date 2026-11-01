import { useApp, aller, Etincelle, IconFleche } from '../base.jsx';
import { EtatSynchro } from '../App.jsx';
import { fmtLong, nowMinutes, minutesOf, mondayOf, fmtCourt, nomMois } from '../../logic/dates.js';
import { journee } from '../../logic/planning.js';
import { liste, sortieEnCours, envoisAFaire, articlesARevoir, objectifMois, semaineInfo } from '../../logic/calc.js';
import { fmtE } from '../../logic/rules.js';
import { effacerExemples } from '../../data/seed.js';
import { TYPES_TEMPS } from '../../data/schema.js';
import { TachesAujourdhui } from './Taches.jsx';

const LABEL_BLOC = { sourcing: 'Sourcing', preparation: 'Préparation', photos: 'Photos', annonces: 'Annonces', envois: 'Envois' };

function chronoActif(state) {
  return liste(state.temps).find((t) => t.debutAt && !t.finAt) || null;
}

export function Aujourdhui() {
  const { store, state, s, today, now, confirmer } = useApp();
  const { blocs, courant } = journee(state, today, nowMinutes(now));
  const enCours = sortieEnCours(state);
  const envois = envoisAFaire(state, today);
  const urgents = envois.filter((e) => e.restants != null && e.restants <= 1);
  const aRevoir = articlesARevoir(state, today);
  const obj = objectifMois(state, today);
  const sem = semaineInfo(state, mondayOf(today), s);
  const chrono = chronoActif(state);
  const nbExemples = liste(state.articles).filter((a) => a.demo).length;
  const nowMin = nowMinutes(now);
  const ensuite = blocs.filter((b) => b !== courant && !b.fait && minutesOf(b.fin) > nowMin && (!courant || b.debut >= courant.debut));
  const lundiAPreparer = !sem.verrouillee && sem.sorties.length === 0;

  const demarrerChrono = (type) => {
    if (chrono) store.patch('temps', chrono.id, { finAt: new Date().toISOString() });
    store.put('temps', { type, debutAt: new Date().toISOString(), date: today });
  };
  const arreterChrono = () => chrono && store.patch('temps', chrono.id, { finAt: new Date().toISOString() });
  const minutesChrono = chrono ? Math.max(0, Math.round((now - new Date(chrono.debutAt)) / 60000)) : 0;

  const actionBloc = (b) => {
    if (b.type === 'sourcing') {
      const so = state.sorties[b.sortieId];
      return { label: so?.statut === 'en_cours' ? 'Reprendre la sortie' : 'Préparer le départ', go: () => aller(`/sortie/${b.sortieId}`) };
    }
    if (b.type === 'envois') return { label: 'Voir les colis', go: () => aller('/stock/vendu') };
    if (b.statut) return { label: 'Ouvrir le lot', go: () => aller(`/stock/${b.statut}`) };
    return null;
  };

  return (
    <main class="page">
      <header class="top">
        <div class="col">
          <span class="sur">{fmtLong(today)} · {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}</span>
          <h1>Aujourd’hui</h1>
        </div>
        <EtatSynchro store={store} />
      </header>

      {enCours && (
        <a class="card warn" href={`#/sortie/${enCours.id}`} style="text-decoration:none">
          <span class="strong">Sortie en cours</span>
          <span class="small">Touche pour revenir au budget et aux sacs.</span>
        </a>
      )}

      {courant ? (
        <section class="hero" aria-label="Maintenant">
          <div class="row between">
            <span class="kicker"><Etincelle />Maintenant · {LABEL_BLOC[courant.type] || courant.type}</span>
            <span class="small muted strong">{courant.debut} – {courant.fin}</span>
          </div>
          <h2 class="big" style="font-size:24px;line-height:1.2">{courant.titre}</h2>
          {courant.sousTitre && <p class="muted" style="font-size:15px">{courant.sousTitre}</p>}
          {chrono && (
            <p class="small muted">Chrono {TYPES_TEMPS[chrono.type]?.toLowerCase() || ''} : {minutesChrono} min</p>
          )}
          <div class="btns">
            {(() => {
              const a = actionBloc(courant);
              return a ? <button class="btn light big" onClick={a.go}>{a.label}</button> : null;
            })()}
            {courant.type !== 'sourcing' &&
              (chrono ? (
                <button class="btn s ghost" style="color:inherit;border-color:var(--hero-track)" onClick={arreterChrono}>Arrêter le chrono ({minutesChrono} min)</button>
              ) : (
                <button class="btn s ghost" style="color:inherit;border-color:var(--hero-track)" onClick={() => demarrerChrono(courant.type === 'photos' ? 'photos' : courant.type)}>Démarrer le chrono</button>
              ))}
          </div>
        </section>
      ) : (
        <section class="hero" aria-label="Maintenant">
          <span class="kicker"><Etincelle />Maintenant</span>
          <h2 class="big" style="font-size:22px;line-height:1.25">{blocs.length ? 'Journée terminée' : 'Rien de prévu aujourd’hui'}</h2>
          <p class="muted" style="font-size:15px">
            {blocs.length ? 'Tout est fait pour aujourd’hui. Bravo.' : 'Pas de sortie ni de lot à traiter. Planifie ta semaine ou avance tes annonces.'}
          </p>
          {!blocs.length && <button class="btn light big" onClick={() => aller('/semaine')}>Voir ma semaine</button>}
        </section>
      )}

      {urgents.length > 0 && (
        <a class="card danger" href="#/stock/vendu" style="text-decoration:none">
          <span class="strong">{urgents.length} colis à envoyer {urgents.some((u) => u.restants <= 0) ? 'aujourd’hui' : 'avant demain soir'}</span>
          <span class="small">Sinon Vinted annule la vente automatiquement.</span>
        </a>
      )}

      {ensuite.length > 0 && (
        <section class="col" style="gap:8px" aria-label="Ensuite">
          <h3 class="section-t">Ensuite</h3>
          {ensuite.map((b, i) => {
            const a = actionBloc(b);
            return (
              <button key={i} class="item" onClick={a ? a.go : undefined}>
                <span class="big" style="font-size:14px;width:50px">{b.debut}</span>
                <span class="col grow">
                  <span class="t ellipsis">{b.titre}</span>
                  {b.sousTitre && <span class="st ellipsis">{b.sousTitre}</span>}
                </span>
                {b.urgent && <span class="pill orange">Urgent</span>}
              </button>
            );
          })}
        </section>
      )}

      <TachesAujourdhui blocs={blocs} />

      {lundiAPreparer && (
        <a class="card soft" href="#/semaine" style="text-decoration:none">
          <span class="strong">Ta semaine n’est pas planifiée</span>
          <span class="small">Choisis tes sorties et leur budget, puis verrouille.</span>
        </a>
      )}

      {aRevoir.length > 0 && (
        <a class="item" href="#/stock/revoir">
          <span class="col grow">
            <span class="t">{aRevoir.length} article{aRevoir.length > 1 ? 's' : ''} en ligne depuis {s.delaiEnLigne} jours ou plus</span>
            <span class="st">Baisse le prix ou sors-les du stock</span>
          </span>
          <IconFleche size={20} />
        </a>
      )}

      <a href="#/bilan" class="card soft" style="text-decoration:none;gap:8px">
        <span class="row between">
          <span class="small strong">Objectif {nomMois(today).toLowerCase()}</span>
          <span class="big" style="font-size:15px">{fmtE(Math.round(obj.benefice))} / {fmtE(obj.objectif)}</span>
        </span>
        <span class="bar" style="background:var(--surface)"><span style={`width:${Math.round(obj.progression * 100)}%`} /></span>
        <span class="small">
          {obj.restant <= 0 ? 'Objectif atteint ce mois-ci.' : `Rythme à tenir : ${obj.rythme.toFixed(1).replace('.', ',')} vente${obj.rythme >= 2 ? 's' : ''} par jour`}
        </span>
      </a>

      {nbExemples > 0 && (
        <div class="card tight">
          <span class="small">{nbExemples} articles d’exemple sont chargés pour découvrir l’app.</span>
          <button
            class="btn s ghost"
            onClick={async () => {
              if (await confirmer('Effacer les articles d’exemple ? Tes vraies données ne sont pas touchées.')) effacerExemples(store);
            }}
          >
            Effacer les exemples
          </button>
        </div>
      )}
      {sem.verrouillee && (
        <p class="xs muted" style="text-align:center">Semaine verrouillée · budget {fmtE(sem.budget)} · reste {fmtE(sem.restant)} · jusqu’au {fmtCourt(sem.dimanche)}</p>
      )}
    </main>
  );
}
