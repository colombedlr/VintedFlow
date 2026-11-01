// Analyse photo et fiche marque avec Gemini (Firebase AI Logic). Nécessite du réseau.
import { base64De } from '../util/photo.js';

let contexte = null; // { app, modele }

export function configurerIA(app, modele) {
  contexte = app ? { app, modele: modele || 'gemini-3.5-flash-lite' } : null;
}

export function iaDisponible() {
  return !!contexte && (typeof navigator === 'undefined' || navigator.onLine);
}

async function modele(schemaFn) {
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import('firebase/ai');
  const ai = getAI(contexte.app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: contexte.modele,
    generationConfig: { responseMimeType: 'application/json', responseSchema: schemaFn(Schema), temperature: 0.2 }
  });
}

const CONSIGNE_PHOTO = `Tu aides un revendeur de vêtements et chaussures vintage et Y2K (années 2000) sur Vinted en France.
On te montre des photos prises dans une brocante : la pièce, et souvent son étiquette ou son logo.
Réponds en français, en JSON, de façon prudente :
- identifie le type de pièce, la marque si elle est lisible, l'époque probable et l'état apparent ;
- estime une fourchette de revente réaliste sur Vinted France (prix de vente constatés, pas prix demandés), en euros ;
- évalue le potentiel pour la revente Y2K (fort, moyen ou faible) ;
- évalue le risque de contrefaçon (faible, moyen ou eleve) et liste ce que tu as vu sur les photos (signaux), puis ce qu'il faut vérifier à la main ;
- n'affirme jamais qu'une pièce est authentique : tu donnes des indices, pas une authentification ;
- si tu ne vois pas assez, dis-le et reste bas dans la fourchette.`;

export async function analyserPhotos(dataUrls, indice = '') {
  if (!contexte) throw new Error('L’analyse photo n’est pas encore configurée.');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Pas de réseau : utilise la fiche marque, elle marche hors ligne.');
  const m = await modele((S) =>
    S.object({
      properties: {
        titre: S.string({ description: 'Titre court de la pièce, ex. « Jean taille basse »' }),
        categorie: S.string(),
        marque: S.string({ description: 'Marque lisible, ou chaîne vide' }),
        epoque: S.string(),
        etat: S.string({ description: 'Un des états Vinted : Neuf avec étiquette, Neuf sans étiquette, Très bon état, Bon état, Satisfaisant' }),
        potentiel: S.enumString({ enum: ['fort', 'moyen', 'faible'] }),
        revente_min: S.number(),
        revente_max: S.number(),
        risque_contrefacon: S.enumString({ enum: ['faible', 'moyen', 'eleve'] }),
        signaux: S.array({ items: S.string() }),
        a_verifier: S.array({ items: S.string() }),
        commentaire: S.string()
      },
      optionalProperties: ['commentaire', 'epoque']
    })
  );
  const parts = [
    { text: CONSIGNE_PHOTO + (indice ? `\nIndice du revendeur : ${indice}` : '') },
    ...dataUrls.map((u) => ({ inlineData: { mimeType: 'image/jpeg', data: base64De(u) } }))
  ];
  const res = await m.generateContent(parts);
  return JSON.parse(res.response.text());
}

export async function analyserMarque(nom) {
  if (!contexte) throw new Error('La recherche en ligne n’est pas encore configurée.');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Pas de réseau.');
  const m = await modele((S) =>
    S.object({
      properties: {
        nom: S.string(),
        connue: S.boolean(),
        cat: S.string({ description: 'Types de pièces typiques' }),
        pot: S.enumString({ enum: ['fort', 'moyen', 'faible'] }),
        lo: S.number(),
        hi: S.number(),
        risque: S.enumString({ enum: ['faible', 'moyen', 'eleve'] }),
        note: S.string()
      }
    })
  );
  const res = await m.generateContent(
    `Pour un revendeur vintage et Y2K sur Vinted France, donne une fiche prudente pour la marque « ${nom} » : ` +
      'potentiel de revente (fort, moyen, faible), fourchette de prix de revente constatés en euros (lo, hi), ' +
      'risque de contrefaçon (faible, moyen, eleve) et une note courte en français sur ce qui se vend et ce qu’il faut vérifier. ' +
      'Si tu ne connais pas la marque, mets connue à false et reste prudent (potentiel faible).'
  );
  return JSON.parse(res.response.text());
}
