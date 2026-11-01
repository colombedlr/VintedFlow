// Analyse avec l'app Claude ou ChatGPT (abonnements existants) via la feuille de partage.
// La réponse est ensuite collée dans VintedFlow, qui la lit automatiquement.

export const CONSIGNE_ASSISTANT = `Je revends des vêtements et chaussures vintage / Y2K (années 2000) sur Vinted France. Je suis en brocante, j'hésite à acheter la pièce sur les photos.
Réponds UNIQUEMENT avec ces 7 lignes, sans rien d'autre :
PIECE: (type de pièce, ex. jean taille basse)
MARQUE: (marque lisible, ou inconnue)
POTENTIEL: fort, moyen ou faible
REVENTE: min-max (prix de vente réalistes constatés sur Vinted France, en euros, ex. 20-30)
CONTREFACON: faible, moyen ou eleve
SIGNAUX: (ce que tu vois qui rassure ou inquiète, en une ligne)
A VERIFIER: (ce que je dois contrôler à la main, en une ligne)
Sois prudent : tu donnes des indices, pas une authentification.`;

function fichierDepuis(dataUrl, nom) {
  const [tete, b64] = dataUrl.split(',');
  const type = tete.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  return new File([octets], nom, { type });
}

async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

// Renvoie 'partage' si la feuille de partage s'est ouverte, 'copie' si seule la consigne a été copiée.
export async function partagerAAssistant(photos, indice = '') {
  const texte = CONSIGNE_ASSISTANT + (indice ? `\nIndice : ${indice}` : '');
  const fichiers = photos.map((p, i) => fichierDepuis(p.photo, `piece-${i + 1}.jpg`));
  // La consigne est aussi copiée : certaines apps ne reprennent que les images.
  await copier(texte);
  if (navigator.canShare && navigator.canShare({ files: fichiers })) {
    try {
      await navigator.share({ files: fichiers, text: texte });
      return 'partage';
    } catch (e) {
      if (e?.name === 'AbortError') return 'annule';
    }
  }
  return 'copie';
}

const pick = (txt, cle) => {
  const m = txt.match(new RegExp(`^\\s*\\**\\s*${cle}\\s*\\**\\s*[:：]\\s*(.+)$`, 'im'));
  return m ? m[1].replace(/\*+/g, '').trim() : '';
};

const niveau = (v, defaut) => {
  const n = (v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('elev') || n.includes('haut')) return 'eleve';
  if (n.includes('moy')) return 'moyen';
  if (n.includes('fort')) return 'fort';
  if (n.includes('faib') || n.includes('bas')) return 'faible';
  return defaut;
};

// Lit la réponse collée. Renvoie null si elle ne contient pas de fourchette de revente.
export function lireReponse(txt) {
  if (!txt) return null;
  const rev = pick(txt, 'REVENTE');
  const nombres = (rev.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => Number(x.replace(',', '.')));
  if (!nombres.length) return null;
  const min = Math.min(...nombres.slice(0, 2));
  const max = Math.max(...nombres.slice(0, 2));
  const marque = pick(txt, 'MARQUE');
  return {
    titre: pick(txt, 'PIECE') || pick(txt, 'PIÈCE') || 'Pièce',
    marque: /inconnu|aucune|illisible|^-$/i.test(marque) ? '' : marque,
    potentiel: niveau(pick(txt, 'POTENTIEL'), 'moyen'),
    revente_min: min,
    revente_max: max,
    risque_contrefacon: ((r) => (r === 'fort' ? 'eleve' : r))(niveau(pick(txt, 'CONTREFA[CÇ]ON'), 'moyen')),
    signaux: [pick(txt, 'SIGNAUX')].filter(Boolean),
    a_verifier: [pick(txt, 'A V[EÉ]RIFIER') || pick(txt, 'À V[EÉ]RIFIER')].filter(Boolean),
    source: 'assistant'
  };
}
