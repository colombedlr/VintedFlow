// Export de toutes les données en Excel (.xlsx) ou CSV.
import { STATUT } from '../data/schema.js';
import { liste } from '../logic/calc.js';

const jour = (x) => (x ? new Date(x).toLocaleDateString('fr-FR') : '');

function lignesArticles(state) {
  return liste(state.articles).map((a) => ({
    'Article': a.titre || '',
    'Marque': a.marque || '',
    'Catégorie': a.categorie || '',
    'Taille': a.taille || '',
    'État': a.etat || '',
    'Bac': a.bac || '',
    'Statut': STATUT[a.statut]?.label || a.statut,
    'Coût (€)': a.cout ?? '',
    'Revente estimée (€)': a.revente ?? '',
    'Prix affiché (€)': a.prixAffiche ?? '',
    'Prix de vente (€)': a.prixVente ?? '',
    'Acheté le': jour(a.achatAt),
    'Lieu': state.lieux[a.lieuId]?.nom || '',
    'En ligne le': jour(a.enLigneAt),
    'Vendu le': jour(a.venduAt),
    'Envoi avant le': a.envoiLimite ? new Date(a.envoiLimite).toLocaleDateString('fr-FR') : '',
    'Envoyé le': jour(a.envoyeAt),
    'Finalisé le': jour(a.finaliseAt),
    'Hors règle': a.horsRegle ? 'oui' : '',
    'Lot': a.lotId || '',
    'Exemple': a.demo ? 'oui' : '',
    'Notes': a.notes || '',
    'Identifiant': a.id
  }));
}

function lignesLieux(state) {
  return liste(state.lieux).map((l) => ({
    'Nom': l.nom,
    'Type': l.type,
    'Adresse': l.adresse || '',
    'Heure idéale': l.heureIdeale || '',
    'Accès': l.acces?.detail || '',
    'Minutes': l.acces?.minutes ?? '',
    'À valider': l.aValider ? 'oui' : '',
    'Notes': l.notes || ''
  }));
}

function lignesSorties(state) {
  return liste(state.sorties).map((s) => ({
    'Date': s.date,
    'Heure': s.heure || '',
    'Lieux': (s.lieuxIds || []).map((id) => state.lieux[id]?.nom || id).join(' → '),
    'Budget (€)': s.budget ?? '',
    'Pièces max': s.piecesMax ?? '',
    'Statut': s.statut || '',
    'Début': s.debutAt ? new Date(s.debutAt).toLocaleString('fr-FR') : '',
    'Fin': s.finAt ? new Date(s.finAt).toLocaleString('fr-FR') : '',
    'Transport (€)': s.transportCout ?? ''
  }));
}

function lignesMouvements(state) {
  return liste(state.mouvements).map((m) => ({ 'Date': m.date, 'Type': m.type, 'Montant (€)': m.montant, 'Note': m.note || '' }));
}

function lignesTemps(state) {
  return liste(state.temps).map((t) => ({
    'Date': t.date || jour(t.debutAt),
    'Type': t.type,
    'Minutes': Math.round(t.minutes ?? ((new Date(t.finAt) - new Date(t.debutAt)) / 60000 || 0)),
    'Lieu': state.lieux[t.lieuId]?.nom || ''
  }));
}

function telecharger(nom, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const horodatage = () => new Date().toISOString().slice(0, 10);

export async function exporterExcel(state) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const feuilles = [
    ['Articles', lignesArticles(state)],
    ['Lieux', lignesLieux(state)],
    ['Sorties', lignesSorties(state)],
    ['Argent', lignesMouvements(state)],
    ['Temps', lignesTemps(state)],
    ['Tâches', liste(state.taches).map((t) => ({ 'Tâche': t.titre, 'Type': t.type, 'Jour': t.date || '', 'Chaque semaine': (t.jours || []).join(','), 'Heure': t.heure || '', 'Durée (min)': t.duree, 'Importante': t.importante ? 'oui' : '', 'Faite': t.fait ? 'oui' : '' }))]
  ];
  for (const [nom, lignes] of feuilles) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lignes.length ? lignes : [{ '': 'Aucune donnée' }]), nom);
  }
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  telecharger(`VintedFlow-${horodatage()}.xlsx`, new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

export function exporterCSV(state) {
  const lignes = lignesArticles(state);
  if (!lignes.length) return;
  const cols = Object.keys(lignes[0]);
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [cols.join(';'), ...lignes.map((l) => cols.map((c) => esc(l[c])).join(';'))].join('\n');
  telecharger(`VintedFlow-articles-${horodatage()}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

export function exporterJSON(state) {
  const data = JSON.stringify(state, null, 1);
  telecharger(`VintedFlow-sauvegarde-${horodatage()}.json`, new Blob([data], { type: 'application/json' }));
}
