// Tous les chiffres sont recalculés à partir des données de base (achats, ventes, sorties, mouvements).
import { STATUTS, STATUTS_STOCK } from '../data/schema.js';
import { CATALOGUE_MARQUES, normaliser } from '../data/marques.js';
import {
  addDays, mondayOf, monthKey, daysInMonth, dayOfMonth, diffDays, isoDate, joursOuvresRestants
} from './dates.js';

export const liste = (map) => Object.values(map || {}).filter((d) => d && !d._supprime);

export function settingsDe(state) {
  return (state.settings && state.settings.main) || null;
}

export function settingsEffectifs(s, aujourdhui) {
  if (!s) return s;
  if (s.pending && s.pending.effectiveFrom && s.pending.effectiveFrom <= aujourdhui) {
    return { ...s, discipline: { ...s.discipline, ...s.pending.values }, pending: null };
  }
  return s;
}

export const estEnStock = (a) => STATUTS_STOCK.includes(a.statut);
// Origine d'un article : sortie (par défaut), ancien stock, dressing perso, trouvaille ponctuelle.
export const origineDe = (a) => a.origine || 'sortie';
export const estDressing = (a) => origineDe(a) === 'dressing';
// Exclu des moyennes et de la rentabilité : dressing perso, ancien stock à prix inconnu.
export const estExcluStats = (a) => estDressing(a) || (origineDe(a) === 'ancien' && a.prixStatut === 'inconnu');
// Compte dans le budget de la semaine (et donc des sorties) : seulement les achats en sortie.
export const compteBudget = (a) => origineDe(a) === 'sortie';
// Argent réellement sorti de la caisse depuis le début : sortie et trouvaille (l'ancien stock a été payé avant).
export const compteCaisse = (a) => ['sortie', 'trouvaille'].includes(origineDe(a));
export const estVenteComptee = (a) => !!a.venduAt && ['vendu', 'envoye', 'finalise'].includes(a.statut);
const jourDe = (isoDateTime) => (isoDateTime ? isoDate(new Date(isoDateTime)) : null);

export function emballageDe(a, s) {
  return a.emballage ?? s?.hypotheses?.emballage ?? 0.5;
}

export function margeArticle(a, s) {
  return (a.prixVente || 0) - (a.cout || 0) - emballageDe(a, s);
}

export function compteParStatut(state) {
  const c = Object.fromEntries(STATUTS.map((s) => [s.id, 0]));
  for (const a of liste(state.articles)) c[a.statut] = (c[a.statut] || 0) + 1;
  return c;
}

// ---------- Sorties et semaines ----------

export function sortieStats(state, sortie) {
  const arts = liste(state.articles).filter((a) => a.sortieId === sortie.id);
  const depense = arts.reduce((t, a) => t + (a.cout || 0), 0);
  const pieces = arts.length;
  return {
    articles: arts,
    depense,
    pieces,
    budgetRestant: Math.max(0, (sortie.budget || 0) - depense),
    piecesRestantes: Math.max(0, (sortie.piecesMax || 0) - pieces)
  };
}

export function sortiesDeLaSemaine(state, lundi) {
  const dimanche = addDays(lundi, 6);
  return liste(state.sorties)
    .filter((so) => so.date >= lundi && so.date <= dimanche)
    .sort((a, b) => (a.date + (a.heure || '')).localeCompare(b.date + (b.heure || '')));
}

export function semaineInfo(state, lundi, eff) {
  const doc = (state.semaines || {})[lundi] || null;
  const budget = doc?.budget ?? eff.discipline.budgetHebdo;
  const toutes = sortiesDeLaSemaine(state, lundi);
  const sorties = toutes.filter((so) => so.statut !== 'annulee');
  // Une sortie annulée après verrouillage garde son budget : il n'est pas redistribué.
  const alloue = toutes.filter((so) => so.statut !== 'annulee' || so.budgetPerdu).reduce((t, so) => t + (so.budget || 0), 0);
  const dimanche = addDays(lundi, 6);
  const depense = liste(state.articles)
    .filter((a) => compteBudget(a) && a.achatAt && jourDe(a.achatAt) >= lundi && jourDe(a.achatAt) <= dimanche)
    .reduce((t, a) => t + (a.cout || 0), 0);
  const transport = sorties.reduce((t, so) => t + (so.transportCout || so.transportPrevu || 0), 0);
  return {
    lundi,
    dimanche,
    doc,
    budget,
    verrouillee: !!doc?.verrouillee,
    sorties,
    alloue,
    nonAlloue: Math.max(0, budget - alloue),
    depense,
    restant: Math.max(0, budget - depense),
    transport
  };
}

export function sortieEnCours(state) {
  return liste(state.sorties).find((so) => so.statut === 'en_cours') || null;
}

// ---------- Argent ----------

function moisDepuis(debutIso, finIso) {
  if (!debutIso) return 1;
  const [y1, m1] = debutIso.split('-').map(Number);
  const [y2, m2] = finIso.split('-').map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
}

export function cotisationsTaux(s) {
  if (s.statut !== 'micro') return 0;
  return s.cotisations.acre ? s.cotisations.tauxAcre : s.cotisations.taux;
}

export function tresorerie(state, aujourdhui) {
  const s = settingsEffectifs(settingsDe(state), aujourdhui);
  let caisse = 0;
  let porteMonnaie = 0;
  let attente = 0;
  let nbAttente = 0;
  let apport = 0;
  for (const m of liste(state.mouvements)) {
    const v = Number(m.montant) || 0;
    if (m.type === 'apport') { caisse += v; apport += v; }
    else if (m.type === 'virement_vinted') { caisse += v; porteMonnaie -= v; }
    else if (m.type === 'retrait_perso') caisse -= v;
    else if (m.type === 'depense') caisse -= v;
  }
  let valeurStock = 0;
  let nbStock = 0;
  for (const a of liste(state.articles)) {
    if (compteCaisse(a)) caisse -= a.cout || 0;
    if (estEnStock(a)) { valeurStock += a.cout || 0; nbStock++; }
    if (a.venduAt && a.statut !== 'retour' && a.statut !== 'sorti') caisse -= emballageDe(a, s);
    if (a.statut === 'vendu' || a.statut === 'envoye') { attente += a.prixVente || 0; nbAttente++; }
    if (a.statut === 'finalise') porteMonnaie += a.prixVente || 0;
    if (a.statut === 'sorti' && a.sortie?.montant) caisse += Number(a.sortie.montant) || 0;
  }
  for (const so of liste(state.sorties)) caisse -= so.transportCout || 0;
  caisse -= (s.transport?.voiAbonnement || 0) * moisDepuis(s.creeLe?.slice(0, 7), aujourdhui.slice(0, 7));

  const semaine = semaineInfo(state, mondayOf(aujourdhui), s);
  const budgetSemaineRestant = semaine.restant;
  const cotisDues = cotisationsTaux(s) * chiffreAffairesMois(state, monthKey(aujourdhui));
  const disponible = caisse + porteMonnaie;
  const reserve = s.discipline.reserve;
  const retirable = Math.max(0, disponible - reserve - budgetSemaineRestant - cotisDues);
  return {
    caisse, porteMonnaie, disponible, attente, nbAttente, valeurStock, nbStock,
    reserve, budgetSemaineRestant, cotisDues, retirable, apport
  };
}

export function ventesDuMois(state, mois) {
  return liste(state.articles).filter((a) => estVenteComptee(a) && jourDe(a.venduAt).startsWith(mois));
}

// Chiffre d'affaires de l'activité (soumis aux cotisations) : hors dressing perso.
export function chiffreAffairesMois(state, mois) {
  return ventesDuMois(state, mois).filter((a) => !estDressing(a)).reduce((t, a) => t + (a.prixVente || 0), 0);
}

export function achatsDuMois(state, mois) {
  return liste(state.articles)
    .filter((a) => compteCaisse(a) && a.achatAt && jourDe(a.achatAt).startsWith(mois))
    .reduce((t, a) => t + (a.cout || 0), 0);
}

export function beneficeMois(state, mois, aujourdhui) {
  const s = settingsEffectifs(settingsDe(state), aujourdhui);
  const toutes = ventesDuMois(state, mois);
  const ventes = toutes.filter((a) => !estDressing(a));
  const dressing = toutes.filter(estDressing);
  const ca = ventes.reduce((t, a) => t + (a.prixVente || 0), 0);
  const coutVendus = ventes.reduce((t, a) => t + (a.cout || 0), 0);
  const emballages = ventes.reduce((t, a) => t + emballageDe(a, s), 0);
  const dressingVentes = dressing.reduce((t, a) => t + (a.prixVente || 0), 0);
  const dressingGain = dressing.reduce((t, a) => t + (a.prixVente || 0) - emballageDe(a, s), 0);
  const transport = liste(state.sorties)
    .filter((so) => so.date?.startsWith(mois))
    .reduce((t, so) => t + (so.transportCout || 0), 0);
  const depenses = liste(state.mouvements)
    .filter((m) => m.type === 'depense' && m.date?.startsWith(mois))
    .reduce((t, m) => t + (Number(m.montant) || 0), 0);
  const fixes = !s.creeLe || mois >= s.creeLe.slice(0, 7) ? s.transport?.voiAbonnement || 0 : 0;
  const cotisations = cotisationsTaux(s) * ca;
  const beneficeActivite = ca - coutVendus - emballages - transport - depenses - fixes - cotisations;
  // L'argent gagné du mois compte aussi le dressing perso (hors cotisations).
  const benefice = beneficeActivite + dressingGain;
  return {
    ventes, nb: ventes.length, ca, coutVendus, emballages, transport, depenses, fixes, cotisations,
    beneficeActivite, dressing, nbDressing: dressing.length, dressingVentes, dressingGain, benefice,
    achats: achatsDuMois(state, mois)
  };
}

// Moyennes réelles après 3 semaines et au moins 10 ventes, sinon hypothèses du brief.
export function moyennes(state, aujourdhui) {
  const s = settingsEffectifs(settingsDe(state), aujourdhui);
  const ventes = liste(state.articles).filter((a) => estVenteComptee(a) && !estExcluStats(a));
  const assezVieux = s.creeLe && diffDays(s.creeLe, aujourdhui) >= 21;
  if (assezVieux && ventes.length >= 10) {
    const achat = ventes.reduce((t, a) => t + (a.cout || 0), 0) / ventes.length;
    const revente = ventes.reduce((t, a) => t + (a.prixVente || 0), 0) / ventes.length;
    const emb = ventes.reduce((t, a) => t + emballageDe(a, s), 0) / ventes.length;
    return { source: 'tes ventes', achat, revente, emballage: emb, marge: revente - achat - emb };
  }
  const h = s.hypotheses;
  return { source: 'hypothèses de départ', achat: h.achatMoyen, revente: h.reventeMoyenne, emballage: h.emballage, marge: h.reventeMoyenne - h.achatMoyen - h.emballage };
}

export function objectifMois(state, aujourdhui) {
  const s = settingsEffectifs(settingsDe(state), aujourdhui);
  const mois = monthKey(aujourdhui);
  const b = beneficeMois(state, mois, aujourdhui);
  const moy = moyennes(state, aujourdhui);
  const restant = Math.max(0, s.objectif - b.benefice);
  const marge = Math.max(1, moy.marge * (1 - cotisationsTaux(s)));
  const ventesRestantes = Math.ceil(restant / marge);
  const joursRestants = daysInMonth(aujourdhui) - dayOfMonth(aujourdhui) + 1;
  const rythme = joursRestants > 0 ? ventesRestantes / joursRestants : ventesRestantes;
  const ventesCibleMois = Math.ceil((s.objectif + (s.transport?.voiAbonnement || 0) + 60) / marge);
  return {
    ...b,
    objectif: s.objectif,
    progression: Math.max(0, Math.min(1, b.benefice / s.objectif)),
    restant,
    ventesRestantes,
    joursRestants,
    rythme,
    moyennes: moy,
    ventesCibleMois,
    jourDuMois: dayOfMonth(aujourdhui),
    joursDansMois: daysInMonth(aujourdhui)
  };
}

// ---------- Temps et rentabilité ----------

export function dureeSortieMin(so) {
  if (!so.debutAt || !so.finAt) return 0;
  return Math.max(0, (new Date(so.finAt) - new Date(so.debutAt)) / 60000);
}

export function dureeTempsMin(t) {
  if (t.minutes != null) return t.minutes;
  if (t.debutAt && t.finAt) return Math.max(0, (new Date(t.finAt) - new Date(t.debutAt)) / 60000);
  return 0;
}

export function heuresMois(state, mois) {
  const tps = liste(state.temps)
    .filter((t) => (t.date || jourDe(t.debutAt) || '').startsWith(mois))
    .reduce((m, t) => m + dureeTempsMin(t), 0);
  const so = liste(state.sorties)
    .filter((x) => x.date?.startsWith(mois))
    .reduce((m, x) => m + dureeSortieMin(x), 0);
  return (tps + so) / 60;
}

export function rentabiliteParLieu(state, aujourdhui) {
  const s = settingsEffectifs(settingsDe(state), aujourdhui);
  const res = {};
  const lieux = liste(state.lieux);
  for (const l of lieux) res[l.id] = { lieu: l, achetes: 0, vendus: 0, profit: 0, heures: 0, transport: 0, sorties: 0 };
  for (const a of liste(state.articles)) {
    if (!a.lieuId || !res[a.lieuId] || estExcluStats(a)) continue;
    res[a.lieuId].achetes++;
    if (estVenteComptee(a)) { res[a.lieuId].vendus++; res[a.lieuId].profit += margeArticle(a, s); }
  }
  for (const so of liste(state.sorties)) {
    if (so.statut !== 'terminee') continue;
    const ids = (so.lieuxIds || []).filter((id) => res[id]);
    if (!ids.length) continue;
    const part = 1 / ids.length;
    for (const id of ids) {
      res[id].heures += (dureeSortieMin(so) / 60) * part;
      res[id].transport += (so.transportCout || 0) * part;
      res[id].sorties += 1;
    }
  }
  return Object.values(res)
    .map((r) => ({ ...r, parHeure: r.heures >= 0.5 ? (r.profit - r.transport) / r.heures : null }))
    .filter((r) => r.achetes > 0 || r.sorties > 0)
    .sort((a, b) => (b.parHeure ?? -1e9) - (a.parHeure ?? -1e9));
}

function groupe(state, cle, aujourdhui) {
  const s = settingsEffectifs(settingsDe(state), aujourdhui);
  const res = {};
  for (const a of liste(state.articles)) {
    const nom = cle(a);
    if (!nom) continue;
    const k = normaliser(nom);
    const r = (res[k] ||= { nom, n: 0, stock: 0, total: 0, profit: 0, min: Infinity, max: 0, delais: [] });
    if (estEnStock(a)) r.stock++;
    if (!estVenteComptee(a) || estExcluStats(a)) continue;
    r.n++;
    r.total += a.prixVente || 0;
    r.profit += margeArticle(a, s);
    r.min = Math.min(r.min, a.prixVente || 0);
    r.max = Math.max(r.max, a.prixVente || 0);
    const debut = a.enLigneAt || a.achatAt;
    if (debut) r.delais.push(Math.max(0, diffDays(jourDe(debut), jourDe(a.venduAt))));
  }
  return Object.fromEntries(
    Object.entries(res).map(([k, r]) => [
      k,
      {
        ...r,
        moyenne: r.n ? r.total / r.n : null,
        delaiMoyen: r.delais.length ? r.delais.reduce((t, d) => t + d, 0) / r.delais.length : null,
        min: r.n ? r.min : null
      }
    ])
  );
}

export const statsParMarque = (state, aujourdhui) => groupe(state, (a) => a.marque, aujourdhui);
export const statsParCategorie = (state, aujourdhui) => groupe(state, (a) => a.categorie, aujourdhui);

// ---------- Marques et référence de prix ----------

export function trouverMarque(state, nom) {
  const k = normaliser(nom);
  if (!k) return null;
  const perso = liste(state.marques).find((m) => normaliser(m.nom) === k || (m.alias || []).some((x) => normaliser(x) === k));
  if (perso) return { ...perso, source: perso.source || 'perso' };
  const cat = CATALOGUE_MARQUES.find((m) => normaliser(m.nom) === k || (m.alias || []).some((x) => normaliser(x) === k));
  return cat ? { ...cat, source: 'catalogue' } : null;
}

export function chercherMarques(state, q) {
  const k = normaliser(q);
  const toutes = [
    ...liste(state.marques).map((m) => ({ ...m, source: m.source || 'perso' })),
    ...CATALOGUE_MARQUES.filter((c) => !liste(state.marques).some((m) => normaliser(m.nom) === normaliser(c.nom))).map((m) => ({ ...m, source: 'catalogue' }))
  ];
  if (!k) return toutes.sort((a, b) => a.nom.localeCompare(b.nom));
  return toutes
    .filter((m) => normaliser(m.nom).includes(k) || (m.alias || []).some((x) => normaliser(x).includes(k)))
    .sort((a, b) => {
      const sa = normaliser(a.nom).startsWith(k) ? 0 : 1;
      const sb = normaliser(b.nom).startsWith(k) ? 0 : 1;
      return sa - sb || a.nom.localeCompare(b.nom);
    });
}

// Référence de prix pour plafonner la revente estimée.
export function reference(state, marqueNom, ia, aujourdhui) {
  if (marqueNom) {
    const hist = statsParMarque(state, aujourdhui)[normaliser(marqueNom)];
    if (hist && hist.n >= 3) {
      return { min: Math.round(hist.min), max: Math.round(hist.max), source: 'historique', label: `ton historique (${hist.n} ventes)` };
    }
  }
  if (ia && ia.revente_max) {
    return { min: Math.round(ia.revente_min || 0), max: Math.round(ia.revente_max), source: 'ia', label: 'analyse photo' };
  }
  const m = marqueNom ? trouverMarque(state, marqueNom) : null;
  if (m && m.hi) return { min: m.lo, max: m.hi, source: 'catalogue', label: 'catalogue' };
  return null;
}

// ---------- Envois, articles à revoir, écarts ----------

export function envoisAFaire(state, aujourdhui) {
  return liste(state.articles)
    .filter((a) => a.statut === 'vendu')
    .map((a) => ({ article: a, restants: a.envoiLimite ? joursOuvresRestants(aujourdhui, a.envoiLimite) : null }))
    .sort((x, y) => (x.article.envoiLimite || '9').localeCompare(y.article.envoiLimite || '9'));
}

export function articlesARevoir(state, aujourdhui) {
  const s = settingsEffectifs(settingsDe(state), aujourdhui);
  return liste(state.articles)
    .filter((a) => a.statut === 'en_ligne' && a.enLigneAt && diffDays(jourDe(a.enLigneAt), aujourdhui) >= s.delaiEnLigne)
    .map((a) => ({ article: a, jours: diffDays(jourDe(a.enLigneAt), aujourdhui) }))
    .sort((x, y) => y.jours - x.jours);
}

export function ecarts(state, depuisIso) {
  return liste(state.articles).filter((a) => a.horsRegle && a.achatAt && jourDe(a.achatAt) >= depuisIso);
}

export function rechercherArticles(state, q) {
  const k = normaliser(q);
  if (!k) return [];
  const mots = k.split(' ').filter(Boolean);
  return liste(state.articles)
    .filter((a) => {
      const bac = a.bac != null && a.bac !== '' ? `bac ${a.bac} ${a.bac}` : '';
      const txt = normaliser([a.titre, a.marque, a.taille, a.categorie, a.etat, a.notes, bac, ...(a.tags || [])].join(' '));
      return mots.every((m) => txt.includes(m));
    })
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
