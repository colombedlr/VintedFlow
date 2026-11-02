// Distances, temps de trajet estimés, ouverture « maintenant », ordre de tournée, horaires OSM.
import { dayOfWeek, nthInMonth, minutesOf, addDays } from './dates.js';

export const TYPES_PERMANENTS = ['ressourcerie', 'emmaus', 'solidaire', 'friperie', 'friperie-kilo', 'depot-vente', 'puces', 'autre'];
export const TYPES_EVENEMENTS = ['brocante', 'vide-grenier', 'braderie'];
export const estEvenement = (type) => TYPES_EVENEMENTS.includes(type);

// Couleurs des épingles par type (+ une lettre pour ne pas dépendre de la couleur seule).
export const EPINGLES = {
  ressourcerie: { c: '#2563eb', l: 'R' },
  emmaus: { c: '#0f766e', l: 'E' },
  solidaire: { c: '#0891b2', l: 'S' },
  friperie: { c: '#7c3aed', l: 'F' },
  'friperie-kilo': { c: '#a21caf', l: 'K' },
  'depot-vente': { c: '#db2777', l: 'D' },
  puces: { c: '#ea580c', l: 'P' },
  brocante: { c: '#ca8a04', l: 'B' },
  'vide-grenier': { c: '#b45309', l: 'V' },
  braderie: { c: '#a16207', l: 'b' },
  autre: { c: '#52525b', l: '?' }
};

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;

export function distanceKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Estimations : on allonge la ligne droite de 30 % pour tenir compte des rues.
const DETOUR = 1.3;
export const VITESSES = { pied: 4.5, velo: 14 };
export const minutesPour = (km, mode) => (km == null ? null : Math.round(((km * DETOUR) / VITESSES[mode]) * 60));
export const kmPourMinutes = (min, mode) => (min * VITESSES[mode]) / 60 / DETOUR;

export function fmtKm(km) {
  if (km == null) return '–';
  return km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

// Toutes les plages d'un lieu pour un jour donné.
export function plagesDuJour(lieu, iso) {
  const dow = dayOfWeek(iso);
  return (lieu.ouverture || []).filter((o) => {
    if (o.date) return o.date === iso;
    if (!o.jours?.includes(dow)) return false;
    if (o.semaines?.length && !o.semaines.includes(nthInMonth(iso))) return false;
    return true;
  });
}

export function ouvertMaintenant(lieu, iso, minutes) {
  return plagesDuJour(lieu, iso).some((o) => minutesOf(o.debut || '00:00') <= minutes && minutes < minutesOf(o.fin || '23:59'));
}

export function ouvertLe(lieu, iso) {
  return plagesDuJour(lieu, iso).length > 0;
}

// Prochaine date d'un événement dans une fenêtre de jours.
export function prochaineDate(lieu, debut, nbJours) {
  for (let i = 0; i < nbJours; i++) {
    const d = addDays(debut, i);
    if (ouvertLe(lieu, d)) return d;
  }
  return null;
}

// Ordre de tournée : plus proche voisin depuis le départ, puis amélioration 2-opt.
export function ordreTournee(depart, lieux) {
  const pts = lieux.filter((l) => l.lat != null);
  const sans = lieux.filter((l) => l.lat == null);
  if (pts.length < 2) return [...pts, ...sans];
  const reste = [...pts];
  const ordre = [];
  let cur = depart || reste[0];
  while (reste.length) {
    let best = 0;
    for (let i = 1; i < reste.length; i++) if (distanceKm(cur, reste[i]) < distanceKm(cur, reste[best])) best = i;
    cur = reste.splice(best, 1)[0];
    ordre.push(cur);
  }
  const longueur = (o) => o.reduce((t, p, i) => t + distanceKm(i ? o[i - 1] : depart || o[0], p), 0);
  let ameliore = true;
  while (ameliore) {
    ameliore = false;
    for (let i = 0; i < ordre.length - 1; i++) {
      for (let j = i + 1; j < ordre.length; j++) {
        const essai = [...ordre.slice(0, i), ...ordre.slice(i, j + 1).reverse(), ...ordre.slice(j + 1)];
        if (longueur(essai) + 1e-9 < longueur(ordre)) {
          ordre.splice(0, ordre.length, ...essai);
          ameliore = true;
        }
      }
    }
  }
  return [...ordre, ...sans];
}

// Accès estimé depuis le domicile pour un lieu trouvé sur la carte.
export function accesEstime(domicile, point) {
  const km = distanceKm(domicile, point);
  if (km == null) return { mode: 'tram', ligne: '', minutes: 30, detail: 'À préciser' };
  if (km <= 1.5) return { mode: 'pied', ligne: 'À pied', minutes: minutesPour(km, 'pied'), detail: 'À pied (estimé)' };
  if (km <= 5) return { mode: 'voi', ligne: 'Voi', minutes: minutesPour(km, 'velo'), detail: 'Voi (estimé)' };
  return { mode: 'tram', ligne: '', minutes: Math.round(minutesPour(km, 'velo') * 1.6), detail: 'Transports, ligne à préciser' };
}

// ---------- Horaires OpenStreetMap (formats courants) ----------

const JOURS_OSM = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
const ORDRE = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function joursDe(spec) {
  const out = new Set();
  for (const part of spec.split(',')) {
    const p = part.trim();
    const m = p.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    if (!m[2]) out.add(JOURS_OSM[m[1]]);
    else {
      let i = ORDRE.indexOf(m[1]);
      const fin = ORDRE.indexOf(m[2]);
      for (let k = 0; k < 7; k++) {
        out.add(JOURS_OSM[ORDRE[i]]);
        if (i === fin) break;
        i = (i + 1) % 7;
      }
    }
  }
  return [...out];
}

// Convertit « Mo-Fr 10:00-12:30,14:00-18:00; Sa 10:00-18:00; PH off » en plages VintedFlow.
// Renvoie null si le format n'est pas reconnu (on garde alors le texte brut).
export function lireHorairesOSM(txt) {
  if (!txt) return null;
  const t = txt.trim();
  if (t === '24/7') return [{ jours: [0, 1, 2, 3, 4, 5, 6], debut: '00:00', fin: '23:59' }];
  const plages = [];
  for (const regle of t.split(';')) {
    const r = regle.trim();
    if (!r || /^PH\b/.test(r)) continue;
    const m = r.match(/^([A-Za-z,\-\s]+?)\s+((?:\d{1,2}:\d{2}-\d{1,2}:\d{2}\s*,?\s*)+|off|closed)$/);
    if (!m) return null;
    const jours = joursDe(m[1].replace(/\s/g, ''));
    if (!jours) return null;
    if (/off|closed/.test(m[2])) continue;
    for (const h of m[2].split(',')) {
      const [debut, fin] = h.trim().split('-');
      if (!debut || !fin) continue;
      plages.push({ jours, debut: debut.padStart(5, '0'), fin: fin.padStart(5, '0') });
    }
  }
  return plages.length ? plages : null;
}

// Type VintedFlow d'après les étiquettes OSM.
export function typeOSM(tags = {}) {
  const nom = (tags.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tout = `${nom} ${(tags.description || '').toLowerCase()}`;
  if (/emmaus/.test(nom)) return 'emmaus';
  if (/ressourcerie|recyclerie/.test(nom)) return 'ressourcerie';
  if (/kilo/.test(tout)) return 'friperie-kilo';
  if (/depot.?vente/.test(nom)) return 'depot-vente';
  if (/puces/.test(nom) || tags.amenity === 'marketplace') return 'puces';
  if (/fripe|friperie|vintage/.test(nom) || tags.shop === 'clothes') return 'friperie';
  if (tags.shop === 'charity') return 'solidaire';
  if (tags.shop === 'second_hand') return 'depot-vente';
  return 'autre';
}
