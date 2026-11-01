// Premier démarrage : réglages, lieux de Marseille, apport de départ et 15 articles d'exemple.
import { settingsParDefaut } from './schema.js';
import { LIEUX_MARSEILLE } from './lieux.js';
import { addDays, ajouterJoursOuvres, isoDate } from '../logic/dates.js';

const at = (iso, h = '10:00') => new Date(`${iso}T${h}:00`).toISOString();

export function exemples(aujourdhui) {
  const j = (n) => addDays(aujourdhui, -n);
  const base = [
    ['Jean taille basse', 'Miss Sixty', 'Jeans', 'W28', 'Très bon état', 5, 25, 3, 'a_photographier', 4],
    ['Mini-jupe en jean', 'Diesel', 'Jupes', '38', 'Très bon état', 3, 18, 3, 'a_photographier', 4],
    ['Top dos nu à logo', 'Morgan', 'Tops et tee-shirts', 'S', 'Bon état', 2, 15, 3, 'a_photographier', 4],
    ['Survêtement velours rose', 'Juicy Couture', 'Survêtements', 'M', 'Très bon état', 8, 45, 4, 'a_preparer', 3],
    ['Débardeur logo flammes', 'Von Dutch', 'Tops et tee-shirts', 'M', 'Bon état', 4, 22, 4, 'a_completer', 1],
    ['Sac baguette', 'Kookaï', 'Sacs', 'TU', 'Bon état', 3, 16, 5, 'a_mettre_en_ligne', 6],
    ['Baskets Mostro', 'Puma', 'Chaussures', '40', 'Bon état', 6, 35, 7, 'a_mettre_en_ligne', 6],
    ['Lunettes enveloppantes', 'Oakley', 'Lunettes', 'TU', 'Bon état', 6, 40, 5, 'a_preparer', 2],
    ['Baskets plateformes', 'Buffalo', 'Chaussures', '39', 'Bon état', 7, 45, 7, 'en_ligne', 14],
    ['Jean flare', 'Killah', 'Jeans', '27', 'Très bon état', 4, 22, 2, 'en_ligne', 38],
    ['Veste de survêtement vintage', 'Adidas', 'Survêtements', 'L', 'Bon état', 5, 30, 6, 'en_ligne', 8],
    ['Tee-shirt strass tigre', 'Ed Hardy', 'Tops et tee-shirts', 'M', 'Très bon état', 4, 28, 1, 'vendu', 9],
    ['Haut cache-cœur', 'Cop Copine', 'Tops et tee-shirts', '38', 'Très bon état', 3, 18, 1, 'vendu', 12],
    ['Jean taille basse brodé', 'Le Temps des Cerises', 'Jeans', '28', 'Bon état', 4, 22, 2, 'envoye', 15],
    ['Sweat zippé', 'Roxy', 'Pulls et sweats', 'M', 'Bon état', 2, 16, 6, 'finalise', 20]
  ];
  return base.map(([titre, marque, categorie, taille, etat, cout, revente, bac, statut, ilYa], i) => {
    const achat = j(ilYa);
    const a = {
      id: `exemple-${i + 1}`,
      demo: true,
      titre,
      marque,
      categorie,
      taille,
      etat,
      cout,
      revente,
      bac: String(bac),
      statut,
      achatAt: at(achat, '08:30'),
      lieuId: i % 3 === 0 ? 'puces-marseille' : i % 3 === 1 ? 'brigaille' : 'vg-valentine',
      notes: '',
      historique: [{ statut: 'a_completer', at: at(achat, '08:30') }]
    };
    if (['en_ligne', 'vendu', 'envoye', 'finalise'].includes(statut)) {
      const enLigne = statut === 'en_ligne' ? achat : addDays(achat, 2);
      a.enLigneAt = at(enLigne, '18:00');
      a.prixAffiche = statut === 'en_ligne' && ilYa > 30 ? revente + 2 : revente;
    }
    if (['vendu', 'envoye', 'finalise'].includes(statut)) {
      const vente = statut === 'vendu' ? (i === 12 ? j(3) : j(1)) : statut === 'envoye' ? j(5) : j(9);
      a.venduAt = at(vente, '20:15');
      a.prixVente = statut === 'vendu' && i === 11 ? 26 : revente;
      a.envoiLimite = ajouterJoursOuvres(vente, 5);
      if (statut !== 'vendu') a.envoyeAt = at(addDays(vente, 1), '11:40');
      if (statut === 'finalise') a.finaliseAt = at(addDays(vente, 4), '09:00');
    }
    return a;
  });
}

export function premierDemarrage(store, aujourdhui = isoDate()) {
  if (store.state.settings.main) return false;
  store.put('settings', { ...settingsParDefaut(aujourdhui), exemplesCharges: true });
  for (const l of LIEUX_MARSEILLE) {
    store.put('lieux', { ...l, aValider: true, actif: true, notes: l.notes || '' });
  }
  store.put('mouvements', { type: 'apport', montant: 1000, date: aujourdhui, note: 'Budget de départ' });
  for (const a of exemples(aujourdhui)) store.put('articles', a);
  for (const t of tachesExemples(aujourdhui)) store.put('taches', t);
  return true;
}

export function tachesExemples(aujourdhui) {
  return [
    { id: 'tache-ex-1', demo: true, titre: 'Acheter des sacs d’envoi', type: 'pro', date: aujourdhui, duree: 30, importante: true, jours: [], fait: false, faitLe: {} },
    { id: 'tache-ex-2', demo: true, titre: 'Répondre aux messages Vinted', type: 'pro', jours: [1, 2, 3, 4, 5, 6, 0], debut: aujourdhui, duree: 15, fait: false, faitLe: {} },
    { id: 'tache-ex-3', demo: true, titre: 'Salle de sport', type: 'perso', jours: [1, 3, 5], debut: aujourdhui, duree: 75, heure: '18:30', fait: false, faitLe: {} }
  ];
}

export function effacerExemples(store) {
  for (const t of Object.values(store.state.taches || {})) if (t.demo) store.remove('taches', t.id);
  for (const a of Object.values(store.state.articles)) {
    if (a.demo) {
      for (const p of a.photoIds || []) store.removePhoto(p);
      store.remove('articles', a.id);
    }
  }
  for (const m of Object.values(store.state.mouvements)) if (m.demo) store.remove('mouvements', m.id);
  for (const s of Object.values(store.state.sorties)) if (s.demo) store.remove('sorties', s.id);
}
