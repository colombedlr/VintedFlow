// Sources gratuites :
// - adresses : Géoplateforme de l'IGN (ex-API Adresse, gratuite, sans clé, autocomplétion autorisée) ;
// - lieux permanents : OpenStreetMap via Overpass (gratuit, usage modéré, résultats mis en cache 7 jours).
import { typeOSM, lireHorairesOSM } from '../logic/geo.js';

const GEOCODEUR = 'https://data.geopf.fr/geocodage/search';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const CACHE_JOURS = 7;

function lireCache(cle) {
  try {
    const v = JSON.parse(localStorage.getItem(cle) || 'null');
    if (v && Date.now() - v.t < CACHE_JOURS * 86400000) return v.d;
  } catch {
    /* rien */
  }
  return null;
}
function ecrireCache(cle, d) {
  try {
    localStorage.setItem(cle, JSON.stringify({ t: Date.now(), d }));
  } catch {
    /* plein : tant pis */
  }
}

async function avecDelai(url, options = {}, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Autocomplétion d'adresse (Marseille privilégiée).
export async function chercherAdresse(q, pres = { lat: 43.2965, lon: 5.3698 }) {
  if (!q || q.trim().length < 3) return [];
  const p = new URLSearchParams({ q: q.trim(), limit: '6', autocomplete: '1', lat: String(pres.lat), lon: String(pres.lon) });
  const r = await avecDelai(`${GEOCODEUR}?${p}`, {}, 6000);
  if (!r.ok) throw new Error('Recherche d’adresse indisponible.');
  const j = await r.json();
  return (j.features || []).map((f) => ({
    label: f.properties.label,
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0]
  }));
}

export async function geocoder(adresse) {
  const cle = 'vf-geo:' + adresse.toLowerCase();
  const c = lireCache(cle);
  if (c) return c;
  const [r] = await chercherAdresse(adresse.replace(/\(.*?\)/g, ''));
  if (r) ecrireCache(cle, r);
  return r || null;
}

function requeteOverpass(lat, lon, rayonM) {
  const a = `(around:${Math.round(rayonM)},${lat},${lon})`;
  return `[out:json][timeout:20];
(
  nwr${a}["shop"~"^(second_hand|charity)$"];
  nwr${a}["second_hand"~"^(yes|only)$"];
  nwr${a}["shop"="clothes"]["name"~"fripe|friperie|vintage|kilo",i];
  nwr${a}["name"~"emma[uü]s|ressourcerie|recyclerie|d[ée]p[ôo]t.?vente|march[ée] aux puces",i];
  nwr${a}["amenity"="marketplace"]["name"~"puces|brocante",i];
);
out center tags 150;`;
}

// Lieux permanents autour d'un point (OSM). Résultats en cache 7 jours par zone.
export async function lieuxOSM(lat, lon, rayonKm) {
  const rayon = Math.min(15, Math.max(0.5, rayonKm));
  const cle = `vf-osm:${lat.toFixed(2)},${lon.toFixed(2)},${Math.ceil(rayon)}`;
  const c = lireCache(cle);
  if (c) return { lieux: c, cache: true };
  let derniere;
  for (const url of OVERPASS) {
    try {
      const r = await avecDelai(url, { method: 'POST', body: 'data=' + encodeURIComponent(requeteOverpass(lat, lon, Math.ceil(rayon) * 1000)), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 15000);
      if (!r.ok) throw new Error(`Overpass ${r.status}`);
      const j = await r.json();
      const lieux = (j.elements || [])
        .map((e) => {
          const t = e.tags || {};
          const la = e.lat ?? e.center?.lat;
          const lo = e.lon ?? e.center?.lon;
          if (la == null || !t.name) return null;
          const adresse = [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ')].filter(Boolean).join(', ');
          return {
            osmId: `${e.type}/${e.id}`,
            nom: t.name,
            type: typeOSM(t),
            lat: la,
            lon: lo,
            adresse,
            horairesTexte: t.opening_hours || '',
            ouverture: lireHorairesOSM(t.opening_hours) || [],
            site: t.website || t['contact:website'] || ''
          };
        })
        .filter(Boolean);
      ecrireCache(cle, lieux);
      return { lieux, cache: false };
    } catch (e) {
      derniere = e;
    }
  }
  throw derniere || new Error('Recherche indisponible.');
}

export function lienItineraire(appli, mode, depart, arrivee) {
  const d = depart ? `${depart.lat},${depart.lon}` : '';
  const a = arrivee.lat != null ? `${arrivee.lat},${arrivee.lon}` : encodeURIComponent(arrivee.adresse || arrivee.nom);
  if (appli === 'plans') {
    const flag = { transports: 'r', pied: 'w', velo: 'b' }[mode];
    return `https://maps.apple.com/?${d ? `saddr=${d}&` : ''}daddr=${a}&dirflg=${flag}`;
  }
  const tm = { transports: 'transit', pied: 'walking', velo: 'bicycling' }[mode];
  return `https://www.google.com/maps/dir/?api=1${d ? `&origin=${d}` : ''}&destination=${a}&travelmode=${tm}`;
}
