// Modèle de données de VintedFlow.

export const COLLECTIONS = ['settings', 'lieux', 'semaines', 'sorties', 'articles', 'mouvements', 'temps', 'marques', 'taches', 'decouvertes'];

export const STATUTS = [
  { id: 'a_completer', label: 'Acheté · à compléter', court: 'À compléter', stock: true },
  { id: 'a_preparer', label: 'À préparer', court: 'À préparer', stock: true },
  { id: 'a_photographier', label: 'À photographier', court: 'À photographier', stock: true },
  { id: 'a_mettre_en_ligne', label: 'À mettre en ligne', court: 'À mettre en ligne', stock: true },
  { id: 'en_ligne', label: 'En ligne', court: 'En ligne', stock: true },
  { id: 'vendu', label: 'Vendu · à envoyer', court: 'À envoyer', stock: false },
  { id: 'envoye', label: 'Envoyé', court: 'Envoyé', stock: false },
  { id: 'finalise', label: 'Finalisé', court: 'Finalisé', stock: false },
  { id: 'retour', label: 'Retour / litige', court: 'Retour', stock: false },
  { id: 'sorti', label: 'Sorti du stock', court: 'Sorti', stock: false }
];

export const STATUT = Object.fromEntries(STATUTS.map((s) => [s.id, s]));
export const STATUTS_STOCK = STATUTS.filter((s) => s.stock).map((s) => s.id);
export const FLUX = ['a_completer', 'a_preparer', 'a_photographier', 'a_mettre_en_ligne', 'en_ligne', 'vendu', 'envoye', 'finalise'];

export function statutSuivant(statut) {
  const i = FLUX.indexOf(statut);
  if (i < 0 || i >= FLUX.length - 1) return null;
  // On ne passe pas « en ligne → vendu » d'un geste : il faut saisir le prix de vente.
  if (statut === 'en_ligne') return null;
  return FLUX[i + 1];
}

export const ETATS_VINTED = [
  'Neuf avec étiquette',
  'Neuf sans étiquette',
  'Très bon état',
  'Bon état',
  'Satisfaisant'
];

export const CATEGORIES = [
  'Jeans', 'Pantalons', 'Jupes', 'Robes', 'Tops et tee-shirts', 'Pulls et sweats',
  'Vestes et manteaux', 'Survêtements', 'Chaussures', 'Sacs', 'Accessoires', 'Lunettes', 'Autre'
];

export const MOTIFS_SORTIE = ['Donné', 'Jeté', 'Vendu en lot', 'Autre'];

export const TYPES_TEMPS = {
  sourcing: 'Sourcing',
  preparation: 'Préparation',
  photos: 'Photos',
  annonces: 'Annonces',
  envois: 'Envois',
  autre: 'Autre'
};

export const TYPES_MOUVEMENT = {
  apport: 'Apport',
  virement_vinted: 'Virement Vinted → banque',
  retrait_perso: 'Retrait pour moi',
  depense: 'Dépense'
};

// Valeurs par défaut issues de ton brief et de tes réponses.
export function settingsParDefaut(aujourdhui) {
  return {
    id: 'main',
    appName: 'VintedFlow',
    creeLe: aujourdhui,
    objectif: 1000,
    statut: 'particulier', // ou 'micro'
    cotisations: { taux: 0.123, tauxAcre: 0.093, acre: false },
    hypotheses: { achatMoyen: 4, reventeMoyenne: 18, emballage: 0.5 },
    // Paramètres de discipline : leurs modifications s'appliquent le lundi suivant.
    discipline: {
      minRevente: 15,
      multiple: 4,
      budgetHebdo: 125,
      reserve: 150,
      piecesMax: 15,
      sortiesMaxSemaine: 4
    },
    pending: null, // { effectiveFrom: 'AAAA-MM-JJ', values: { … } }
    transport: {
      ticket: 2,
      voiDeblocage: 1.5,
      voiMinute: 0.35,
      voiMinutesGratuites: 20,
      voiAbonnement: 4
    },
    delaiEnLigne: 30,
    delaiEnvoiJoursOuvres: 5,
    maison: 'Saint-Pierre / Sainte-Thérèse (Timone)',
    domicile: null, // { label, lat, lon }
    journee: {
      semaine: [
        { type: 'preparation', debut: '09:00', fin: '11:00' },
        { type: 'envois', debut: '11:30', fin: '12:00' },
        { type: 'sourcing', debut: '14:00', fin: '17:00' },
        { type: 'annonces', debut: '17:00', fin: '18:30' }
      ],
      weekend: [
        { type: 'sourcing', debut: '05:30', fin: '12:00' },
        { type: 'preparation', debut: '14:30', fin: '16:00' },
        { type: 'annonces', debut: '16:00', fin: '17:00' }
      ]
    },
    gemini: { modele: 'gemini-3.5-flash-lite' },
    temps: { pro: { semaine: 420, weekend: 360 }, perso: { semaine: 150, weekend: 240 } },
    exemplesCharges: false
  };
}

export function nouvelId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function maintenant() {
  return new Date().toISOString();
}
