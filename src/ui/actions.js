// Actions communes sur les articles.
import { ajouterJoursOuvres, isoDate } from '../logic/dates.js';

export function changerStatut(store, a, statut, extra = {}) {
  const at = new Date().toISOString();
  const patch = { statut, historique: [...(a.historique || []), { statut, at }], ...extra };
  if (statut === 'en_ligne') {
    if (!a.enLigneAt || a.statut === 'retour') patch.enLigneAt = at;
    if (patch.prixAffiche == null && a.prixAffiche == null) patch.prixAffiche = a.revente ?? null;
  }
  if (statut === 'envoye') patch.envoyeAt = at;
  if (statut === 'finalise') patch.finaliseAt = at;
  store.patch('articles', a.id, patch);
}

export function enregistrerVente(store, a, prix, jour, s) {
  const at = jour === isoDate() ? new Date().toISOString() : new Date(`${jour}T12:00:00`).toISOString();
  changerStatut(store, a, 'vendu', {
    prixVente: Number(prix) || 0,
    venduAt: at,
    envoiLimite: ajouterJoursOuvres(jour, s.delaiEnvoiJoursOuvres || 5),
    envoyeAt: null,
    finaliseAt: null
  });
}

export function remettreEnLigne(store, a) {
  changerStatut(store, a, 'en_ligne', { prixVente: null, venduAt: null, envoiLimite: null, envoyeAt: null, finaliseAt: null });
}

export function sortirDuStock(store, a, motif, montant) {
  changerStatut(store, a, 'sorti', { sortie: { motif, montant: Number(montant) || 0, at: new Date().toISOString() } });
}

export function supprimerArticle(store, state, a) {
  for (const pid of a.photoIds || []) {
    const partagee = Object.values(state.articles).some((x) => x.id !== a.id && (x.photoIds || []).includes(pid));
    if (!partagee) store.removePhoto(pid);
  }
  store.remove('articles', a.id);
}
