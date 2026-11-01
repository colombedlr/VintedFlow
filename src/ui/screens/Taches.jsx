import { useState } from 'preact/hooks';
import { useApp, aller, Feuille, Champ, IconRetour, IconCheck, IconHorloge } from '../base.jsx';
import { addDays, fmtCourt, fmtLong, nowMinutes, minutesOf } from '../../logic/dates.js';
import { journee } from '../../logic/planning.js';
import { chargeDuJour, tachesEnRetard, estFaite, fmtDuree } from '../../logic/taches.js';

const JOURS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim']];
const DUREES = [10, 15, 30, 45, 60, 90, 120];

export function basculerTache(store, t, iso) {
  if (t.jours?.length) store.patch('taches', t.id, { faitLe: { [iso]: !t.faitLe?.[iso] } });
  else store.patch('taches', t.id, { fait: !t.fait, faitAt: t.fait ? null : new Date().toISOString() });
}

export function Jauge({ label, prevu, dispo, note }) {
  const pct = dispo > 0 ? Math.min(100, Math.round((prevu / dispo) * 100)) : prevu > 0 ? 100 : 0;
  const trop = prevu > dispo;
  return (
    <div class="col" style="gap:6px">
      <div class="row between">
        <span class="small strong">{label}</span>
        <span class="small" style={trop ? 'color:var(--red-ink);font-weight:700' : 'color:var(--muted)'}>
          {fmtDuree(prevu)} prévues sur {fmtDuree(dispo)}
        </span>
      </div>
      <span class="bar"><span style={`width:${pct}%;background:${trop ? 'var(--red)' : 'var(--accent)'}`} /></span>
      {note && <span class="xs muted">{note}</span>}
    </div>
  );
}

export function LigneTache({ t, iso, onEdit }) {
  const { store } = useApp();
  const fait = estFaite(t, iso);
  return (
    <div class="item" style={`min-height:56px;${fait ? 'opacity:.55' : ''}`}>
      <button
        aria-label={fait ? `Marquer « ${t.titre} » comme à faire` : `Marquer « ${t.titre} » comme faite`}
        aria-pressed={fait}
        onClick={() => basculerTache(store, t, iso)}
        style={`width:32px;height:32px;border-radius:16px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;border:2px solid ${fait ? 'var(--green)' : 'var(--muted)'};background:${fait ? 'var(--green)' : 'transparent'};color:var(--on-green)`}
      >
        {fait && <IconCheck size={18} />}
      </button>
      <button class="col grow" style="background:none;border:0;padding:0;text-align:left;cursor:pointer;color:inherit" onClick={() => onEdit(t)}>
        <span class="t" style={fait ? 'text-decoration:line-through' : ''}>{t.importante ? '! ' : ''}{t.titre}</span>
        <span class="st">
          {[t.heure, fmtDuree(Number(t.duree) || 15), t.jours?.length === 7 ? 'tous les jours' : t.jours?.length ? 'chaque ' + JOURS.filter(([d]) => t.jours.includes(d)).map(([, l]) => l.toLowerCase()).join(', ') : null].filter(Boolean).join(' · ')}
        </span>
      </button>
      <span class={'pill ' + (t.type === 'pro' ? 'accent' : 'green')}>{t.type === 'pro' ? 'Pro' : 'Perso'}</span>
    </div>
  );
}

export function Taches() {
  const { state, store, s, today, now, route, toast } = useApp();
  const [jourOffset, setJourOffset] = useState(Number(route.params.j || 0));
  const [edition, setEdition] = useState(null);
  const iso = addDays(today, jourOffset);
  const { blocs } = journee(state, iso, jourOffset === 0 ? nowMinutes(now) : 0);
  const c = chargeDuJour(state, s, iso, blocs);
  const retard = tachesEnRetard(state, today);
  const pro = c.taches.filter((t) => t.type === 'pro');
  const perso = c.taches.filter((t) => t.type === 'perso');

  const reporter = (ts) => {
    for (const t of ts) store.patch('taches', t.id, { date: addDays(iso, 1) });
    toast(`${ts.length} tâche${ts.length > 1 ? 's' : ''} reportée${ts.length > 1 ? 's' : ''} au ${fmtCourt(addDays(iso, 1))}.`);
  };

  return (
    <main class="page">
      <a class="retour" href="#/"><IconRetour size={20} />Aujourd’hui</a>
      <header class="top">
        <div class="col"><span class="sur">{fmtLong(iso)}</span><h1>Tâches</h1></div>
        <button class="btn s primary" onClick={() => setEdition({ type: 'pro', date: iso, duree: 30 })}>+ Tâche</button>
      </header>

      <div class="chips" role="group" aria-label="Jour">
        {[0, 1, 2, 3, 4, 5, 6].map((o) => (
          <button key={o} class="chip" style="font-size:14px" aria-pressed={jourOffset === o} onClick={() => setJourOffset(o)}>
            {o === 0 ? 'Aujourd’hui' : o === 1 ? 'Demain' : fmtCourt(addDays(today, o)).split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      {jourOffset === 0 && retard.length > 0 && (
        <section class="card danger">
          <span class="strong">{retard.length} tâche{retard.length > 1 ? 's' : ''} en retard</span>
          {retard.map((t) => (
            <div key={t.id} class="row between">
              <span class="small grow ellipsis">{t.titre} · prévue le {fmtCourt(t.date)}</span>
              <button class="btn s ghost" onClick={() => store.patch('taches', t.id, { date: today })}>Aujourd’hui</button>
            </div>
          ))}
        </section>
      )}

      <section class="card" aria-label="Temps de la journée">
        <Jauge label="Temps pro" prevu={c.pro.prevu} dispo={c.pro.dispo} note={`${fmtDuree(c.pro.total)} de travail, dont ${fmtDuree(c.pro.blocs)} déjà pris par la journée type (sourcing, photos, envois…).`} />
        <Jauge label="Temps perso" prevu={c.perso.prevu} dispo={c.perso.dispo} />
        {c.surcharge && (
          <div class="card warn tight">
            <span class="strong">Journée trop chargée</span>
            {c.aReporter.length > 0 ? (
              <>
                <span class="small">Reporte au lendemain : {c.aReporter.map((t) => t.titre).join(', ')}.</span>
                <button class="btn s dark" onClick={() => reporter(c.aReporter)}>Reporter au {fmtCourt(addDays(iso, 1))}</button>
              </>
            ) : (
              <span class="small">Tout ce qui reste est important ou à heure fixe : allège ta journée type ou décale une tâche à la main.</span>
            )}
          </div>
        )}
      </section>

      <h2 class="section-t">Pro</h2>
      {pro.length === 0 && <p class="small muted" style="padding:0 4px">Aucune tâche pro ce jour-là en plus de la journée type.</p>}
      {pro.map((t) => <LigneTache key={t.id} t={t} iso={iso} onEdit={setEdition} />)}

      <h2 class="section-t">Perso</h2>
      {perso.length === 0 && <p class="small muted" style="padding:0 4px">Rien de prévu côté perso.</p>}
      {perso.map((t) => <LigneTache key={t.id} t={t} iso={iso} onEdit={setEdition} />)}

      <p class="xs muted" style="text-align:center">Le temps disponible se règle dans Réglages → Temps pro et perso.</p>
      {edition && <EditionTache init={edition} onClose={() => setEdition(null)} />}
    </main>
  );
}

export function EditionTache({ init, onClose }) {
  const { store, today, toast, confirmer } = useApp();
  const [f, setF] = useState({
    titre: init.titre || '',
    type: init.type || 'pro',
    date: init.date || today,
    heure: init.heure || '',
    duree: init.duree ?? 30,
    importante: !!init.importante,
    jours: init.jours || [],
    recurrente: !!init.jours?.length
  });
  const enregistrer = () => {
    if (!f.titre.trim()) return toast('Donne un nom à la tâche.');
    if (f.recurrente && !f.jours.length) return toast('Choisis au moins un jour.');
    const data = {
      titre: f.titre.trim(),
      type: f.type,
      duree: Number(f.duree) || 15,
      heure: f.heure || null,
      importante: f.importante,
      date: f.recurrente ? null : f.date,
      jours: f.recurrente ? f.jours : [],
      debut: f.recurrente ? init.debut || today : null
    };
    if (init.id) store.patch('taches', init.id, data);
    else store.put('taches', { ...data, fait: false, faitLe: {} });
    onClose();
  };
  return (
    <Feuille titre={init.id ? 'Tâche' : 'Nouvelle tâche'} onClose={onClose}>
      <Champ label="À faire"><input class="input" value={f.titre} placeholder="Acheter des sacs d’envoi, appeler la CAF…" onInput={(e) => setF({ ...f, titre: e.currentTarget.value })} /></Champ>
      <div class="chips" role="group" aria-label="Type">
        <button class="chip" aria-pressed={f.type === 'pro'} onClick={() => setF({ ...f, type: 'pro' })}>Pro</button>
        <button class="chip" aria-pressed={f.type === 'perso'} onClick={() => setF({ ...f, type: 'perso' })}>Perso</button>
        <button class="chip" aria-pressed={f.importante} onClick={() => setF({ ...f, importante: !f.importante })}>Importante</button>
      </div>
      <div class="col" style="gap:6px">
        <span class="small strong muted">Durée</span>
        <div class="chips">{DUREES.map((d) => <button key={d} class="chip" style="font-size:14px" aria-pressed={Number(f.duree) === d} onClick={() => setF({ ...f, duree: d })}>{fmtDuree(d)}</button>)}</div>
      </div>
      <div class="chips" role="group" aria-label="Quand">
        <button class="chip" aria-pressed={!f.recurrente} onClick={() => setF({ ...f, recurrente: false })}>Une fois</button>
        <button class="chip" aria-pressed={f.recurrente} onClick={() => setF({ ...f, recurrente: true })}>Chaque semaine</button>
      </div>
      {f.recurrente ? (
        <div class="chips">{JOURS.map(([d, l]) => <button key={d} class="chip" style="min-width:52px" aria-pressed={f.jours.includes(d)} onClick={() => setF({ ...f, jours: f.jours.includes(d) ? f.jours.filter((x) => x !== d) : [...f.jours, d] })}>{l}</button>)}</div>
      ) : (
        <Champ label="Jour"><input class="input" type="date" value={f.date} min={today} onInput={(e) => setF({ ...f, date: e.currentTarget.value })} /></Champ>
      )}
      <Champ label="Heure fixe (facultatif)"><input class="input" type="time" value={f.heure} onInput={(e) => setF({ ...f, heure: e.currentTarget.value })} /></Champ>
      <div class="btns">
        <button class="btn primary" onClick={enregistrer}>Enregistrer</button>
        {init.id && (
          <button class="btn s danger" onClick={async () => { if (await confirmer('Supprimer cette tâche ?')) { store.remove('taches', init.id); onClose(); } }}>Supprimer</button>
        )}
      </div>
    </Feuille>
  );
}

// Bloc compact pour l'écran Aujourd'hui.
export function TachesAujourdhui({ blocs }) {
  const { state, s, today, now } = useApp();
  const [edition, setEdition] = useState(null);
  const c = chargeDuJour(state, s, today, blocs);
  const retard = tachesEnRetard(state, today);
  const restantes = c.taches.filter((t) => !estFaite(t, today));
  const faites = c.taches.length - restantes.length;
  const nowMin = nowMinutes(now);
  const prochaineAHeure = restantes.filter((t) => t.heure && minutesOf(t.heure) >= nowMin - 15).sort((a, b) => a.heure.localeCompare(b.heure))[0];
  return (
    <section class="col" style="gap:8px" aria-label="Tâches du jour">
      <div class="row between">
        <h3 class="section-t">À faire aujourd’hui · {faites}/{c.taches.length}</h3>
        <a class="small strong" href="#/taches" style="padding:6px 4px">Tout voir</a>
      </div>
      {retard.length > 0 && (
        <a class="card danger tight" href="#/taches" style="text-decoration:none">
          <span class="strong">{retard.length} tâche{retard.length > 1 ? 's' : ''} en retard</span>
        </a>
      )}
      {prochaineAHeure && (
        <div class="card soft tight row" style="flex-direction:row">
          <IconHorloge size={20} />
          <span class="small strong grow">{prochaineAHeure.heure} · {prochaineAHeure.titre}</span>
        </div>
      )}
      {restantes.slice(0, 5).map((t) => <LigneTache key={t.id} t={t} iso={today} onEdit={setEdition} />)}
      {restantes.length > 5 && <a class="small strong" href="#/taches" style="padding:0 4px">+ {restantes.length - 5} autres</a>}
      {c.taches.length === 0 && (
        <button class="item" onClick={() => setEdition({ type: 'pro', date: today, duree: 30 })}>
          <span class="col grow"><span class="t">Ajouter une tâche perso ou pro</span><span class="st">L’app vérifie qu’elle tient dans ta journée</span></span>
        </button>
      )}
      {c.taches.length > 0 && (
        <div class="card tight">
          <Jauge label="Pro" prevu={c.pro.prevu} dispo={c.pro.dispo} />
          <Jauge label="Perso" prevu={c.perso.prevu} dispo={c.perso.dispo} />
          {c.surcharge && <a class="small strong" href="#/taches" style="color:var(--red-ink)">Journée trop chargée : voir quoi reporter</a>}
        </div>
      )}
      {edition && <EditionTache init={edition} onClose={() => setEdition(null)} />}
    </section>
  );
}
