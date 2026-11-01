// To-do perso et pro, ajustées au temps disponible de la journée.
import { dayOfWeek, minutesOf, addDays } from './dates.js';

export const TEMPS_DEFAUT = {
  pro: { semaine: 420, weekend: 360 }, // minutes de travail par jour
  perso: { semaine: 150, weekend: 240 } // minutes pour la vie perso (hors sommeil, repas)
};

export const tempsDe = (s) => ({ ...TEMPS_DEFAUT, ...(s?.temps || {}) });

const liste = (map) => Object.values(map || {}).filter(Boolean);

// Une tâche récurrente est « faite » jour par jour ; une tâche simple une fois pour toutes.
export function estFaite(t, iso) {
  return t.jours?.length ? !!t.faitLe?.[iso] : !!t.fait;
}

export function prevueLe(t, iso) {
  if (t.jours?.length) return t.jours.includes(dayOfWeek(iso)) && (!t.debut || t.debut <= iso);
  return t.date === iso;
}

export function tachesDuJour(state, iso) {
  return liste(state.taches)
    .filter((t) => prevueLe(t, iso))
    .sort((a, b) => (estFaite(a, iso) - estFaite(b, iso)) || ((b.importante ? 1 : 0) - (a.importante ? 1 : 0)) || (a.heure || '99').localeCompare(b.heure || '99'));
}

export function tachesEnRetard(state, iso) {
  return liste(state.taches)
    .filter((t) => !t.jours?.length && !t.fait && t.date && t.date < iso)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Temps pro déjà pris par les blocs de la journée type (sourcing, photos, envois…).
export function minutesBlocs(blocs) {
  return blocs.reduce((t, b) => t + Math.max(0, minutesOf(b.fin) - minutesOf(b.debut)), 0);
}

/**
 * Charge de la journée : temps prévu par les tâches face au temps disponible.
 * Les tâches pro se placent dans le temps pro qui reste une fois les blocs comptés.
 */
export function chargeDuJour(state, s, iso, blocs) {
  const weekend = [0, 6].includes(dayOfWeek(iso));
  const temps = tempsDe(s);
  const proTotal = weekend ? temps.pro.weekend : temps.pro.semaine;
  const persoTotal = weekend ? temps.perso.weekend : temps.perso.semaine;
  const proBlocs = Math.min(proTotal, minutesBlocs(blocs));
  const taches = tachesDuJour(state, iso);
  const restantes = taches.filter((t) => !estFaite(t, iso));
  const somme = (type) => restantes.filter((t) => t.type === type).reduce((x, t) => x + (Number(t.duree) || 15), 0);
  const pro = { prevu: somme('pro'), dispo: Math.max(0, proTotal - proBlocs), blocs: proBlocs, total: proTotal };
  const perso = { prevu: somme('perso'), dispo: persoTotal, total: persoTotal };
  // Ce qui dépasse : on propose de reporter les tâches les moins importantes, les plus longues d'abord.
  const aReporter = [];
  for (const [type, c] of [['pro', pro], ['perso', perso]]) {
    let exces = c.prevu - c.dispo;
    const candidates = restantes
      .filter((t) => t.type === type && !t.importante && !t.heure && !t.jours?.length)
      .sort((a, b) => (Number(b.duree) || 15) - (Number(a.duree) || 15));
    for (const t of candidates) {
      if (exces <= 0) break;
      aReporter.push(t);
      exces -= Number(t.duree) || 15;
    }
  }
  return { pro, perso, taches, aReporter, surcharge: pro.prevu > pro.dispo || perso.prevu > perso.dispo };
}

export function lendemainOuvre(iso) {
  return addDays(iso, 1);
}

export function fmtDuree(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}
