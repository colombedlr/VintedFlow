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
