import { useState, useRef } from 'preact/hooks';
import { useApp, aller, Champ, IconRetour, IconCamera, IconTag } from '../base.jsx';
import { liste, chercherMarques } from '../../logic/calc.js';
import { ORIGINES, PRIX_STATUTS, COMPTES, TAGS_STYLE, TAILLES_RAPIDES, CATEGORIES, ETATS_VINTED, nouvelId, compteParDefaut } from '../../data/schema.js';
import { compresserPhoto } from '../../util/photo.js';

export function ChoixTags({ tags, onChange }) {
  const [perso, setPerso] = useState('');
  const ajout = (t) => {
    const v = t.trim().toLowerCase();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setPerso('');
  };
  const autres = tags.filter((t) => !TAGS_STYLE.includes(t));
  return (
    <div class="col" style="gap:6px">
      <span class="small strong muted row" style="gap:6px"><IconTag size={16} />Tags de style</span>
      <div class="chips">
        {[...TAGS_STYLE, ...autres].map((t) => (
          <button key={t} type="button" class="chip" style="font-size:13px;font-weight:600;min-height:38px" aria-pressed={tags.includes(t)} onClick={() => onChange(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>
        ))}
      </div>
      <div class="row">
        <input class="input" aria-label="Autre tag" value={perso} placeholder="Autre tag…" onInput={(e) => setPerso(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), ajout(perso))} />
        <button type="button" class="btn s ghost" onClick={() => ajout(perso)}>Ajouter</button>
      </div>
    </div>
  );
}

export function RappelCompte({ origine, compte }) {
  if (origine === 'dressing' && compte === 'pro') {
    return <div class="card warn tight"><span class="small strong">Une pièce de ton dressing perso se vend depuis ton compte particulier, pas depuis le compte Pro.</span></div>;
  }
  if (origine === 'dressing') {
    return <span class="xs muted">Rappel : le dressing perso se vend depuis ton compte particulier.</span>;
  }
  return null;
}

function ChoixOrigine({ origine, onChange, sansSortie = true }) {
  return (
    <div class="col" style="gap:6px">
      <span class="small strong muted">Origine</span>
      <div class="grid2">
        {Object.entries(ORIGINES)
          .filter(([k]) => !sansSortie || k !== 'sortie')
          .map(([k, o]) => (
            <button key={k} type="button" class="chip" style="min-height:64px;text-align:left;padding:8px 12px;display:flex;flex-direction:column;align-items:flex-start;gap:2px" aria-pressed={origine === k} onClick={() => onChange(k)}>
              <span style="font-size:15px">{o.label}</span>
              <span style="font-size:12px;font-weight:500;opacity:.8">{o.aide}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

const num = (v) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
};

// Ajouter un article à tout moment : ne dépend ni d'une sortie ni du planning.
export function AjoutArticle() {
  const { store, state, s, today, toast } = useApp();
  const [f, setF] = useState({
    origine: 'ancien', titre: '', marque: '', categorie: '', taille: '', etat: '', cout: '', prixStatut: 'exact',
    revente: '', lieuId: '', date: '', bac: '', notes: '', tags: [], compte: compteParDefaut('ancien', s)
  });
  const [photos, setPhotos] = useState([]);
  const [suggest, setSuggest] = useState(false);
  const fileRef = useRef(null);
  const galerieRef = useRef(null);
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const lieux = liste(state.lieux).sort((a, b) => a.nom.localeCompare(b.nom));
  const marques = suggest && f.marque.length > 1 ? chercherMarques(state, f.marque).slice(0, 5) : [];

  const changerOrigine = (o) => setF({ ...f, origine: o, compte: compteParDefaut(o, s), prixStatut: o === 'ancien' ? f.prixStatut : 'exact', cout: o === 'dressing' ? '0' : f.cout === '0' ? '' : f.cout });

  const surPhotos = async (e) => {
    const fichiers = [...(e.currentTarget.files || [])].slice(0, 8);
    e.currentTarget.value = '';
    const comp = [];
    for (const f of fichiers) {
      try {
        comp.push(await compresserPhoto(f));
      } catch {
        toast('Une photo est illisible.');
      }
    }
    setPhotos((ps) => [...ps, ...comp].slice(0, 8));
  };

  const enregistrer = (encore) => {
    const cout = f.origine === 'dressing' ? 0 : num(f.cout);
    if (f.origine === 'trouvaille' && cout == null) return toast('Indique le prix payé pour la trouvaille.');
    if (f.origine === 'ancien' && f.prixStatut !== 'inconnu' && cout == null) return toast('Indique le prix, ou choisis « Prix inconnu ».');
    const at = f.date ? new Date(`${f.date}T12:00:00`).toISOString() : f.origine === 'ancien' ? null : new Date().toISOString();
    const photoIds = photos.map((ph) => {
      const pid = nouvelId();
      store.putPhoto(pid, ph.photo, { role: 'piece' });
      return pid;
    });
    const statut = f.titre || f.categorie ? 'a_preparer' : 'a_completer';
    store.put('articles', {
      origine: f.origine,
      prixStatut: f.origine === 'ancien' ? f.prixStatut : f.origine === 'dressing' ? 'exact' : 'exact',
      titre: f.titre.trim() || [f.categorie, f.marque].filter(Boolean).join(' ') || 'Pièce à compléter',
      marque: f.marque.trim(),
      categorie: f.categorie,
      taille: f.taille,
      etat: f.etat,
      cout: cout ?? 0,
      revente: num(f.revente),
      bac: f.bac.trim(),
      notes: f.notes,
      tags: f.tags,
      compte: f.compte,
      lieuId: f.lieuId || null,
      achatAt: at,
      photoIds,
      thumb: photos[0]?.vignette || null,
      statut,
      historique: [{ statut, at: new Date().toISOString() }]
    });
    toast(`Ajouté · ${ORIGINES[f.origine].label}`);
    if (encore) {
      setF({ ...f, titre: '', marque: '', taille: '', etat: '', cout: f.origine === 'dressing' ? '0' : '', revente: '', notes: '', tags: [] });
      setPhotos([]);
      scrollTo(0, 0);
    } else aller('/stock');
  };

  return (
    <main class="page">
      <a class="retour" href="#/stock"><IconRetour size={20} />Stock</a>
      <header class="top">
        <div class="col"><span class="sur">Hors sortie · ne touche ni au budget ni aux sacs</span><h1>Ajouter un article</h1></div>
      </header>
      <a class="card soft" href="#/inventaire" style="text-decoration:none">
        <span class="strong">Mode inventaire</span>
        <span class="small">Une pile à rentrer ? Photo → catégorie → taille → bac, article après article.</span>
      </a>

      <section class="card">
        <ChoixOrigine origine={f.origine} onChange={changerOrigine} />
      </section>

      <section class="card">
        <div class="row">
          <button type="button" class="col" style="background:none;border:0;padding:0;cursor:pointer;color:inherit;width:96px;flex-shrink:0;gap:4px" onClick={() => fileRef.current?.click()} aria-label="Prendre une photo">
            {photos[0] ? <img src={photos[0].vignette} alt="" style="width:96px;height:96px;border-radius:16px;object-fit:cover" /> : <span class="thumb" style="width:96px;height:96px;border-radius:16px"><IconCamera size={28} /></span>}
            <span class="xs strong" style="text-align:center">{photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : 'Photo'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style="display:none" onChange={surPhotos} />
          <input ref={galerieRef} type="file" accept="image/*" multiple style="display:none" onChange={surPhotos} />
          <div class="col grow" style="gap:8px">
            <Champ label="Pièce"><input class="input" value={f.titre} placeholder="Jean taille basse…" onInput={maj('titre')} /></Champ>
            <Champ label="Marque"><input class="input" value={f.marque} autocomplete="off" onInput={(e) => { setF({ ...f, marque: e.currentTarget.value }); setSuggest(true); }} /></Champ>
          </div>
        </div>
        <div class="grid2">
          <button type="button" class="btn s ghost" onClick={() => fileRef.current?.click()}><IconCamera size={18} />Appareil photo</button>
          <button type="button" class="btn s ghost" onClick={() => galerieRef.current?.click()}>Depuis la galerie</button>
        </div>
        {photos.length > 1 && (
          <div class="row wrap" style="gap:6px">
            {photos.map((ph, i) => (
              <button key={i} type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => setPhotos(photos.filter((_, j) => j !== i))} style="padding:0;border:0;background:none;cursor:pointer">
                <img src={ph.vignette} alt="" style="width:52px;height:52px;border-radius:10px;object-fit:cover" />
              </button>
            ))}
            <span class="xs muted">Touche une photo pour la retirer.</span>
          </div>
        )}
        {marques.length > 0 && marques[0].nom !== f.marque && (
          <div class="chips">{marques.map((m) => <button key={m.nom} type="button" class="chip" style="font-size:14px" onClick={() => { setF({ ...f, marque: m.nom }); setSuggest(false); }}>{m.nom}</button>)}</div>
        )}
        <div class="grid2">
          <Champ label="Catégorie">
            <select class="input" value={f.categorie} onChange={maj('categorie')}><option value="">—</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Champ>
          <Champ label="Taille"><input class="input" value={f.taille} onInput={maj('taille')} /></Champ>
        </div>
        <Champ label="État Vinted">
          <select class="input" value={f.etat} onChange={maj('etat')}><option value="">—</option>{ETATS_VINTED.map((c) => <option key={c}>{c}</option>)}</select>
        </Champ>
      </section>

      <section class="card">
        {f.origine === 'dressing' ? (
          <span class="small"><b>Coût : 0 €.</b> Exclu de tes moyennes et de la rentabilité des lieux.</span>
        ) : (
          <>
            {f.origine === 'ancien' && (
              <div class="chips" role="group" aria-label="Prix d'achat">
                {Object.entries(PRIX_STATUTS).map(([k, l]) => <button key={k} type="button" class="chip" style="font-size:14px" aria-pressed={f.prixStatut === k} onClick={() => setF({ ...f, prixStatut: k, cout: k === 'inconnu' ? '' : f.cout })}>{l}</button>)}
              </div>
            )}
            <div class="grid2">
              {!(f.origine === 'ancien' && f.prixStatut === 'inconnu') && (
                <Champ label={f.prixStatut === 'estime' ? 'Prix payé estimé (€)' : 'Prix payé (€)'}><input class="input" inputMode="decimal" value={f.cout} onInput={maj('cout')} /></Champ>
              )}
              <Champ label="Revente visée (€)"><input class="input" inputMode="decimal" value={f.revente} onInput={maj('revente')} /></Champ>
            </div>
            {f.origine === 'ancien' && f.prixStatut === 'inconnu' && <span class="xs muted">Prix inconnu : l’article est exclu de tes moyennes et de la rentabilité des lieux.</span>}
            {f.origine === 'trouvaille' && <span class="xs muted">Compte dans ta trésorerie et tes dépenses du mois, pas dans le budget des sorties.</span>}
            {f.origine === 'ancien' && <span class="xs muted">Déjà payé avant l’app : ne sort pas de ta trésorerie actuelle.</span>}
          </>
        )}
        <div class="grid2">
          <Champ label={f.origine === 'ancien' ? 'Lieu (facultatif)' : 'Lieu'}>
            <select class="input" value={f.lieuId} onChange={maj('lieuId')}><option value="">{f.origine === 'ancien' ? 'Origine inconnue' : '—'}</option>{lieux.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}</select>
          </Champ>
          <Champ label="Date d’achat (facultatif)"><input class="input" type="date" value={f.date} max={today} onInput={maj('date')} /></Champ>
        </div>
      </section>

      <section class="card">
        <ChoixTags tags={f.tags} onChange={(tags) => setF({ ...f, tags })} />
      </section>

      <section class="card">
        <div class="grid2">
          <Champ label="Bac"><input class="input" value={f.bac} inputMode="numeric" onInput={maj('bac')} /></Champ>
          <Champ label="Compte Vinted">
            <select class="input" value={f.compte} onChange={maj('compte')}>{Object.entries(COMPTES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Champ>
        </div>
        <RappelCompte origine={f.origine} compte={f.compte} />
        <Champ label="Notes"><textarea class="input" value={f.notes} onInput={maj('notes')} /></Champ>
      </section>

      <div class="btns">
        <button class="btn primary big" onClick={() => enregistrer(true)}>Ajouter et en saisir un autre</button>
        <button class="btn ghost" onClick={() => enregistrer(false)}>Ajouter et terminer</button>
      </div>
    </main>
  );
}

// Mode inventaire : photo → catégorie → taille → bac, en boucle.
export function Inventaire() {
  const { store, s, toast } = useApp();
  const [origine, setOrigine] = useState('ancien');
  const [prixStatut, setPrixStatut] = useState('inconnu');
  const [photo, setPhoto] = useState(null);
  const [serie, setSerie] = useState(false);
  const [categorie, setCategorie] = useState('');
  const [taille, setTaille] = useState('');
  const [bac, setBac] = useState('');
  const [cout, setCout] = useState('');
  const [compteur, setCompteur] = useState(0);
  const [derniers, setDerniers] = useState([]);
  const fileRef = useRef(null);
  const galerieRef = useRef(null);
  const serieRef = useRef(null);
  const tailleRef = useRef(null);

  const surPhoto = async (e) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    setPhoto(await compresserPhoto(file));
  };

  const creer = (ph, cat, tai) => {
    const photoIds = [];
    if (ph) {
      const pid = nouvelId();
      store.putPhoto(pid, ph.photo, { role: 'piece' });
      photoIds.push(pid);
    }
    const c = origine === 'dressing' ? 0 : num(cout);
    store.put('articles', {
      origine,
      prixStatut: origine === 'ancien' ? (c == null ? 'inconnu' : prixStatut === 'inconnu' ? 'estime' : prixStatut) : 'exact',
      titre: cat || 'Pièce à compléter',
      categorie: cat,
      taille: tai,
      bac: bac.trim(),
      cout: c ?? 0,
      tags: [],
      compte: compteParDefaut(origine, s),
      achatAt: origine === 'ancien' ? null : new Date().toISOString(),
      photoIds,
      thumb: ph?.vignette || null,
      statut: 'a_completer',
      historique: [{ statut: 'a_completer', at: new Date().toISOString() }]
    });
  };

  // Une photo de la galerie = un article, avec la catégorie et le bac choisis.
  const importerSerie = async (e) => {
    const fichiers = [...(e.currentTarget.files || [])].slice(0, 60);
    e.currentTarget.value = '';
    if (!fichiers.length) return;
    setSerie(true);
    let n = 0;
    const vignettes = [];
    for (const f of fichiers) {
      try {
        const ph = await compresserPhoto(f);
        creer(ph, categorie, '');
        vignettes.push({ thumb: ph.vignette, categorie, taille: '', bac });
        n++;
      } catch {
        /* photo illisible : on passe */
      }
    }
    setSerie(false);
    setCompteur((c) => c + n);
    setDerniers((d) => [...vignettes.reverse(), ...d].slice(0, 6));
    toast(`${n} article${n > 1 ? 's' : ''} créé${n > 1 ? 's' : ''} · à compléter plus tard.`);
  };

  const suivant = () => {
    if (!photo && !categorie) return toast('Au moins une photo ou une catégorie.');
    creer(photo, categorie, taille);
    setCompteur(compteur + 1);
    setDerniers([{ thumb: photo?.vignette, categorie, taille, bac }, ...derniers].slice(0, 6));
    setPhoto(null);
    setTaille('');
    setCout('');
  };

  return (
    <main class="page">
      <a class="retour" href="#/ajouter-article"><IconRetour size={20} />Ajouter un article</a>
      <header class="top">
        <div class="col"><span class="sur">{compteur} article{compteur > 1 ? 's' : ''} saisi{compteur > 1 ? 's' : ''} · le reste se complète plus tard</span><h1>Inventaire</h1></div>
        {compteur > 0 && <a class="btn s primary" href="#/stock/a_completer">Terminer</a>}
      </header>

      <div class="chips" role="group" aria-label="Origine de la pile">
        {['ancien', 'dressing', 'trouvaille'].map((k) => <button key={k} class="chip" style="font-size:14px" aria-pressed={origine === k} onClick={() => setOrigine(k)}>{ORIGINES[k].label}</button>)}
      </div>

      <section class="card" aria-label="1. Photo">
        <button type="button" class="col" style="background:none;border:0;padding:0;cursor:pointer;color:inherit;gap:6px;align-items:center" onClick={() => fileRef.current?.click()}>
          {photo ? <img src={photo.vignette} alt="" style="width:100%;max-width:220px;aspect-ratio:1;border-radius:18px;object-fit:cover" /> : <span class="thumb" style="width:160px;height:160px;border-radius:22px"><IconCamera size={40} /></span>}
          <span class="strong">{photo ? 'Reprendre la photo' : '1. Photo'}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style="display:none" onChange={surPhoto} />
        <input ref={galerieRef} type="file" accept="image/*" style="display:none" onChange={surPhoto} />
        <input ref={serieRef} type="file" accept="image/*" multiple style="display:none" onChange={importerSerie} />
        <div class="grid2">
          <button type="button" class="btn s ghost" onClick={() => fileRef.current?.click()}><IconCamera size={18} />Appareil photo</button>
          <button type="button" class="btn s ghost" onClick={() => galerieRef.current?.click()}>Depuis la galerie</button>
        </div>
        <button type="button" class="btn s dark" disabled={serie} onClick={() => serieRef.current?.click()}>
          {serie ? 'Import en cours…' : 'Importer une série depuis la galerie (1 photo = 1 article)'}
        </button>
        <span class="xs muted">La série prend la catégorie et le bac sélectionnés ci-dessous. Choisis-les avant d’importer.</span>
      </section>

      <section class="card" aria-label="2. Catégorie">
        <span class="small strong muted">2. Catégorie</span>
        <div class="chips">{CATEGORIES.map((c) => <button key={c} class="chip" style="font-size:14px;font-weight:600" aria-pressed={categorie === c} onClick={() => { setCategorie(c); tailleRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }}>{c}</button>)}</div>
      </section>

      <section class="card" aria-label="3. Taille" ref={tailleRef}>
        <span class="small strong muted">3. Taille</span>
        <div class="chips">{TAILLES_RAPIDES.map((t) => <button key={t} class="chip" style="min-width:48px" aria-pressed={taille === t} onClick={() => setTaille(t)}>{t}</button>)}</div>
        <input class="input" aria-label="Autre taille" value={TAILLES_RAPIDES.includes(taille) ? '' : taille} placeholder="Autre : W28, 39…" onInput={(e) => setTaille(e.currentTarget.value)} />
      </section>

      <section class="card" aria-label="4. Bac">
        <span class="small strong muted">4. Bac (gardé pour les suivants)</span>
        <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px">
          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((b) => <button key={b} class="chip" aria-pressed={bac === b} onClick={() => setBac(b)}>{b}</button>)}
        </div>
      </section>

      {origine !== 'dressing' && (
        <section class="card tight" aria-label="Prix">
          <div class="grid2">
            <Champ label="Prix payé (facultatif)"><input class="input" inputMode="decimal" value={cout} onInput={(e) => setCout(e.currentTarget.value)} /></Champ>
            {origine === 'ancien' && (
              <Champ label="Ce prix est">
                <select class="input" value={prixStatut === 'inconnu' ? 'estime' : prixStatut} onChange={(e) => setPrixStatut(e.currentTarget.value)}><option value="exact">exact</option><option value="estime">estimé</option></select>
              </Champ>
            )}
          </div>
          {origine === 'ancien' && <span class="xs muted">Sans prix : « prix inconnu », exclu de tes moyennes.</span>}
        </section>
      )}

      <button class="btn primary big" onClick={suivant}>Article suivant</button>

      {derniers.length > 0 && (
        <section class="col" style="gap:6px">
          <h2 class="section-t">Derniers saisis</h2>
          <div class="grid3">
            {derniers.map((d, i) => (
              <div key={i} class="col" style="gap:2px">
                {d.thumb ? <img src={d.thumb} alt="" style="width:100%;aspect-ratio:1;border-radius:12px;object-fit:cover" /> : <span class="thumb" style="width:100%;height:auto;aspect-ratio:1" />}
                <span class="xs strong ellipsis">{d.categorie || 'Pièce'} {d.taille}</span>
                <span class="xs muted">Bac {d.bac || '–'}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

