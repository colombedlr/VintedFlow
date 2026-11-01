import { useState } from 'preact/hooks';
import { useApp, aller, Feuille, Champ, Vignette, IconRetour, IconLoupe, IconHorsLigne, IconFleche } from '../base.jsx';
import { sortieStats, sortieEnCours, dureeSortieMin } from '../../logic/calc.js';
import { coutTournee, heureDepart, plageOuverte } from '../../logic/planning.js';
import { fmtE } from '../../logic/rules.js';
import { fmtCourt } from '../../logic/dates.js';
import { MODES_ACCES } from '../../data/lieux.js';

export function SortieMode({ id }) {
  const { store, state, s, today, now, toast } = useApp();
  const so = state.sorties[id];
  const [fin, setFin] = useState(false);
  if (!so) {
    return (
      <main class="page">
        <a class="retour" href="#/"><IconRetour size={20} />Aujourd’hui</a>
        <p class="vide-etat">Sortie introuvable.</p>
      </main>
    );
  }
  const lieux = (so.lieuxIds || []).map((x) => state.lieux[x]).filter(Boolean);
  const st = sortieStats(state, so);
  const autre = sortieEnCours(state);
  const minutes = so.debutAt ? Math.round(((so.finAt ? new Date(so.finAt) : now) - new Date(so.debutAt)) / 60000) : 0;
  const duree = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
  const lieuActuel = state.lieux[so.lieuActuel] || lieux[0];

  if (so.statut === 'prevue' || so.statut === 'annulee') {
    const peutPartir = so.statut === 'prevue' && so.date === today && !autre;
    return (
      <main class="page">
        <a class="retour" href="#/"><IconRetour size={20} />Aujourd’hui</a>
        <header class="top"><div class="col"><span class="sur">{fmtCourt(so.date)} · arrivée {so.heure}</span><h1>Sortie</h1></div></header>
        <section class="hero">
          <span class="kicker">Départ conseillé {heureDepart(state, so)}</span>
          <div class="grid3">
            <div class="stat"><b>{fmtE(so.budget)}</b><span>budget</span></div>
            <div class="stat"><b>{so.piecesMax}</b><span>pièces max</span></div>
            <div class="stat"><b>{fmtE(coutTournee(lieux, s.transport))}</b><span>transport</span></div>
          </div>
        </section>
        {lieux.map((l, i) => (
          <a key={l.id} class="item" href={`#/lieu/${l.id}`}>
            <span class="big" style="font-size:16px;width:24px">{i + 1}</span>
            <span class="col grow">
              <span class="t">{l.nom}</span>
              <span class="st">{l.acces?.detail || MODES_ACCES[l.acces?.mode]} · {l.acces?.minutes ?? '?'} min</span>
              {l.aValider && <span class="st" style="color:var(--orange-ink)">Horaires à confirmer avant de partir</span>}
            </span>
          </a>
        ))}
        {so.statut === 'annulee' && <p class="vide-etat">Sortie annulée.</p>}
        {so.statut === 'prevue' && so.date !== today && <p class="small muted" style="text-align:center">Tu pourras la démarrer le {fmtCourt(so.date)}.</p>}
        {autre && autre.id !== so.id && <p class="small muted" style="text-align:center">Termine d’abord la sortie en cours.</p>}
        {peutPartir && (
          <button class="btn primary big" onClick={() => store.patch('sorties', so.id, { statut: 'en_cours', debutAt: new Date().toISOString(), lieuActuel: lieux[0]?.id || null })}>
            Je pars
          </button>
        )}
      </main>
    );
  }

  if (so.statut === 'terminee') {
    return (
      <main class="page">
        <a class="retour" href="#/"><IconRetour size={20} />Aujourd’hui</a>
        <header class="top"><div class="col"><span class="sur">{fmtCourt(so.date)}</span><h1>Sortie terminée</h1></div></header>
        <div class="grid2">
          <div class="card tight"><b class="big" style="font-size:22px">{fmtE(st.depense)}</b><span class="xs muted">dépensés sur {fmtE(so.budget)}</span></div>
          <div class="card tight"><b class="big" style="font-size:22px">{st.pieces}</b><span class="xs muted">pièces achetées</span></div>
          <div class="card tight"><b class="big" style="font-size:22px">{duree}</b><span class="xs muted">durée</span></div>
          <div class="card tight"><b class="big" style="font-size:22px">{fmtE(so.transportCout || 0)}</b><span class="xs muted">transport</span></div>
        </div>
        <a class="btn primary big" href="#/stock/a_completer">Compléter les fiches à la maison</a>
      </main>
    );
  }

  const ventesBudget = Math.round((st.depense / Math.max(1, so.budget)) * 100);
  const suivant = lieux.find((l) => l.id !== lieuActuel?.id && (so.lieuxIds || []).indexOf(l.id) > (so.lieuxIds || []).indexOf(lieuActuel?.id));
  const plageSuivant = suivant ? plageOuverte(suivant, today) : null;

  return (
    <main class="page sortie-mode" style="padding-bottom:calc(28px + var(--safe-b))">
      <header class="row between">
        <div class="col">
          <span class="kicker" style="color:var(--accent)">Sortie · {duree}</span>
          <h1 class="big" style="font-size:20px">{lieuActuel ? lieuActuel.nom.split(' – ')[0].split(' (')[0] : 'Sortie'}</h1>
        </div>
        <button class="btn s ghost" onClick={() => setFin(true)}>Terminer</button>
      </header>

      {!store.status.online && (
        <span class="sync off" style="align-self:flex-start;font-size:13px"><IconHorsLigne size={16} />Hors ligne · tes achats restent sur le téléphone</span>
      )}

      {lieux.length > 1 && (
        <div class="chips" role="group" aria-label="Lieu actuel">
          {lieux.map((l) => (
            <button key={l.id} class="chip" style="font-size:14px" aria-pressed={lieuActuel?.id === l.id} onClick={() => store.patch('sorties', so.id, { lieuActuel: l.id })}>{l.nom.split(' – ')[0].split(' (')[0]}</button>
          ))}
        </div>
      )}

      <section class="card" aria-label="Budget restant" style="border-radius:28px;padding:20px">
        <span class="small strong muted">Budget restant</span>
        <span class="big" style={`font-size:60px;${st.budgetRestant <= 0 ? 'color:var(--red)' : ''}`}>{fmtE(st.budgetRestant)}</span>
        <span class="bar"><span style={`width:${Math.min(100, ventesBudget)}%`} /></span>
        <span class="small muted">{fmtE(st.depense)} dépensés sur {fmtE(so.budget)}</span>
      </section>

      <section class="card row between" aria-label="Pièces encore portables" style="border-radius:28px;padding:20px;flex-direction:row">
        <span class="col">
          <span class="small strong muted">Tu peux encore porter</span>
          <span class="small muted">{st.pieces} / {so.piecesMax} pièces</span>
        </span>
        <span class="row" style="align-items:baseline;gap:6px">
          <span class="big" style={`font-size:48px;${st.piecesRestantes <= 0 ? 'color:var(--red)' : ''}`}>{st.piecesRestantes}</span>
          <span class="strong">pièces</span>
        </span>
      </section>

      {st.budgetRestant <= 0 || st.piecesRestantes <= 0 ? (
        <div class="feu rouge">
          <span class="titre">{st.piecesRestantes <= 0 ? 'SACS PLEINS' : 'BUDGET ATTEINT'}</span>
          <span>Plus d’achat possible pour cette sortie. Rentre à la maison.</span>
        </div>
      ) : (
        <a class="btn primary big" style="min-height:72px;font-size:19px;box-shadow:0 0 0 3px var(--bg),0 0 0 5px var(--lilac)" href={`#/verifier?sortie=${so.id}`}>
          <IconLoupe size={24} />Vérifier une pièce
        </a>
      )}

      {st.articles.length > 0 && (
        <section class="col" style="gap:8px" aria-label="Achats de cette sortie">
          <h2 class="section-t">Achetés pendant cette sortie</h2>
          <div class="grid3">
            {st.articles
              .slice()
              .sort((a, b) => (b.achatAt || '').localeCompare(a.achatAt || ''))
              .map((a) => (
                <a key={a.id} class="col" href={`#/article/${a.id}`} style="text-decoration:none;color:inherit;gap:4px">
                  <span style="width:100%;aspect-ratio:1;display:block"><Vignette article={a} /></span>
                  <span class="xs strong ellipsis">{a.titre || a.marque || 'Pièce'}</span>
                  <span class="xs muted">{fmtE(a.cout)}{a.horsRegle ? ' · hors règle' : ''}</span>
                </a>
              ))}
          </div>
        </section>
      )}

      {suivant && (
        <div class="item" style="border:1px solid var(--line);background:transparent">
          <IconFleche size={20} />
          <span class="col grow">
            <span class="t">Ensuite : {suivant.nom.split(' – ')[0]}</span>
            <span class="st">{plageSuivant ? `Ouvert ${plageSuivant.debut}–${plageSuivant.fin}` : 'Horaires à vérifier'} · {suivant.acces?.minutes ?? '?'} min</span>
          </span>
        </div>
      )}

      {fin && <FinSortie so={so} lieux={lieux} st={st} onClose={() => setFin(false)} />}
    </main>
  );
}

function FinSortie({ so, lieux, st, onClose }) {
  const { store, s, toast } = useApp();
  const [transport, setTransport] = useState(String(coutTournee(lieux, s.transport)).replace('.', ','));
  const terminer = () => {
    const t = Number(String(transport).replace(',', '.')) || 0;
    store.patch('sorties', so.id, { statut: 'terminee', finAt: new Date().toISOString(), transportCout: t });
    toast(`Sortie terminée · ${st.pieces} pièce${st.pieces > 1 ? 's' : ''} pour ${fmtE(st.depense)}`);
    onClose();
  };
  return (
    <Feuille titre="Terminer la sortie" onClose={onClose}>
      <div class="grid2">
        <div class="stat"><b>{fmtE(st.depense)}</b><span>dépensés</span></div>
        <div class="stat"><b>{st.pieces}</b><span>pièces</span></div>
      </div>
      <Champ label="Transport payé aujourd’hui (aller-retour, €)">
        <input class="input" inputMode="decimal" value={transport} onInput={(e) => setTransport(e.currentTarget.value)} />
      </Champ>
      <button class="btn primary big" onClick={terminer}>Terminer et rentrer</button>
    </Feuille>
  );
}
