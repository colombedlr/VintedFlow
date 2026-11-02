// Planification : lieux ouverts, semaine proposée, tournées, journée type.
import { addDays, dayOfWeek, nthInMonth, minutesOf, hhmm, nowMinutes, mondayOf } from './dates.js';
import { liste, sortiesDeLaSemaine, compteParStatut, envoisAFaire, settingsEffectifs, settingsDe } from './calc.js';

export function plageOuverte(lieu, iso) {
  const dow = dayOfWeek(iso);
  for (const o of lieu.ouverture || []) {
    if (o.date) {
      if (o.date === iso) return o;
      continue;
    }
    if (!o.jours?.includes(dow)) continue;
    if (o.semaines && o.semaines.length && !o.semaines.includes(nthInMonth(iso))) continue;
    return o;
  }
  return null;
}

export function lieuxOuverts(state, iso) {
  return liste(state.lieux)
    .filter((l) => l.actif !== false)
    .map((l) => ({ lieu: l, plage: plageOuverte(l, iso) }))
    .filter((x) => x.plage);
}

// Coût aller-retour selon le mode d'accès.
export function coutTrajet(acces, transport) {
  if (!acces) return 0;
  const t = transport || {};
  switch (acces.mode) {
    case 'tram':
    case 'metro':
    case 'bus':
      return 2 * (t.ticket ?? 2);
    case 'voi': {
      const min = acces.minutes || 0;
      const sup = Math.max(0, min - (t.voiMinutesGratuites ?? 20));
      return 2 * ((t.voiDeblocage ?? 1.5) + sup * (t.voiMinute ?? 0.35));
    }
    default:
      return 0;
  }
}

// Coût d'une tournée : on paie l'aller vers le premier lieu et le retour du dernier.
export function coutTournee(lieux, transport) {
  if (!lieux.length) return 0;
  const aller = coutTrajet(lieux[0].acces, transport) / 2;
  const retour = coutTrajet(lieux[lieux.length - 1].acces, transport) / 2;
  let entre = 0;
  for (let i = 1; i < lieux.length; i++) {
    if (lieux[i].acces?.ligne !== lieux[i - 1].acces?.ligne) entre += coutTrajet(lieux[i].acces, transport) / 2;
  }
  return Math.round((aller + retour + entre) * 100) / 100;
}

const POIDS_TYPE = { puces: 5, 'vide-grenier': 5, braderie: 5, brocante: 4, ressourcerie: 4, emmaus: 3, solidaire: 3, 'friperie-kilo': 3, friperie: 2, 'depot-vente': 2, autre: 1 };

function scoreLieu(state, lieu) {
  const arts = liste(state.articles).filter((a) => a.lieuId === lieu.id);
  const vendus = arts.filter((a) => a.prixVente).length;
  return (POIDS_TYPE[lieu.type] || 1) * 10 + vendus * 2 - (lieu.acces?.minutes || 30) / 10;
}

// Regroupe les lieux ouverts un jour donné par ligne d'accès pour former des tournées.
export function tourneesDuJour(state, iso, max = 3) {
  const ouverts = lieuxOuverts(state, iso);
  const parLigne = {};
  for (const x of ouverts) {
    const ligne = (x.lieu.acces?.ligne || '').trim();
    const generique = !ligne || ['bus', 'à pied', 'a pied', 'voi', 'autre'].includes(ligne.toLowerCase());
    const k = generique ? `seul:${x.lieu.id}` : ligne;
    (parLigne[k] ||= []).push(x);
  }
  return Object.entries(parLigne)
    .map(([ligne, xs]) => {
      const tri = xs.sort((a, b) => scoreLieu(state, b.lieu) - scoreLieu(state, a.lieu)).slice(0, max);
      const lieux = tri.map((x) => x.lieu);
      return {
        ligne: ligne.startsWith('seul:') ? lieux[0]?.acces?.ligne || '' : ligne,
        lieux,
        debut: tri.map((x) => x.lieu.heureIdeale || x.plage.debut).sort()[0],
        score: tri.reduce((t, x) => t + scoreLieu(state, x.lieu), 0)
      };
    })
    .sort((a, b) => b.score - a.score);
}

const arrondi5 = (n) => Math.max(5, Math.round(n / 5) * 5);

// Routine : vide-greniers et puces le week-end tôt, ressourceries en semaine l'après-midi.
export function proposerSemaine(state, lundi, eff) {
  const max = eff.discipline.sortiesMaxSemaine;
  const candidats = [];
  const jours = [5, 6, 2, 4, 1, 3, 0].map((offset) => addDays(lundi, offset)); // sam, dim, mer, ven, mar, jeu, lun
  for (const iso of jours) {
    const dow = dayOfWeek(iso);
    const weekend = dow === 0 || dow === 6;
    const tournees = tourneesDuJour(state, iso).filter((t) =>
      weekend
        ? t.lieux.some((l) => ['puces', 'vide-grenier', 'brocante', 'braderie'].includes(l.type))
        : t.lieux.some((l) => ['ressourcerie', 'emmaus', 'solidaire', 'friperie', 'friperie-kilo', 'depot-vente'].includes(l.type))
    );
    if (!tournees.length) continue;
    const t = tournees[0];
    candidats.push({
      date: iso,
      heure: weekend ? t.debut || '07:00' : '14:00',
      lieuxIds: t.lieux.map((l) => l.id),
      poids: weekend ? 1.5 : 1,
      weekend
    });
  }
  // Priorité au week-end, puis aux meilleurs jours de semaine.
  const choisis = [];
  for (const c of candidats.filter((c) => c.weekend)) if (choisis.length < max) choisis.push(c);
  for (const c of candidats.filter((c) => !c.weekend)) if (choisis.length < max) choisis.push(c);
  choisis.sort((a, b) => a.date.localeCompare(b.date));
  const totalPoids = choisis.reduce((t, c) => t + c.poids, 0) || 1;
  const budget = eff.discipline.budgetHebdo;
  let reste = budget;
  return choisis.map((c, i) => {
    const b = i === choisis.length - 1 ? reste : Math.min(reste, arrondi5((budget * c.poids) / totalPoids));
    reste -= b;
    const lieux = c.lieuxIds.map((id) => state.lieux[id]).filter(Boolean);
    return {
      date: c.date,
      heure: c.heure,
      lieuxIds: c.lieuxIds,
      budget: b,
      piecesMax: eff.discipline.piecesMax,
      transportPrevu: coutTournee(lieux, eff.transport)
    };
  });
}

export function heureDepart(state, sortie) {
  const premier = state.lieux[(sortie.lieuxIds || [])[0]];
  const arrivee = minutesOf(sortie.heure || premier?.heureIdeale || '09:00');
  return hhmm(arrivee - (premier?.acces?.minutes || 20) - 5);
}

const TITRES = {
  sourcing: 'Sourcing',
  preparation: 'Préparation',
  photos: 'Photos',
  annonces: 'Annonces',
  envois: 'Envois'
};

// Blocs de la journée, avec ce qu'il y a concrètement à faire dans chacun.
export function journee(state, iso, maintenantMin = nowMinutes()) {
  const s = settingsEffectifs(settingsDe(state), iso);
  const dow = dayOfWeek(iso);
  const weekend = dow === 0 || dow === 6;
  const modele = (weekend ? s.journee.weekend : s.journee.semaine).map((b) => ({ ...b }));
  const sorties = sortiesDeLaSemaine(state, mondayOf(iso)).filter((so) => so.date === iso && so.statut !== 'annulee');
  const counts = compteParStatut(state);
  const envois = envoisAFaire(state, iso);
  const blocs = [];

  for (const b of modele) {
    if (b.type === 'sourcing') {
      if (!sorties.length) continue;
      for (const so of sorties) {
        const lieux = (so.lieuxIds || []).map((id) => state.lieux[id]).filter(Boolean);
        const depart = heureDepart(state, so);
        blocs.push({
          type: 'sourcing',
          titre: lieux.map((l) => l.nom.split(' – ')[0]).join(' → ') || 'Sortie',
          sousTitre: `Départ ${depart} · ${so.budget} € · ${so.piecesMax} pièces max`,
          debut: depart,
          fin: b.fin,
          sortieId: so.id,
          fait: so.statut === 'terminee'
        });
      }
      continue;
    }
    if (b.type === 'envois') {
      if (!envois.length) continue;
      const urgent = envois.filter((e) => e.restants != null && e.restants <= 1).length;
      blocs.push({
        type: 'envois',
        titre: `Envois · ${envois.length} colis`,
        sousTitre: urgent ? `${urgent} à envoyer avant demain soir` : 'Un seul passage au point relais',
        debut: b.debut,
        fin: b.fin,
        urgent: urgent > 0
      });
      continue;
    }
    if (b.type === 'preparation') {
      const nPrep = (counts.a_completer || 0) + (counts.a_preparer || 0);
      const nPhoto = counts.a_photographier || 0;
      if (nPhoto >= nPrep && nPhoto > 0) {
        blocs.push({ type: 'photos', titre: `Photographier ${nPhoto} article${nPhoto > 1 ? 's' : ''}`, sousTitre: 'Lot « à photographier »', debut: b.debut, fin: b.fin, statut: 'a_photographier' });
      } else if (nPrep > 0) {
        blocs.push({ type: 'preparation', titre: `Préparer ${nPrep} article${nPrep > 1 ? 's' : ''}`, sousTitre: 'Compléter, laver, détacher, ranger au bac', debut: b.debut, fin: b.fin, statut: counts.a_completer ? 'a_completer' : 'a_preparer' });
      } else if (nPhoto === 0) {
        continue;
      }
      continue;
    }
    if (b.type === 'annonces') {
      const n = counts.a_mettre_en_ligne || 0;
      if (!n) continue;
      blocs.push({ type: 'annonces', titre: `Annonces · ${n} à mettre en ligne`, sousTitre: 'Sur le Mac, c’est plus rapide', debut: b.debut, fin: b.fin, statut: 'a_mettre_en_ligne' });
      continue;
    }
    blocs.push({ type: b.type, titre: TITRES[b.type] || b.type, sousTitre: '', debut: b.debut, fin: b.fin });
  }
  blocs.sort((a, b) => a.debut.localeCompare(b.debut));

  // Bloc courant : celui en cours, sinon le prochain non fait.
  let courant = blocs.find((b) => !b.fait && minutesOf(b.debut) <= maintenantMin && maintenantMin < minutesOf(b.fin));
  if (!courant) courant = blocs.find((b) => !b.fait && minutesOf(b.debut) > maintenantMin) || null;
  return { blocs, courant, weekend };
}

export function accesTexte(acces) {
  if (!acces) return '';
  const modes = { pied: 'À pied', voi: 'Voi', tram: 'Tram', bus: 'Bus', metro: 'Métro' };
  const m = modes[acces.mode] || '';
  const l = (acces.ligne || '').trim();
  if (!l || l.toLowerCase() === m.toLowerCase()) return m;
  if (/^(T|M)\d/.test(l) || l.includes('+')) return l;
  return `${m} ${l}`;
}

// Répartit le budget de la semaine entre les sorties encore à venir (week-end × 1,5).
// Les sorties en cours ou terminées gardent leur budget ; une sortie annulée après verrouillage aussi.
export function repartitionBudget(state, lundi, eff, aujourdhui) {
  const dimanche = addDays(lundi, 6);
  const sorties = Object.values(state.sorties || {}).filter((so) => so.date >= lundi && so.date <= dimanche);
  const budgetSemaine = state.semaines?.[lundi]?.budget ?? eff.discipline.budgetHebdo;
  const fixes = sorties.filter((so) => (so.statut !== 'prevue' && so.statut !== 'annulee') || (so.statut === 'prevue' && so.date < aujourdhui) || (so.statut === 'annulee' && so.budgetPerdu));
  const modifiables = sorties.filter((so) => so.statut === 'prevue' && so.date >= aujourdhui).sort((a, b) => a.date.localeCompare(b.date));
  let reste = Math.max(0, budgetSemaine - fixes.reduce((t, so) => t + (so.budget || 0), 0));
  const poids = (so) => ([0, 6].includes(dayOfWeek(so.date)) ? 1.5 : 1);
  const total = modifiables.reduce((t, so) => t + poids(so), 0) || 1;
  const base = reste;
  return modifiables.map((so, i) => {
    const b = i === modifiables.length - 1 ? reste : Math.min(reste, Math.max(5, Math.round((base * poids(so)) / total / 5) * 5));
    reste -= b;
    return { id: so.id, budget: Math.max(0, b) };
  });
}
