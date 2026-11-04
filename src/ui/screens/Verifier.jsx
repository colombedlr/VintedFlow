import { useState, useRef } from 'preact/hooks';
import { useApp, aller, IconRetour, IconCamera, IconTag, IconCheck, IconX, IconAlerte, IconHorsLigne, Etincelle } from '../base.jsx';
import { sortieEnCours, sortieStats, trouverMarque, reference, chercherMarques, liste } from '../../logic/calc.js';
import { verdict, fmtE } from '../../logic/rules.js';
import { CONTROLES_CONTREFACON } from '../../data/marques.js';
import { nouvelId } from '../../data/schema.js';
import { compresserPhoto } from '../../util/photo.js';
import { iaDisponible, analyserPhotos } from '../../ai/gemini.js';
import { partagerAAssistant, lireReponse } from '../../ai/assistant.js';

const CHIPS = [10, 15, 18, 20, 25, 30, 35, 40, 50, 60];
const RISQUE = { faible: ['green', 'faible'], moyen: ['orange', 'moyen'], eleve: ['red', 'élevé'] };
const ROLES = { piece: 'Pièce', etiquette: 'Étiquette', logo: 'Logo' };

export function Verifier() {
  const { store, state, s, today, route, toast } = useApp();
  const sortieId = route.params.sortie || sortieEnCours(state)?.id || null;
  const so = sortieId ? state.sorties[sortieId] : null;
  const actif = so && so.statut === 'en_cours' ? so : null;
  const st = actif ? sortieStats(state, actif) : null;

  const [photos, setPhotos] = useState([]);
  const [ia, setIa] = useState(null);
  const [iaEtat, setIaEtat] = useState('idle');
  const [iaErreur, setIaErreur] = useState('');
  const [marque, setMarque] = useState(route.params.marque || '');
  const [suggestions, setSuggestions] = useState(false);
  const [nb, setNb] = useState(1);
  const [prix, setPrix] = useState(3);
  const [revente, setRevente] = useState(null);
  const [controles, setControles] = useState({});
  const [doute, setDoute] = useState(false);
  const [enCoursPhoto, setEnCoursPhoto] = useState(false);
  const [assistant, setAssistant] = useState(null); // null | 'partage' | 'copie'
  const [reponse, setReponse] = useState('');
  const fileRef = useRef(null);
  const roleRef = useRef('piece');
  const hautRef = useRef(null);

  const nomMarque = marque || ia?.marque || '';
  const fiche = nomMarque ? trouverMarque(state, nomMarque) : null;
  const ref = reference(state, nomMarque, ia, today);
  const risque = fiche?.risque || ia?.risque_contrefacon || null;
  const controleRequis = risque === 'moyen' || risque === 'eleve';
  const controleOk = CONTROLES_CONTREFACON.every((c) => controles[c.id]);
  const cap = ref?.max ?? null;
  const reventeChoisie = revente ?? (ref ? Math.round((ref.min + ref.max) / 2) : null);
  const reventeUtilisee = reventeChoisie != null && cap != null ? Math.min(reventeChoisie, cap) : reventeChoisie;

  const v = reventeUtilisee == null
    ? null
    : verdict({
        prix,
        revente: reventeUtilisee,
        nb,
        regle: { minRevente: s.discipline.minRevente, multiple: s.discipline.multiple },
        budgetRestant: st ? st.budgetRestant : null,
        piecesRestantes: st ? st.piecesRestantes : null,
        controleRequis,
        controleOk,
        doute,
        emballage: s.hypotheses.emballage
      });

  const reinitialiser = () => {
    setPhotos([]);
    setIa(null);
    setIaEtat('idle');
    setIaErreur('');
    setMarque('');
    setNb(1);
    setPrix(3);
    setRevente(null);
    setControles({});
    setDoute(false);
    setAssistant(null);
    setReponse('');
    hautRef.current?.scrollIntoView({ block: 'start' });
  };

  const prendrePhoto = (role) => {
    roleRef.current = role;
    fileRef.current?.click();
  };

  const surFichier = async (e) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    setEnCoursPhoto(true);
    try {
      const { photo, vignette } = await compresserPhoto(f);
      setPhotos((ps) => [...ps.filter((p) => p.role !== roleRef.current), { role: roleRef.current, photo, vignette }]);
    } catch {
      toast('Photo illisible, réessaie.');
    } finally {
      setEnCoursPhoto(false);
    }
  };

  const analyser = async () => {
    setIaEtat('chargement');
    setIaErreur('');
    try {
      const r = await analyserPhotos(photos.map((p) => p.photo), marque ? `marque probable : ${marque}` : '');
      setIa(r);
      setIaEtat('ok');
      if (!marque && r.marque) setMarque(r.marque);
      setRevente(null);
    } catch (e) {
      setIaEtat('erreur');
      setIaErreur(e?.message || 'Analyse impossible.');
    }
  };

  const demanderAssistant = async () => {
    const r = await partagerAAssistant(photos, marque ? `marque probable : ${marque}` : '');
    if (r !== 'annule') setAssistant(r);
  };

  const appliquerReponse = (txt) => {
    setReponse(txt);
    const r = lireReponse(txt);
    if (!r) return false;
    setIa(r);
    setIaEtat('ok');
    setIaErreur('');
    if (!marque && r.marque) setMarque(r.marque);
    setRevente(null);
    setAssistant(null);
    setReponse('');
    toast('Réponse lue : référence de prix mise à jour.');
    return true;
  };

  const collerReponse = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (!appliquerReponse(txt)) toast('Je ne trouve pas la ligne « REVENTE » dans ce que tu as copié.');
    } catch {
      toast('Collage refusé : colle la réponse dans le champ ci-dessous.');
    }
  };

  const acheter = () => {
    if (!actif || v?.kind !== 'vert') return;
    const at = new Date().toISOString();
    const photoIds = photos.map((p) => {
      const pid = nouvelId();
      store.putPhoto(pid, p.photo, { role: p.role });
      return pid;
    });
    const thumb = (photos.find((p) => p.role === 'piece') || photos[0])?.vignette || null;
    const lotId = nb > 1 ? nouvelId() : null;
    const centimes = Math.round(prix * 100);
    const base = Math.floor(centimes / nb);
    const reste = centimes - base * nb;
    const titreBase = ia?.titre || (nomMarque ? `Pièce ${nomMarque}` : 'Pièce à compléter');
    for (let i = 0; i < nb; i++) {
      store.put('articles', {
        titre: nb > 1 ? `${titreBase} (lot ${i + 1}/${nb})` : titreBase,
        marque: nomMarque,
        categorie: ia?.categorie || '',
        etat: ia?.etat || '',
        taille: '',
        cout: (base + (i < reste ? 1 : 0)) / 100,
        revente: reventeUtilisee,
        refMin: ref?.min ?? null,
        refMax: ref?.max ?? null,
        refSource: ref?.source ?? null,
        bac: '',
        statut: 'a_completer',
        achatAt: at,
        sortieId: actif.id,
        origine: 'sortie',
        compte: s.statut === 'micro' ? 'pro' : 'particulier',
        tags: [],
        lieuId: actif.lieuActuel || (actif.lieuxIds || [])[0] || null,
        photoIds,
        thumb,
        lotId,
        controle: controleRequis ? { ...controles } : null,
        ia: ia ? { titre: ia.titre, potentiel: ia.potentiel, revente_min: ia.revente_min, revente_max: ia.revente_max, risque: ia.risque_contrefacon, signaux: ia.signaux || [], a_verifier: ia.a_verifier || [] } : null,
        historique: [{ statut: 'a_completer', at }]
      });
    }
    toast(`Acheté ${fmtE(prix)} · reste ${fmtE(Math.max(0, st.budgetRestant - prix))}`);
    reinitialiser();
  };

  const suggest = suggestions && marque.length >= 1 && !(fiche && fiche.nom.toLowerCase() === marque.trim().toLowerCase()) ? chercherMarques(state, marque).slice(0, 6) : [];
  const piedDePage = !v
    ? 'Choisis la revente estimée pour obtenir le verdict.'
    : v.kind === 'rouge'
      ? 'Achat bloqué. La règle ne se discute pas sur le terrain.'
      : v.kind === 'orange'
        ? v.code === 'controle'
          ? 'Les 4 contrôles débloquent le bouton Acheter.'
          : `Au-dessus de ${fmtE(v.maxPayable)}, le bouton Acheter n’apparaît pas.`
        : store.status.online
          ? 'Photo et prix enregistrés. Le reste se complète à la maison.'
          : 'Enregistré sur le téléphone, synchronisé au retour du réseau.';

  return (
    <main class="page" style="padding-bottom:calc(28px + var(--safe-b))">
      <span ref={hautRef} />
      <header class="row between">
        <a class="retour" href={actif ? `#/sortie/${actif.id}` : '#/'}><IconRetour size={20} />{actif ? 'Sortie' : 'Retour'}</a>
        {st && <span class="pill accent" style="font-size:13px;padding:7px 12px">Reste {fmtE(st.budgetRestant)} · {st.piecesRestantes} pièce{st.piecesRestantes > 1 ? 's' : ''}</span>}
      </header>
      <h1 class="big" style="font-size:22px">Vérifier une pièce</h1>

      {!actif && (
        <div class="card warn tight">
          <span class="strong">Pas de sortie en cours</span>
          <span class="small">Tu peux vérifier une pièce, mais un achat se fait pendant une sortie, avec son budget.</span>
        </div>
      )}

      {/* Photos */}
      <section class="card" aria-label="Photos">
        <div class="row between">
          <span class="strong">Photos</span>
          {enCoursPhoto && <span class="xs muted">Compression…</span>}
        </div>
        <div class="photos">
          {['piece', 'etiquette', 'logo'].map((role) => {
            const p = photos.find((x) => x.role === role);
            return (
              <button key={role} class="col" style="background:none;border:0;padding:0;gap:4px;cursor:pointer;color:inherit" onClick={() => prendrePhoto(role)} aria-label={`Photo : ${ROLES[role]}`}>
                {p ? <img src={p.vignette} alt="" /> : <span class="vide"><IconCamera size={22} /></span>}
                <span class="xs strong" style="text-align:center">{ROLES[role]}</span>
              </button>
            );
          })}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style="display:none" onChange={surFichier} />
        {photos.length > 0 && (
          <div class="btns">
            <button class="btn dark" onClick={demanderAssistant}><Etincelle color="var(--lilac)" />{ia ? 'Redemander à Claude ou ChatGPT' : 'Demander à Claude ou ChatGPT'}</button>
            {assistant && (
              <div class="col" style="gap:8px">
                <span class="small muted">
                  {assistant === 'partage'
                    ? 'Choisis Claude ou ChatGPT dans le partage. La consigne est copiée : colle-la si elle n’apparaît pas. Copie ensuite la réponse et reviens ici.'
                    : 'Consigne copiée. Ouvre Claude ou ChatGPT, ajoute la photo, colle la consigne, puis copie la réponse et reviens ici.'}
                </span>
                <button class="btn primary" onClick={collerReponse}>Coller la réponse</button>
                <textarea class="input" aria-label="Réponse de l’assistant" placeholder="Ou colle la réponse ici à la main" value={reponse} onInput={(e) => appliquerReponse(e.currentTarget.value)} />
              </div>
            )}
            {s.gemini?.actif && iaDisponible() && (
              <button class="btn ghost" onClick={analyser} disabled={iaEtat === 'chargement'}>{iaEtat === 'chargement' ? 'Analyse en cours…' : 'Analyse intégrée (Gemini)'}</button>
            )}
          </div>
        )}
        {iaEtat === 'erreur' && <span class="small" style="color:var(--red-ink)">{iaErreur}</span>}
      </section>

      {ia && (
        <section class="hero" aria-label="Résultat de l’analyse">
          <span class="kicker"><Etincelle />Ce que l’IA voit</span>
          <span class="big" style="font-size:19px;line-height:1.25">{ia.titre}{ia.marque ? ` · ${ia.marque}` : ''}</span>
          {(ia.epoque || ia.etat) && <span class="muted small">{[ia.epoque, ia.etat].filter(Boolean).join(' · ')}</span>}
          <div class="grid3">
            <div class="stat"><span>Potentiel</span><b>{ia.potentiel}</b></div>
            <div class="stat"><span>Revente</span><b>{Math.round(ia.revente_min)}–{Math.round(ia.revente_max)} €</b></div>
            <div class="stat"><span>Contrefaçon</span><b>{RISQUE[ia.risque_contrefacon]?.[1] || ia.risque_contrefacon}</b></div>
          </div>
          {ia.signaux?.length > 0 && <span class="small muted">Vu : {ia.signaux.slice(0, 3).join(' · ')}</span>}
          {ia.a_verifier?.length > 0 && <span class="small muted">À vérifier : {ia.a_verifier.slice(0, 3).join(' · ')}</span>}
          <span class="xs muted">Un indice, pas une authentification.</span>
        </section>
      )}

      {/* Marque */}
      <section class="card" aria-label="Marque">
        <label class="search" style="border-width:2px">
          <IconTag size={20} />
          <span class="sr">Marque</span>
          <input
            type="search"
            value={marque}
            placeholder="Marque (si lisible)"
            autocomplete="off"
            onInput={(e) => { setMarque(e.currentTarget.value); setSuggestions(true); setRevente(null); setControles({}); setDoute(false); }}
          />
        </label>
        {suggest.length > 0 && (
          <div class="chips">
            {suggest.map((m) => (
              <button key={m.nom} class="chip" style="font-size:14px;font-weight:600" onClick={() => { setMarque(m.nom); setSuggestions(false); setRevente(null); }}>{m.nom}</button>
            ))}
          </div>
        )}
        {fiche ? (
          <div class="row wrap" style="gap:6px">
            <span class={'pill ' + (fiche.pot === 'fort' ? 'solid' : fiche.pot === 'moyen' ? 'accent' : '')}>Potentiel {fiche.pot}</span>
            {fiche.hi && <span class="pill">{fiche.lo}–{fiche.hi} €</span>}
            <span class={'pill ' + (RISQUE[fiche.risque]?.[0] || '')}>Contrefaçon : risque {RISQUE[fiche.risque]?.[1]}</span>
            <a class="xs strong" href={`#/marques?q=${encodeURIComponent(fiche.nom)}`} style="padding:6px">Fiche</a>
          </div>
        ) : (
          marque && !suggest.length && <span class="small muted">Marque inconnue du catalogue : reste prudent sur la revente.</span>
        )}
        {ref && <span class="small muted">Référence : {ref.min}–{ref.max} € ({ref.label}). Au-dessus, c’est verrouillé.</span>}
      </section>

      {/* Lot */}
      <section class="card tight" aria-label="Lot">
        <div class="row between">
          <span class="strong">{nb > 1 ? `Lot de ${nb} pièces` : 'Une seule pièce'}</span>
          <div class="row" style="gap:6px">
            <button class="btn s ghost" style="width:48px;padding:0" aria-label="Une pièce de moins" onClick={() => setNb(Math.max(1, nb - 1))}>−</button>
            <button class="btn s ghost" style="width:48px;padding:0" aria-label="Une pièce de plus" onClick={() => setNb(Math.min(30, nb + 1))}>+</button>
          </div>
        </div>
        {nb > 1 && <span class="small muted">Le prix demandé est le prix du lot, réparti à parts égales. La revente est par pièce.</span>}
      </section>

      {/* Prix */}
      <section class="card" aria-label="Prix demandé">
        <span class="small strong muted">{nb > 1 ? 'Prix du lot' : 'Prix demandé'}</span>
        <div class="stepper">
          <button aria-label="Baisser de 50 centimes" onClick={() => setPrix(Math.max(0.5, Math.round((prix - 0.5) * 2) / 2))}>−</button>
          <span class="row" style="flex:1;justify-content:center;gap:4px;min-width:0">
          <input
            aria-label="Prix demandé en euros"
            inputMode="decimal"
            value={String(prix).replace('.', ',')}
            onChange={(e) => {
              const n = Number(e.currentTarget.value.replace(',', '.').replace(/[^0-9.]/g, ''));
              if (n > 0) setPrix(Math.round(n * 2) / 2);
            }}
            style={`width:${String(prix).length + 0.6}ch;flex:none`}
          />
          <span class="unite" aria-hidden="true">€</span>
          </span>
          <button aria-label="Monter de 50 centimes" onClick={() => setPrix(Math.round((prix + 0.5) * 2) / 2)}>+</button>
        </div>
      </section>

      {/* Revente */}
      <section class="card" aria-label="Revente estimée">
        <span class="small strong muted">Revente estimée sur Vinted{nb > 1 ? ' (par pièce)' : ''}</span>
        <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px">
          {CHIPS.map((n) => (
            <button key={n} class="chip" disabled={cap != null && n > cap} aria-pressed={reventeUtilisee === n} onClick={() => setRevente(n)}>{n}</button>
          ))}
        </div>
        {reventeUtilisee != null && !CHIPS.includes(reventeUtilisee) && <span class="small">Revente retenue : <b>{fmtE(reventeUtilisee)}</b></span>}
        {v && <span class="small muted">Prix max à payer : <b style="color:var(--ink)">{fmtE(v.maxPayable)}</b>{nb > 1 ? ` pour le lot (${fmtE(v.maxPiece)} par pièce)` : ''}</span>}
      </section>

      {/* Contrôle contrefaçon */}
      {controleRequis && !doute && (
        <section class="card" aria-label="Contrôle contrefaçon">
          <div class="row between">
            <span class="strong">Contrôle contrefaçon</span>
            <span class={'pill ' + RISQUE[risque][0]}>Risque {RISQUE[risque][1]}</span>
          </div>
          {CONTROLES_CONTREFACON.map((c) => (
            <button
              key={c.id}
              class="item"
              style={`min-height:48px;border:2px solid ${controles[c.id] ? 'var(--green)' : 'var(--line)'};background:${controles[c.id] ? 'var(--green-soft)' : 'var(--surface)'}`}
              aria-pressed={!!controles[c.id]}
              onClick={() => setControles({ ...controles, [c.id]: !controles[c.id] })}
            >
              {controles[c.id] ? <IconCheck size={20} style="color:var(--green)" /> : <span style="width:20px;height:20px;border-radius:10px;border:2px solid var(--muted);display:inline-block" />}
              <span class="small" style="font-weight:600">{c.label}</span>
            </button>
          ))}
          <button class="btn danger" onClick={() => setDoute(true)}>J’ai un doute, je passe</button>
        </section>
      )}

      {/* Verdict */}
      {v && (
        <section class={'feu ' + v.kind} aria-live="polite" aria-label="Verdict">
          <span class="titre">
            {v.kind === 'vert' ? <IconCheck size={30} /> : v.kind === 'orange' ? <IconAlerte size={30} /> : <IconX size={30} />}
            {v.titre}
          </span>
          <span style="font-size:15px;line-height:1.4;font-weight:500">{v.texte}</span>
        </section>
      )}

      <div class="btns">
        {v?.kind === 'vert' && actif && (
          <>
            <button class="btn dark big" onClick={photos.length ? acheter : () => prendrePhoto('piece')}>
              {photos.length ? 'Acheter' : <><IconCamera size={22} />Prendre la photo pour acheter</>}
            </button>
            {!photos.length && <button class="btn s ghost" onClick={acheter}>Acheter sans photo</button>}
          </>
        )}
        {v?.kind === 'vert' && !actif && <a class="btn dark big" href="#/">Démarre une sortie pour acheter</a>}
        {v?.kind === 'orange' && v.code !== 'controle' && (
          <button class="btn dark big" onClick={() => setPrix(v.maxPayable)}>Il accepte {fmtE(v.maxPayable)}</button>
        )}
        {v?.kind === 'rouge' && <button class="btn dark big" onClick={reinitialiser}>Pièce suivante</button>}
        <span class="small muted" style="text-align:center">{piedDePage}</span>
      </div>
    </main>
  );
}
