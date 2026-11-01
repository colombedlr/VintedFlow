// Règles d'achat : le feu vert / orange / rouge.

export const arrondiInf50 = (n) => Math.floor(n * 2 + 1e-9) / 2;

// Prix maximum à payer par pièce pour une revente donnée.
export function prixMaxParPiece(revente, regle) {
  if (!(revente >= regle.minRevente)) return 0;
  return arrondiInf50(revente / regle.multiple);
}

/**
 * Verdict pour un achat (une pièce ou un lot).
 * @param {object} p
 *  prix         prix demandé total
 *  revente      revente estimée par pièce
 *  nb           nombre de pièces (1 par défaut)
 *  regle        { minRevente, multiple }
 *  budgetRestant  null si pas de sortie en cours
 *  piecesRestantes null si pas de sortie en cours
 *  controleRequis  true si la marque demande les 4 contrôles contrefaçon
 *  controleOk      true si les 4 contrôles sont cochés
 *  doute           true si un doute contrefaçon a été déclaré
 */
export function verdict(p) {
  const nb = Math.max(1, p.nb || 1);
  const prix = Number(p.prix) || 0;
  const rev = Number(p.revente) || 0;
  const coutPiece = prix / nb;
  const maxPiece = prixMaxParPiece(rev, p.regle);
  const maxTotal = arrondiInf50(maxPiece * nb);
  const maxPayable = p.budgetRestant == null ? maxTotal : Math.min(maxTotal, arrondiInf50(p.budgetRestant));
  const base = { maxPiece, maxTotal, maxPayable, coutPiece };

  if (p.doute) {
    return { ...base, kind: 'rouge', code: 'doute', titre: 'PASSE', texte: 'Un doute sur l’authenticité : pas d’achat.' };
  }
  if (p.piecesRestantes != null && p.piecesRestantes < nb) {
    return { ...base, kind: 'rouge', code: 'sacs', titre: 'SACS PLEINS', texte: p.piecesRestantes <= 0 ? 'Tu as atteint ta limite de pièces pour cette sortie.' : `Tu ne peux plus porter que ${p.piecesRestantes} pièce${p.piecesRestantes > 1 ? 's' : ''}.` };
  }
  if (rev < p.regle.minRevente) {
    return { ...base, kind: 'rouge', code: 'min', titre: 'PASSE', texte: `Moins de ${p.regle.minRevente} € à la revente : cette pièce ne passe pas la règle, quel que soit son prix.` };
  }
  if (p.budgetRestant != null && prix > p.budgetRestant + 1e-9) {
    if (maxPayable > 0 && maxPayable < prix && prix <= maxTotal) {
      return { ...base, kind: 'orange', code: 'budget', titre: 'NÉGOCIE', texte: `Il te reste ${fmtE(p.budgetRestant)} : achète seulement à ${fmtE(maxPayable)} maximum.` };
    }
    return { ...base, kind: 'rouge', code: 'budget', titre: 'HORS BUDGET', texte: `Il te reste ${fmtE(p.budgetRestant)} pour cette sortie.` };
  }
  if (coutPiece * p.regle.multiple > rev + 1e-9) {
    if (maxPayable <= 0) {
      return { ...base, kind: 'rouge', code: 'marge', titre: 'PASSE', texte: 'La marge ne passe pas la règle.' };
    }
    return { ...base, kind: 'orange', code: 'marge', titre: 'NÉGOCIE', texte: `À ${fmtE(prix)}, la marge est trop faible. Achète seulement à ${fmtE(maxPayable)} maximum.` };
  }
  if (p.controleRequis && !p.controleOk) {
    return { ...base, kind: 'orange', code: 'controle', titre: 'CONTRÔLE', texte: 'Marque souvent copiée : coche les 4 contrôles pour débloquer l’achat.' };
  }
  const gain = rev * nb - prix - (p.emballage ?? 0.5) * nb;
  const ratio = coutPiece > 0 ? Math.round((rev / coutPiece) * 10) / 10 : null;
  return {
    ...base,
    kind: 'vert',
    code: 'ok',
    titre: 'ACHÈTE',
    texte: `Bénéfice estimé ${fmtE(Math.round(gain * 2) / 2)}${ratio ? ` · revente ${String(ratio).replace('.', ',')} × le prix` : ''}.`
  };
}

export function fmtE(n) {
  if (n == null || Number.isNaN(n)) return '–';
  const r = Math.round(n * 100) / 100;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(2).replace('.', ',');
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
}
