// Outils de dates en heure locale. Les jours sont des chaînes « AAAA-MM-JJ ».

const pad = (n) => String(n).padStart(2, '0');

export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function dayOfWeek(iso) {
  return parseISO(iso).getDay();
}

export function mondayOf(iso) {
  const dow = dayOfWeek(iso);
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, delta);
}

export function nextMonday(iso) {
  return addDays(mondayOf(iso), 7);
}

export function monthKey(iso) {
  return iso.slice(0, 7);
}

export function daysInMonth(iso) {
  const d = parseISO(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function dayOfMonth(iso) {
  return Number(iso.slice(8, 10));
}

// 1 = premier jour de ce type dans le mois, 2 = deuxième…
export function nthInMonth(iso) {
  return Math.floor((dayOfMonth(iso) - 1) / 7) + 1;
}

export function diffDays(isoA, isoB) {
  return Math.round((parseISO(isoB) - parseISO(isoA)) / 86400000);
}

export function minutesOf(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function hhmm(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function nowMinutes(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

// Pâques (algorithme grégorien anonyme)
function paques(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(new Date(y, month - 1, day));
}

const ferieCache = new Map();
export function joursFeries(y) {
  if (ferieCache.has(y)) return ferieCache.get(y);
  const p = paques(y);
  const set = new Set([
    `${y}-01-01`, `${y}-05-01`, `${y}-05-08`, `${y}-07-14`, `${y}-08-15`,
    `${y}-11-01`, `${y}-11-11`, `${y}-12-25`,
    addDays(p, 1), addDays(p, 39), addDays(p, 50)
  ]);
  ferieCache.set(y, set);
  return set;
}

export function estOuvre(iso) {
  const dow = dayOfWeek(iso);
  if (dow === 0 || dow === 6) return false;
  return !joursFeries(Number(iso.slice(0, 4))).has(iso);
}

// Date limite = fin du n-ième jour ouvré après le jour de départ.
export function ajouterJoursOuvres(iso, n) {
  let d = iso;
  let count = 0;
  while (count < n) {
    d = addDays(d, 1);
    if (estOuvre(d)) count++;
  }
  return d;
}

// Jours ouvrés restants avant la date limite (0 = c'est aujourd'hui le dernier jour).
export function joursOuvresRestants(aujourdhui, limite) {
  if (aujourdhui > limite) return -1;
  let d = aujourdhui;
  let count = 0;
  while (d < limite) {
    d = addDays(d, 1);
    if (estOuvre(d)) count++;
  }
  return count;
}

const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function jourCourt(iso) {
  return JOURS_COURTS[dayOfWeek(iso)];
}
export function jourLong(iso) {
  return JOURS_LONGS[dayOfWeek(iso)];
}
export function fmtCourt(iso) {
  const d = parseISO(iso);
  return `${JOURS_COURTS[d.getDay()]} ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}
export function fmtLong(iso) {
  const d = parseISO(iso);
  const j = JOURS_LONGS[d.getDay()];
  return `${j.charAt(0).toUpperCase() + j.slice(1)} ${d.getDate()} ${MOIS_LONGS[d.getMonth()]}`;
}
export function nomMois(iso) {
  const m = MOIS_LONGS[parseISO(iso).getMonth()];
  return m.charAt(0).toUpperCase() + m.slice(1);
}
export function fmtHeure(isoDateTime) {
  const d = new Date(isoDateTime);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
