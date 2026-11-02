// Pré-remplissage des lieux de sourcing à Marseille.
// Tout est marqué « à valider » : horaires et accès viennent de sources publiques parfois anciennes.
// jours : 0 = dimanche … 6 = samedi. semaines : n-ièmes jours du mois (ex. [1, 3] = 1er et 3e).
// acces.minutes : durée approximative depuis l'arrêt Saint-Pierre / Sainte-Thérèse (porte à porte).

export const LIEUX_MARSEILLE = [
  {
    id: 'brigaille',
    nom: 'Ressourcerie de Noailles – La Brigaille',
    type: 'ressourcerie',
    adresse: '47 rue d’Aubagne, 13001 Marseille',
    ouverture: [{ jours: [3, 4, 5, 6], debut: '10:00', fin: '19:00' }],
    heureIdeale: '10:00',
    acces: { mode: 'tram', ligne: 'T1', minutes: 22, detail: 'T1 Sainte-Thérèse → Noailles' }
  },
  {
    id: 'impulse-toit',
    nom: 'Impulse Toit – Ateliers Croix-Rouge',
    type: 'ressourcerie',
    adresse: '25 cours Julien, 13006 Marseille',
    ouverture: [{ jours: [2, 3, 4, 5, 6], debut: '09:30', fin: '17:30' }],
    heureIdeale: '10:00',
    acces: { mode: 'tram', ligne: 'T1', minutes: 25, detail: 'T1 Sainte-Thérèse → Noailles, puis 7 min à pied' }
  },
  {
    id: 'croix-rouge-baille',
    nom: 'Boutique solidaire Croix-Rouge (Baille)',
    type: 'solidaire',
    adresse: '90 boulevard Baille, 13005 Marseille',
    ouverture: [{ jours: [1, 2, 3, 4, 5], debut: '10:00', fin: '17:30' }],
    heureIdeale: '10:00',
    acces: { mode: 'pied', ligne: 'À pied', minutes: 15, detail: 'À pied, ou M1 Timone → Baille' }
  },
  {
    id: 'croix-rouge-camas',
    nom: 'Boutique solidaire Croix-Rouge (Camas)',
    type: 'solidaire',
    adresse: '137 rue du Camas, 13005 Marseille',
    ouverture: [{ jours: [1, 2, 3, 4], debut: '09:00', fin: '17:00' }, { jours: [5], debut: '09:00', fin: '12:00' }],
    heureIdeale: '09:00',
    acces: { mode: 'voi', ligne: 'Voi', minutes: 10, detail: 'Voi, ou 20 min à pied' }
  },
  {
    id: 'croix-rouge-escat',
    nom: 'Boutique solidaire Croix-Rouge (Docteur Escat)',
    type: 'solidaire',
    adresse: '20 rue du Docteur Escat, 13006 Marseille',
    ouverture: [{ jours: [1, 2, 3, 4, 5], debut: '10:00', fin: '17:30' }],
    heureIdeale: '10:00',
    acces: { mode: 'metro', ligne: 'M1', minutes: 20, detail: 'M1 Timone → Castellane, puis à pied' }
  },
  {
    id: 'r-fripe-godchot',
    nom: 'R Fripe – Friperies du Sud (Frères Godchot)',
    type: 'friperie',
    adresse: '23 boulevard des Frères Godchot, 13005 Marseille',
    ouverture: [],
    heureIdeale: '',
    acces: { mode: 'pied', ligne: 'À pied', minutes: 15, detail: 'À pied' },
    notes: 'Horaires à trouver. Friperie solidaire : vérifier que les prix laissent la marge.'
  },
  {
    id: 'recyclerie-sportive',
    nom: 'La Recyclerie Sportive (Bougainville)',
    type: 'ressourcerie',
    adresse: '29 boulevard de Briançon, 13003 Marseille',
    ouverture: [{ jours: [3], debut: '10:00', fin: '19:00' }, { jours: [5, 6], debut: '10:00', fin: '18:00' }],
    heureIdeale: '10:00',
    acces: { mode: 'metro', ligne: 'M1+M2', minutes: 30, detail: 'M1 Timone → Saint-Charles, M2 → Bougainville' },
    notes: 'Textile de sport : survêtements et vestes vintage possibles.'
  },
  {
    id: 'emmaus-saint-marcel',
    nom: 'Emmaüs Saint-Marcel',
    type: 'emmaus',
    adresse: '46 boulevard de la Cartonnerie, 13011 Marseille',
    ouverture: [{ jours: [2, 3, 4], debut: '14:00', fin: '17:30' }, { jours: [6], debut: '09:00', fin: '18:00' }],
    heureIdeale: '14:00',
    acces: { mode: 'bus', ligne: 'Bus', minutes: 40, detail: 'Itinéraire à valider' },
    notes: 'Tél. 04 91 89 40 66 pour confirmer les horaires.'
  },
  {
    id: 'emmaus-pointe-rouge',
    nom: 'Emmaüs Pointe Rouge',
    type: 'emmaus',
    adresse: '110 traverse Parangon, 13008 Marseille',
    ouverture: [],
    heureIdeale: '',
    acces: { mode: 'metro', ligne: 'M1+M2+bus', minutes: 50, detail: 'M1 → Castellane, M2 → Rond-point du Prado, puis bus (à valider)' },
    notes: 'Jours de vente à confirmer : 04 91 73 31 51.'
  },
  {
    id: 'puces-marseille',
    nom: 'Marché aux Puces de Marseille',
    type: 'puces',
    adresse: '130 chemin de la Madrague-Ville, 13015 Marseille',
    ouverture: [{ jours: [6, 0], debut: '07:30', fin: '14:00' }],
    heureIdeale: '07:30',
    acces: { mode: 'metro', ligne: 'M1+M2', minutes: 45, detail: 'M1 Timone → Saint-Charles, M2 → Bougainville, puis bus ou à pied' },
    notes: 'Brocante le week-end. Marché couvert du mardi au dimanche.'
  },
  {
    id: 'brocante-prado',
    nom: 'Brocante du rond-point du Prado',
    type: 'brocante',
    adresse: 'Rond-point du Prado, 13008 Marseille',
    ouverture: [{ jours: [6], debut: '07:00', fin: '13:00' }],
    heureIdeale: '07:00',
    acces: { mode: 'metro', ligne: 'M1+M2', minutes: 20, detail: 'M1 → Castellane, M2 → Rond-point du Prado' }
  },
  {
    id: 'brocante-cours-julien',
    nom: 'Brocante du Cours Julien',
    type: 'brocante',
    adresse: 'Cours Julien, 13006 Marseille',
    ouverture: [{ jours: [4], debut: '08:00', fin: '13:00' }],
    heureIdeale: '08:00',
    acces: { mode: 'tram', ligne: 'T1', minutes: 25, detail: 'T1 Sainte-Thérèse → Noailles, puis à pied' }
  },
  {
    id: 'vg-valentine',
    nom: 'Vide-grenier de La Valentine',
    type: 'vide-grenier',
    adresse: 'Parking Leroy Merlin, avenue François Chardigny, 13011 Marseille',
    ouverture: [{ jours: [0], debut: '06:00', fin: '13:00' }],
    heureIdeale: '06:30',
    acces: { mode: 'bus', ligne: 'Bus', minutes: 40, detail: 'Itinéraire à valider' }
  },
  {
    id: 'vg-vivaux',
    nom: 'Vide-grenier de l’hippodrome Marseille-Vivaux',
    type: 'vide-grenier',
    adresse: 'Hippodrome Marseille-Vivaux, 13010 Marseille',
    ouverture: [{ jours: [0], debut: '06:00', fin: '13:00' }],
    heureIdeale: '06:30',
    acces: { mode: 'bus', ligne: 'Bus', minutes: 30, detail: 'Itinéraire à valider' }
  },
  {
    id: 'vg-boule-rond-point',
    nom: 'Vide-greniers de la Boule du Rond-Point',
    type: 'vide-grenier',
    adresse: 'Avenue du Maréchal de Lattre de Tassigny, Marseille',
    ouverture: [{ jours: [6], semaines: [1, 3], debut: '07:00', fin: '13:00' }],
    heureIdeale: '07:00',
    acces: { mode: 'metro', ligne: 'M1+M2', minutes: 30, detail: 'À valider' }
  },
  {
    id: 'puces-fifi',
    nom: 'Les Puces de Fifi',
    type: 'vide-grenier',
    adresse: 'Marseille 10e (adresse à trouver)',
    ouverture: [{ jours: [0], semaines: [1], debut: '09:00', fin: '14:00' }],
    heureIdeale: '09:00',
    acces: { mode: 'bus', ligne: 'Bus', minutes: 25, detail: 'À valider' }
  },
  {
    id: 'mensuel-brocante-chanot',
    nom: 'Mensuel de la Brocante (Parc Chanot)',
    type: 'brocante',
    adresse: 'Parc Chanot, halls 6 et 7, 13008 Marseille',
    ouverture: [{ jours: [0], semaines: [1], debut: '08:00', fin: '17:00' }],
    heureIdeale: '08:00',
    acces: { mode: 'metro', ligne: 'M1+M2', minutes: 20, detail: 'M1 → Castellane, M2 → Rond-point du Prado' },
    notes: 'Plutôt antiquités : moins de vêtements.'
  }
];

export const TYPES_LIEU = {
  ressourcerie: 'Ressourcerie',
  solidaire: 'Boutique solidaire',
  emmaus: 'Emmaüs',
  friperie: 'Friperie',
  'friperie-kilo': 'Friperie au kilo',
  'depot-vente': 'Dépôt-vente',
  puces: 'Marché aux puces',
  brocante: 'Brocante',
  'vide-grenier': 'Vide-grenier',
  braderie: 'Braderie',
  autre: 'Autre'
};

export const MODES_ACCES = {
  pied: 'À pied',
  voi: 'Voi',
  tram: 'Tram',
  bus: 'Bus',
  metro: 'Métro'
};
