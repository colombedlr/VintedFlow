import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, prixMaxParPiece } from '../src/logic/rules.js';
import { ajouterJoursOuvres, joursOuvresRestants, mondayOf, nextMonday, nthInMonth, estOuvre } from '../src/logic/dates.js';
import { tresorerie, objectifMois, beneficeMois, semaineInfo, reference, settingsEffectifs, sortieStats, articlesARevoir, envoisAFaire } from '../src/logic/calc.js';
import { settingsParDefaut } from '../src/data/schema.js';
import { exemples } from '../src/data/seed.js';
import { LIEUX_MARSEILLE } from '../src/data/lieux.js';
import { proposerSemaine, plageOuverte, coutTrajet, journee } from '../src/logic/planning.js';

const regle = { minRevente: 15, multiple: 4 };

test('feu : vert, orange, rouge', () => {
  assert.equal(verdict({ prix: 6, revente: 25, regle }).kind, 'vert');
  const o = verdict({ prix: 7, revente: 25, regle });
  assert.equal(o.kind, 'orange');
  assert.equal(o.maxPayable, 6);
  assert.equal(verdict({ prix: 1, revente: 12, regle }).kind, 'rouge');
  assert.equal(verdict({ prix: 10, revente: 60, regle, budgetRestant: 5 }).titre, 'NÉGOCIE');
  assert.equal(verdict({ prix: 10, revente: 60, regle, budgetRestant: 0 }).titre, 'HORS BUDGET');
  assert.equal(verdict({ prix: 4, revente: 20, regle, piecesRestantes: 0 }).titre, 'SACS PLEINS');
  assert.equal(verdict({ prix: 4, revente: 20, regle, controleRequis: true, controleOk: false }).code, 'controle');
  assert.equal(verdict({ prix: 4, revente: 20, regle, doute: true }).kind, 'rouge');
});

test('feu : lot réparti', () => {
  // 3 pièces pour 12 € = 4 € pièce, revente 18 → 4×4 = 16 ≤ 18 : vert
  assert.equal(verdict({ prix: 12, revente: 18, nb: 3, regle }).kind, 'vert');
  const v = verdict({ prix: 15, revente: 18, nb: 3, regle });
  assert.equal(v.kind, 'orange');
  assert.equal(v.maxTotal, 13.5);
  assert.equal(prixMaxParPiece(18, regle), 4.5);
});

test('jours ouvrés et fériés', () => {
  // Vente le vendredi 6 nov. 2026 : 5 jours ouvrés, le 11 nov. est férié
  assert.equal(ajouterJoursOuvres('2026-11-06', 5), '2026-11-16');
  assert.equal(estOuvre('2026-11-11'), false);
  assert.equal(joursOuvresRestants('2026-11-16', '2026-11-16'), 0);
  assert.equal(mondayOf('2026-11-01'), '2026-10-26');
  assert.equal(nextMonday('2026-11-01'), '2026-11-02');
  assert.equal(nthInMonth('2026-11-21'), 3);
});

function etat(aujourdhui) {
  const st = { settings: { main: settingsParDefaut('2026-10-01') }, lieux: {}, semaines: {}, sorties: {}, articles: {}, mouvements: {}, temps: {}, marques: {} };
  for (const l of LIEUX_MARSEILLE) st.lieux[l.id] = { ...l, actif: true };
  for (const a of exemples(aujourdhui)) st.articles[a.id] = a;
  st.mouvements.m1 = { id: 'm1', type: 'apport', montant: 1000, date: '2026-10-01' };
  return st;
}

test('trésorerie : bénéfice ≠ argent retirable', () => {
  const today = '2026-11-10';
  const st = etat(today);
  const t = tresorerie(st, today);
  const couts = Object.values(st.articles).reduce((x, a) => x + a.cout, 0);
  const emb = Object.values(st.articles).filter((a) => a.venduAt).length * 0.5;
  // caisse = 1000 − achats − emballages − 2 mois d'abonnement Voi (oct + nov)
  assert.equal(Math.round(t.caisse * 100), Math.round((1000 - couts - emb - 8) * 100));
  assert.equal(t.porteMonnaie, 16); // le sweat Roxy finalisé
  assert.equal(t.attente, 26 + 18 + 22);
  assert.ok(t.retirable <= t.disponible - 150);
});

test('objectif : ventes restantes et rythme', () => {
  const today = '2026-11-10';
  const st = etat(today);
  const o = objectifMois(st, today);
  assert.ok(o.ventesRestantes > 60 && o.ventesRestantes < 80, String(o.ventesRestantes));
  assert.equal(o.joursRestants, 21);
  const b = beneficeMois(st, '2026-11', today);
  assert.equal(b.cotisations, 0); // particulier
});

test('settings : changement appliqué le lundi suivant', () => {
  const s = { ...settingsParDefaut('2026-11-01'), pending: { effectiveFrom: '2026-11-09', values: { budgetHebdo: 150 } } };
  assert.equal(settingsEffectifs(s, '2026-11-08').discipline.budgetHebdo, 125);
  assert.equal(settingsEffectifs(s, '2026-11-09').discipline.budgetHebdo, 150);
});

test('semaine proposée : 4 sorties max, budget respecté', () => {
  const today = '2026-11-09';
  const st = etat(today);
  const s = settingsParDefaut(today);
  const props = proposerSemaine(st, '2026-11-09', s);
  assert.ok(props.length > 0 && props.length <= 4);
  assert.equal(props.reduce((t, p) => t + p.budget, 0), 125);
  assert.ok(props.some((p) => ['2026-11-14', '2026-11-15'].includes(p.date)));
});

test('ouverture des lieux et transport', () => {
  const vg = LIEUX_MARSEILLE.find((l) => l.id === 'vg-boule-rond-point');
  assert.ok(plageOuverte(vg, '2026-11-07')); // 1er samedi
  assert.equal(plageOuverte(vg, '2026-11-14'), null); // 2e samedi
  assert.equal(coutTrajet({ mode: 'tram' }, { ticket: 2 }), 4);
  assert.equal(coutTrajet({ mode: 'voi', minutes: 25 }, { voiDeblocage: 1.5, voiMinute: 0.35, voiMinutesGratuites: 20 }), 2 * (1.5 + 5 * 0.35));
});

test('sortie : budget et sacs restants', () => {
  const today = '2026-11-14';
  const st = etat(today);
  st.sorties.s1 = { id: 's1', date: today, budget: 45, piecesMax: 15, statut: 'en_cours', lieuxIds: ['puces-marseille'] };
  st.articles.x = { id: 'x', sortieId: 's1', cout: 14, statut: 'a_completer', achatAt: new Date().toISOString() };
  const r = sortieStats(st, st.sorties.s1);
  assert.equal(r.budgetRestant, 31);
  assert.equal(r.piecesRestantes, 14);
  const sem = semaineInfo(st, mondayOf(today), settingsParDefaut(today));
  assert.equal(sem.alloue, 45);
});

test('référence plafonnée : catalogue puis historique', () => {
  const today = '2026-11-10';
  const st = etat(today);
  assert.equal(reference(st, 'Von Dutch', null, today).max, 50);
  assert.equal(reference(st, 'Inconnue', null, today), null);
  assert.equal(reference(st, 'X', { revente_min: 10, revente_max: 22 }, today).source, 'ia');
});

test('envois et articles à revoir', () => {
  const today = '2026-11-10';
  const st = etat(today);
  assert.equal(envoisAFaire(st, today).length, 2);
  assert.equal(articlesARevoir(st, today).length, 1);
  const j = journee(st, today, 9 * 60 + 10);
  assert.ok(j.blocs.length >= 2);
});

import { repartitionBudget } from '../src/logic/planning.js';
import { chargeDuJour, tachesEnRetard } from '../src/logic/taches.js';

test('ajout d’une sortie : le budget de la semaine est réparti à nouveau', () => {
  const today = '2026-11-09';
  const st = etat(today);
  const s = settingsParDefaut(today);
  st.sorties = {
    a: { id: 'a', date: '2026-11-11', statut: 'prevue', budget: 60 },
    b: { id: 'b', date: '2026-11-14', statut: 'prevue', budget: 65 },
    c: { id: 'c', date: '2026-11-13', statut: 'prevue', budget: 0 }
  };
  const r = repartitionBudget(st, '2026-11-09', s, today);
  assert.equal(r.reduce((t, x) => t + x.budget, 0), 125);
  const parId = Object.fromEntries(r.map((x) => [x.id, x.budget]));
  assert.ok(parId.b > parId.a); // le samedi pèse plus
  // une sortie terminée garde son budget
  st.sorties.a.statut = 'terminee';
  const r2 = repartitionBudget(st, '2026-11-09', s, today);
  assert.equal(r2.reduce((t, x) => t + x.budget, 0), 65);
});

test('tâches : charge, surcharge et retard', () => {
  const today = '2026-11-10';
  const st = etat(today);
  const s = settingsParDefaut(today);
  st.taches = {
    t1: { id: 't1', titre: 'Longue', type: 'perso', date: today, duree: 120 },
    t2: { id: 't2', titre: 'Sport', type: 'perso', jours: [2], duree: 75, importante: true, faitLe: {} },
    t3: { id: 't3', titre: 'Oubliée', type: 'pro', date: '2026-11-08', duree: 15 }
  };
  const c = chargeDuJour(st, s, today, []);
  assert.equal(c.perso.prevu, 195);
  assert.equal(c.surcharge, true);
  assert.deepEqual(c.aReporter.map((t) => t.id), ['t1']);
  assert.equal(tachesEnRetard(st, today).length, 1);
});

import { lireReponse } from '../src/ai/assistant.js';
test('lecture d’une réponse Claude ou ChatGPT', () => {
  const r = lireReponse(`Voici :\n**PIECE:** jean taille basse\nMARQUE: Miss Sixty\nPOTENTIEL: Fort\nREVENTE: 20 - 30 €\nCONTREFACON: faible\nSIGNAUX: étiquette nette\nA VERIFIER: fermeture éclair`);
  assert.equal(r.marque, 'Miss Sixty');
  assert.equal(r.revente_min, 20);
  assert.equal(r.revente_max, 30);
  assert.equal(r.potentiel, 'fort');
  assert.equal(r.risque_contrefacon, 'faible');
  assert.equal(lireReponse('bonjour'), null);
  assert.equal(lireReponse('MARQUE: inconnue\nREVENTE: 15-25\nCONTREFAÇON: élevé').risque_contrefacon, 'eleve');
});

import { lireHorairesOSM, ordreTournee, ouvertMaintenant, distanceKm, typeOSM, minutesPour } from '../src/logic/geo.js';
test('carte : horaires OSM, ouverture, distance, tournée', () => {
  const h = lireHorairesOSM('Mo-Fr 10:00-12:30,14:00-18:00; Sa 10:00-18:00; PH off');
  assert.equal(h.length, 3);
  assert.deepEqual(h[0].jours, [1, 2, 3, 4, 5]);
  assert.equal(lireHorairesOSM('sunrise-sunset'), null);
  assert.deepEqual(lireHorairesOSM('Fr-Mo 09:00-12:00')[0].jours.sort(), [0, 1, 5, 6]);
  const l = { ouverture: h };
  assert.equal(ouvertMaintenant(l, '2026-11-02', 11 * 60), true); // lundi 11h
  assert.equal(ouvertMaintenant(l, '2026-11-02', 13 * 60), false); // pause déjeuner
  assert.equal(ouvertMaintenant(l, '2026-11-08', 11 * 60), false); // dimanche
  const timone = { lat: 43.2898, lon: 5.4005 };
  const vieuxPort = { lat: 43.2951, lon: 5.3745 };
  const km = distanceKm(timone, vieuxPort);
  assert.ok(km > 2 && km < 2.4, String(km));
  assert.ok(minutesPour(km, 'pied') > minutesPour(km, 'velo'));
  const a = { nom: 'A', lat: 43.30, lon: 5.40 }, b = { nom: 'B', lat: 43.31, lon: 5.40 }, c = { nom: 'C', lat: 43.32, lon: 5.40 };
  assert.deepEqual(ordreTournee(timone, [c, a, b]).map((x) => x.nom), ['A', 'B', 'C']);
  assert.equal(typeOSM({ name: 'Emmaüs Pointe Rouge', shop: 'second_hand' }), 'emmaus');
  assert.equal(typeOSM({ name: 'La Fripe au Kilo', shop: 'clothes' }), 'friperie-kilo');
  assert.equal(typeOSM({ name: 'Recyclerie du Sud' }), 'ressourcerie');
});

import { estExcluStats } from '../src/logic/calc.js';
test('origines : budget, trésorerie, cotisations, stats', () => {
  const today = '2026-11-10';
  const st = etat(today);
  const s = st.settings.main;
  s.statut = 'micro';
  const avant = tresorerie(st, today);
  const semAvant = semaineInfo(st, mondayOf(today), s).depense;
  st.articles.anc = { id: 'anc', origine: 'ancien', prixStatut: 'inconnu', cout: 0, statut: 'a_completer' };
  st.articles.tr = { id: 'tr', origine: 'trouvaille', cout: 5, statut: 'a_completer', achatAt: new Date('2026-11-10T12:00:00').toISOString() };
  st.articles.dr = { id: 'dr', origine: 'dressing', cout: 0, statut: 'vendu', prixVente: 30, venduAt: new Date('2026-11-09T12:00:00').toISOString() };
  // Pas de consommation du budget de semaine
  assert.equal(semaineInfo(st, mondayOf(today), s).depense, semAvant);
  // La trouvaille sort de la caisse (5 €)
  const apres = tresorerie(st, today);
  assert.equal(Math.round((avant.caisse - apres.caisse) * 100), 500 + 50); // + emballage du dressing vendu
  // Le dressing compte dans l'argent du mois mais pas dans le CA soumis aux cotisations
  const b = beneficeMois(st, '2026-11', today);
  assert.equal(b.dressingVentes, 30);
  assert.equal(b.ca, beneficeMois({ ...st, articles: Object.fromEntries(Object.entries(st.articles).filter(([k]) => k !== 'dr')) }, '2026-11', today).ca);
  assert.equal(Math.round((b.benefice - b.beneficeActivite) * 10) / 10, 29.5);
  assert.equal(estExcluStats(st.articles.anc), true);
  assert.equal(estExcluStats(st.articles.dr), true);
  assert.equal(estExcluStats(st.articles.tr), false);
});
