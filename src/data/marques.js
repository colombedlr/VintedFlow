// Catalogue de départ des marques (estimations prudentes pour Vinted France).
// pot : potentiel ('fort' | 'moyen' | 'faible')
// lo / hi : fourchette de revente de départ, en euros, remplacée par tes ventes dès que tu en as.
// risque : risque de contrefaçon ('faible' | 'moyen' | 'eleve')
// Les chiffres sont des points de départ à valider, pas des prix garantis.

export const CATALOGUE_MARQUES = [
  // Y2K / vintage femme
  { nom: 'Juicy Couture', cat: 'Survêtements, velours', pot: 'fort', lo: 25, hi: 60, risque: 'eleve', note: 'Le velours d’époque se vend bien, les rééditions beaucoup moins. Tirette de zip et étiquettes d’époque à contrôler.' },
  { nom: 'Miss Sixty', alias: ['misssixty', 'miss 60'], cat: 'Jeans, tops', pot: 'fort', lo: 20, hi: 40, risque: 'faible', note: 'Jeans taille basse et pattes d’eph très recherchés.' },
  { nom: 'Killah', cat: 'Jeans, tops', pot: 'moyen', lo: 15, hi: 30, risque: 'faible', note: 'Même groupe que Miss Sixty.' },
  { nom: 'Energie', cat: 'Jeans', pot: 'moyen', lo: 15, hi: 30, risque: 'faible' },
  { nom: 'Morgan', alias: ['morgan de toi'], cat: 'Tops, robes', pot: 'moyen', lo: 12, hi: 25, risque: 'faible', note: 'Pièces à logo et strass Y2K = haut de fourchette.' },
  { nom: 'Kookaï', alias: ['kookai'], cat: 'Tops, robes, sacs', pot: 'moyen', lo: 12, hi: 25, risque: 'faible' },
  { nom: 'Naf Naf', alias: ['nafnaf'], cat: 'Tops, vestes', pot: 'moyen', lo: 12, hi: 25, risque: 'faible', note: 'Seulement les pièces vintage, pas le récent.' },
  { nom: 'Cop Copine', cat: 'Tops, robes', pot: 'moyen', lo: 15, hi: 35, risque: 'faible' },
  { nom: 'Le Temps des Cerises', alias: ['ltdc'], cat: 'Jeans, vestes', pot: 'moyen', lo: 18, hi: 35, risque: 'faible' },
  { nom: 'Sinéquanone', alias: ['sinequanone'], cat: 'Tops, vestes', pot: 'moyen', lo: 15, hi: 30, risque: 'faible' },
  { nom: 'Fornarina', cat: 'Tops, chaussures', pot: 'moyen', lo: 18, hi: 40, risque: 'faible' },
  { nom: 'Guess', cat: 'Jeans, sacs, tops', pot: 'moyen', lo: 18, hi: 45, risque: 'moyen', note: 'Sacs Guess souvent copiés.' },
  { nom: 'Baby Phat', cat: 'Survêtements, tops', pot: 'fort', lo: 25, hi: 60, risque: 'moyen', note: 'Logo chat et strass recherchés.' },
  { nom: 'Playboy', cat: 'Tops, accessoires', pot: 'moyen', lo: 15, hi: 35, risque: 'moyen' },
  { nom: 'Paul Frank', cat: 'Tops, accessoires', pot: 'moyen', lo: 15, hi: 35, risque: 'moyen' },
  { nom: 'Hello Kitty', alias: ['sanrio'], cat: 'Tops, accessoires', pot: 'moyen', lo: 15, hi: 35, risque: 'moyen' },
  { nom: 'Roxy', cat: 'Tops, sweats', pot: 'moyen', lo: 15, hi: 30, risque: 'faible' },
  { nom: 'Kipling', cat: 'Sacs', pot: 'moyen', lo: 15, hi: 35, risque: 'moyen', note: 'Vérifier le petit singe et les étiquettes intérieures.' },
  { nom: 'Longchamp', cat: 'Sacs', pot: 'fort', lo: 30, hi: 70, risque: 'eleve', note: 'Très copié : étiquette intérieure, gravure des pressions, cuir des anses.' },

  // Y2K / streetwear / sport
  { nom: 'Von Dutch', alias: ['vondutch'], cat: 'Casquettes, tee-shirts', pot: 'fort', lo: 20, hi: 50, risque: 'eleve', note: 'Énormément de faux depuis 2004-2005. Étiquettes, broderie et placement du logo à contrôler.' },
  { nom: 'Ed Hardy', alias: ['edhardy', 'christian audigier'], cat: 'Tee-shirts, casquettes', pot: 'fort', lo: 20, hi: 50, risque: 'eleve', note: 'Vintage 2004-2009 recherché, rééditions bien moins chères.' },
  { nom: 'Christian Audigier', cat: 'Tee-shirts', pot: 'moyen', lo: 20, hi: 45, risque: 'eleve' },
  { nom: 'True Religion', alias: ['truereligion'], cat: 'Jeans', pot: 'fort', lo: 30, hi: 70, risque: 'moyen', note: 'Coutures « Super T » et fer à cheval. Vérifier l’entrejambe.' },
  { nom: 'Diesel', cat: 'Jeans, vestes', pot: 'fort', lo: 25, hi: 60, risque: 'moyen' },
  { nom: 'Levi’s', alias: ['levis', "levi's", 'levi s'], cat: 'Jeans', pot: 'moyen', lo: 20, hi: 45, risque: 'faible', note: '501 vintage et taille basse Y2K = haut de fourchette.' },
  { nom: 'Pepe Jeans', cat: 'Jeans', pot: 'faible', lo: 12, hi: 25, risque: 'faible' },
  { nom: 'Rocawear', cat: 'Tee-shirts, vestes', pot: 'moyen', lo: 20, hi: 45, risque: 'moyen' },
  { nom: 'Sean John', cat: 'Velours, vestes', pot: 'moyen', lo: 20, hi: 45, risque: 'moyen' },
  { nom: 'Carhartt', cat: 'Vestes, pantalons', pot: 'fort', lo: 25, hi: 60, risque: 'moyen' },
  { nom: 'Nike', cat: 'Baskets, survêtements', pot: 'fort', lo: 25, hi: 80, risque: 'eleve', note: 'Shox, TN, Air Max vintage et vestes rétro. Baskets très copiées : semelle, étiquette intérieure, code produit.' },
  { nom: 'Adidas', cat: 'Survêtements, baskets', pot: 'fort', lo: 20, hi: 60, risque: 'moyen', note: 'Vestes de survêtement vintage, Samba, Gazelle.' },
  { nom: 'Puma', cat: 'Baskets, survêtements', pot: 'moyen', lo: 20, hi: 50, risque: 'moyen', note: 'Mostro et pièces vintage recherchées.' },
  { nom: 'Kappa', cat: 'Survêtements', pot: 'moyen', lo: 18, hi: 40, risque: 'moyen' },
  { nom: 'Fila', cat: 'Survêtements, baskets', pot: 'moyen', lo: 18, hi: 40, risque: 'moyen' },
  { nom: 'Ellesse', cat: 'Survêtements', pot: 'moyen', lo: 18, hi: 35, risque: 'faible' },
  { nom: 'Le Coq Sportif', cat: 'Survêtements', pot: 'moyen', lo: 18, hi: 35, risque: 'faible' },
  { nom: 'Lacoste', cat: 'Polos, survêtements', pot: 'moyen', lo: 20, hi: 50, risque: 'eleve', note: 'Crocodile, étiquette de taille et boutons à contrôler.' },
  { nom: 'Ralph Lauren', alias: ['polo ralph lauren'], cat: 'Polos, pulls', pot: 'moyen', lo: 20, hi: 50, risque: 'eleve', note: 'Logo brodé, étiquettes et finitions à contrôler.' },
  { nom: 'Tommy Hilfiger', alias: ['tommy'], cat: 'Vestes, sweats', pot: 'moyen', lo: 18, hi: 45, risque: 'moyen' },
  { nom: 'Quiksilver', cat: 'Tee-shirts, vestes', pot: 'faible', lo: 12, hi: 25, risque: 'faible' },
  { nom: 'Billabong', cat: 'Tee-shirts, vestes', pot: 'faible', lo: 12, hi: 25, risque: 'faible' },
  { nom: 'Rip Curl', cat: 'Tee-shirts, vestes', pot: 'faible', lo: 12, hi: 25, risque: 'faible' },

  // Chaussures et accessoires
  { nom: 'Buffalo', cat: 'Chaussures plateformes', pot: 'fort', lo: 30, hi: 70, risque: 'moyen', note: 'Plateformes Y2K très recherchées.' },
  { nom: 'Steve Madden', cat: 'Chaussures', pot: 'moyen', lo: 20, hi: 45, risque: 'faible' },
  { nom: 'Skechers', cat: 'Baskets', pot: 'moyen', lo: 15, hi: 35, risque: 'faible', note: 'Modèles plateforme 2000 seulement.' },
  { nom: 'Dr. Martens', alias: ['doc martens', 'dr martens'], cat: 'Chaussures', pot: 'fort', lo: 35, hi: 80, risque: 'moyen' },
  { nom: 'Timberland', cat: 'Chaussures', pot: 'moyen', lo: 30, hi: 70, risque: 'moyen' },
  { nom: 'UGG', cat: 'Bottes', pot: 'moyen', lo: 25, hi: 60, risque: 'eleve' },
  { nom: 'Oakley', cat: 'Lunettes', pot: 'fort', lo: 30, hi: 90, risque: 'eleve', note: 'Lunettes enveloppantes vintage recherchées, très copiées.' },
  { nom: 'Coach', cat: 'Sacs', pot: 'fort', lo: 40, hi: 100, risque: 'eleve', note: 'Monogramme vintage recherché. Authentification sérieuse conseillée.' },

  // Luxe (prudence maximale)
  { nom: 'Dolce & Gabbana', alias: ['d&g', 'dolce gabbana'], cat: 'Vêtements, accessoires', pot: 'fort', lo: 40, hi: 120, risque: 'eleve', note: 'Luxe : authentification professionnelle conseillée.' },
  { nom: 'Burberry', cat: 'Vêtements, accessoires', pot: 'fort', lo: 40, hi: 120, risque: 'eleve', note: 'Luxe : authentification professionnelle conseillée.' },
  { nom: 'Dsquared2', alias: ['dsquared'], cat: 'Jeans, vêtements', pot: 'fort', lo: 40, hi: 100, risque: 'eleve' },
  { nom: 'Louis Vuitton', alias: ['lv'], cat: 'Sacs, accessoires', pot: 'fort', lo: 80, hi: 300, risque: 'eleve', note: 'Marque la plus copiée. Sans preuve d’authenticité : passe.' },
  { nom: 'Gucci', cat: 'Sacs, accessoires', pot: 'fort', lo: 80, hi: 300, risque: 'eleve', note: 'Très copiée. Sans preuve d’authenticité : passe.' },
  { nom: 'Chanel', cat: 'Accessoires', pot: 'fort', lo: 80, hi: 300, risque: 'eleve', note: 'Très copiée. Sans preuve d’authenticité : passe.' },

  // Petits prix : ne passent généralement pas la règle des 15 €
  { nom: 'Jennyfer', cat: 'Tops', pot: 'faible', lo: 4, hi: 10, risque: 'faible', note: 'Revente sous 15 € : ne passe pas la règle.' },
  { nom: 'Pimkie', cat: 'Tops', pot: 'faible', lo: 4, hi: 10, risque: 'faible', note: 'Revente sous 15 € : ne passe pas la règle.' },
  { nom: 'Promod', cat: 'Tops, robes', pot: 'faible', lo: 5, hi: 12, risque: 'faible', note: 'Revente sous 15 € : ne passe pas la règle.' },
  { nom: 'Camaïeu', alias: ['camaieu'], cat: 'Tops, robes', pot: 'faible', lo: 4, hi: 10, risque: 'faible', note: 'Revente sous 15 € : ne passe pas la règle.' },
  { nom: 'H&M', alias: ['hm', 'h et m'], cat: 'Tout', pot: 'faible', lo: 4, hi: 12, risque: 'faible', note: 'Sauf collaborations avec des créateurs.' },
  { nom: 'Bershka', cat: 'Tout', pot: 'faible', lo: 5, hi: 14, risque: 'faible' },
  { nom: 'Zara', cat: 'Tout', pot: 'moyen', lo: 8, hi: 25, risque: 'faible', note: 'Se vend surtout récent (moins de 18 mois), peu en Y2K.' },
  { nom: 'Shein', cat: 'Tout', pot: 'faible', lo: 2, hi: 6, risque: 'faible', note: 'Ne passe jamais la règle.' }
];

// Les 4 contrôles contrefaçon communs à toutes les marques.
export const CONTROLES_CONTREFACON = [
  { id: 'etiq', label: 'Étiquette de marque cousue droit, sans faute' },
  { id: 'compo', label: 'Étiquette de composition et de lavage présente' },
  { id: 'logo', label: 'Logo net : couleurs, proportions, broderie' },
  { id: 'fini', label: 'Finitions propres : coutures, fermeture' }
];

export function normaliser(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim();
}
