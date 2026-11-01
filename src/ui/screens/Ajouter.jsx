import { useState, useEffect } from 'preact/hooks';
import { useApp, aller, Feuille, Champ, Vignette, Bac, IconLoupe } from '../base.jsx';
import { liste, sortieEnCours, rechercherArticles, chercherMarques } from '../../logic/calc.js';
import { MouvementFeuille } from './Bilan.jsx';
import { VenteFeuille } from './Stock.jsx';
import { EditionTache } from './Taches.jsx';
import { fmtE } from '../../logic/rules.js';

export function MenuAjouter({ onClose }) {
  const { state, today } = useApp();
  const [vue, setVue] = useState('menu');
  const [article, setArticle] = useState(null);
  const [large, setLarge] = useState(false);
  useEffect(() => setLarge(window.matchMedia('(min-width: 900px)').matches), []);
  const enCours = sortieEnCours(state);
  const go = (chemin) => {
    onClose();
    aller(chemin);
  };

  if (vue === 'vente' && article) return <VenteFeuille a={article} onClose={onClose} />;
  if (vue === 'vente') return <ChoixArticle onClose={onClose} onChoix={setArticle} />;
  if (['depense', 'temps', 'virement_vinted', 'retrait_perso'].includes(vue)) return <MouvementFeuille type={vue} onClose={onClose} />;
  if (vue === 'horsregle') return <HorsRegle onClose={onClose} />;
  if (vue === 'tache') return <EditionTache init={{ type: 'pro', date: today, duree: 30 }} onClose={onClose} />;

  const options = [
    { id: 'verifier', titre: enCours ? 'Vérifier et acheter une pièce' : 'Vérifier une pièce', st: enCours ? 'Sortie en cours : budget et sacs suivis' : 'Le feu vert, orange ou rouge', go: () => go(enCours ? `/verifier?sortie=${enCours.id}` : '/verifier') },
    { id: 'tache', titre: 'Tâche perso ou pro', st: 'Placée dans ta journée, avec sa durée', go: () => setVue('tache') },
    { id: 'vente', titre: 'Enregistrer une vente', st: 'Lance le délai d’envoi de 5 jours ouvrés', go: () => setVue('vente') },
    { id: 'temps', titre: 'Temps travaillé', st: 'Pour ton bénéfice par heure', go: () => setVue('temps') },
    { id: 'depense', titre: 'Dépense', st: 'Boost, cintres, autre frais', go: () => setVue('depense') },
    { id: 'virement_vinted', titre: 'Virement Vinted → banque', st: 'Argent sorti du porte-monnaie Vinted', go: () => setVue('virement_vinted') },
    { id: 'retrait_perso', titre: 'Retrait pour moi', st: 'Argent que tu prends pour vivre', go: () => setVue('retrait_perso') },
    { id: 'marques', titre: 'Marques et contrefaçon', st: 'Potentiel, fourchette, contrôles', go: () => go('/marques') },
    { id: 'lieux', titre: 'Carnet des lieux', st: 'Ressourceries, puces, vide-greniers', go: () => go('/lieux') }
  ];
  if (large) options.push({ id: 'horsregle', titre: 'Achat hors règle', st: 'Pour que le stock reste juste. Compté dans ton bilan.', go: () => setVue('horsregle') });

  return (
    <Feuille titre="Ajouter" onClose={onClose}>
      {options.map((o) => (
        <button key={o.id} class="item" onClick={o.go} style={o.id === 'horsregle' ? 'border:2px solid var(--red)' : ''}>
          <span class="col grow">
            <span class="t">{o.titre}</span>
            <span class="st">{o.st}</span>
          </span>
        </button>
      ))}
    </Feuille>
  );
}

function ChoixArticle({ onClose, onChoix }) {
  const { state } = useApp();
  const [q, setQ] = useState('');
  const enLigne = liste(state.articles).filter((a) => a.statut === 'en_ligne');
  const resultats = (q.trim() ? rechercherArticles(state, q).filter((a) => a.statut === 'en_ligne') : enLigne).slice(0, 30);
  return (
    <Feuille titre="Quel article est vendu ?" onClose={onClose}>
      <label class="search">
        <IconLoupe size={20} />
        <span class="sr">Rechercher</span>
        <input type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Marque, pièce, bac…" autocomplete="off" />
      </label>
      {resultats.length === 0 && <p class="vide-etat">Aucun article en ligne ne correspond.</p>}
      {resultats.map((a) => (
        <button key={a.id} class="item" onClick={() => onChoix(a)}>
          <Vignette article={a} />
          <span class="col grow"><span class="t ellipsis">{a.titre}</span><span class="st">{[a.marque, a.taille, fmtE(a.prixAffiche)].filter(Boolean).join(' · ')}</span></span>
          <Bac bac={a.bac} />
        </button>
      ))}
    </Feuille>
  );
}

function HorsRegle({ onClose }) {
  const { store, state, today, toast } = useApp();
  const [f, setF] = useState({ titre: '', marque: '', cout: '', revente: '', lieuId: '', jour: today, raison: '' });
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const lieux = liste(state.lieux).sort((a, b) => a.nom.localeCompare(b.nom));
  const marques = f.marque ? chercherMarques(state, f.marque).slice(0, 4) : [];
  const valider = () => {
    const cout = Number(String(f.cout).replace(',', '.'));
    if (!f.titre.trim() || !(cout >= 0)) return toast('Indique au moins la pièce et son prix.');
    const at = new Date(`${f.jour}T12:00:00`).toISOString();
    store.put('articles', {
      titre: f.titre.trim(),
      marque: f.marque.trim(),
      cout,
      revente: Number(String(f.revente).replace(',', '.')) || null,
      statut: 'a_completer',
      achatAt: at,
      lieuId: f.lieuId || null,
      horsRegle: true,
      notes: f.raison ? `Hors règle : ${f.raison}` : 'Hors règle',
      bac: '',
      photoIds: [],
      historique: [{ statut: 'a_completer', at }]
    });
    toast('Enregistré en rouge dans ton bilan.');
    onClose();
  };
  return (
    <Feuille titre="Achat hors règle" onClose={onClose}>
      <div class="card danger tight"><span class="small">Cet achat n’a pas respecté la règle. Il est enregistré pour que ton stock et tes chiffres restent justes, et il apparaît en rouge dans ton bilan.</span></div>
      <Champ label="Pièce"><input class="input" value={f.titre} onInput={maj('titre')} /></Champ>
      <Champ label="Marque"><input class="input" value={f.marque} onInput={maj('marque')} /></Champ>
      {marques.length > 0 && marques[0].nom !== f.marque && <div class="chips">{marques.map((m) => <button key={m.nom} class="chip" style="font-size:14px" onClick={() => setF({ ...f, marque: m.nom })}>{m.nom}</button>)}</div>}
      <div class="grid2">
        <Champ label="Prix payé (€)"><input class="input" inputMode="decimal" value={f.cout} onInput={maj('cout')} /></Champ>
        <Champ label="Revente estimée (€)"><input class="input" inputMode="decimal" value={f.revente} onInput={maj('revente')} /></Champ>
      </div>
      <Champ label="Lieu">
        <select class="input" value={f.lieuId} onChange={maj('lieuId')}><option value="">—</option>{lieux.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}</select>
      </Champ>
      <Champ label="Date"><input class="input" type="date" value={f.jour} max={today} onInput={maj('jour')} /></Champ>
      <Champ label="Pourquoi ? (pour en tirer une leçon)"><input class="input" value={f.raison} onInput={maj('raison')} /></Champ>
      <button class="btn danger" onClick={valider}>Enregistrer hors règle</button>
    </Feuille>
  );
}
