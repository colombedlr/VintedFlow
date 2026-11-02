import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { useApp, aller, Feuille, Champ, IconRetour, IconLoupe, IconPin, IconHorsLigne } from '../base.jsx';
import { CarteVue } from '../CarteVue.jsx';
import { liste, rentabiliteParLieu, semaineInfo } from '../../logic/calc.js';
import { repartitionBudget, coutTournee } from '../../logic/planning.js';
import { addDays, mondayOf, fmtCourt, nowMinutes, dayOfWeek } from '../../logic/dates.js';
import {
  distanceKm, minutesPour, kmPourMinutes, fmtKm, plagesDuJour, ouvertMaintenant, ouvertLe, prochaineDate,
  ordreTournee, accesEstime, estEvenement, TYPES_EVENEMENTS, EPINGLES
} from '../../logic/geo.js';
import { chercherAdresse, geocoder, lieuxOSM, lienItineraire } from '../../data/sources.js';
import { TYPES_LIEU } from '../../data/lieux.js';
import { fmtE } from '../../logic/rules.js';

const TIMONE = { label: 'Timone (approximatif)', lat: 43.2898, lon: 5.4005 };
const SEUIL_RENTABLE = 8; // € par heure
const PERMANENTS = ['ressourcerie', 'emmaus', 'solidaire', 'friperie', 'friperie-kilo', 'depot-vente', 'puces'];

function memoire(cle, defaut) {
  try {
    const v = localStorage.getItem('vf-carte:' + cle);
    return v ? JSON.parse(v) : defaut;
  } catch {
    return defaut;
  }
}
function retenir(cle, v) {
  try {
    localStorage.setItem('vf-carte:' + cle, JSON.stringify(v));
  } catch {
    /* rien */
  }
}

function useEnLigne() {
  const [ok, setOk] = useState(navigator.onLine);
  useEffect(() => {
    const f = () => setOk(navigator.onLine);
    addEventListener('online', f);
    addEventListener('offline', f);
    return () => {
      removeEventListener('online', f);
      removeEventListener('offline', f);
    };
  }, []);
  return ok;
}

function semaineFin(iso) {
  return addDays(mondayOf(iso), 6);
}

export function Carte() {
  const { store, state, s, today, now, toast } = useApp();
  const enLigne = useEnLigne();
  const domicile = s.domicile || TIMONE;
  const [depart, setDepart] = useState(() => memoire('depart', { mode: 'domicile' }));
  const [position, setPosition] = useState(null);
  const [rayon, setRayon] = useState(() => memoire('rayon', { unite: 'km', valeur: 3, mode: 'velo' }));
  const [vue, setVue] = useState(() => memoire('vue', 'permanents'));
  const [ouverture, setOuverture] = useState('aujourdhui');
  const [quand, setQuand] = useState('weekend');
  const [types, setTypes] = useState([]);
  const [visite, setVisite] = useState('tous');
  const [source, setSource] = useState('tout');
  const [osm, setOsm] = useState({ lieux: [], etat: 'idle', erreur: '' });
  const [fiche, setFiche] = useState(null);
  const [selection, setSelection] = useState([]);
  const [feuille, setFeuille] = useState(null);
  const [voirCarte, setVoirCarte] = useState(true);

  useEffect(() => retenir('depart', depart), [depart]);
  useEffect(() => retenir('rayon', rayon), [rayon]);
  useEffect(() => retenir('vue', vue), [vue]);

  const origine = depart.mode === 'position' && position ? { ...position, label: 'Ma position' } : depart.mode === 'adresse' && depart.point ? depart.point : domicile;
  const rayonKm = rayon.unite === 'km' ? rayon.valeur : kmPourMinutes(rayon.valeur, rayon.mode);

  const demanderPosition = () => {
    if (!navigator.geolocation) return toast('Position indisponible sur cet appareil.');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lon: p.coords.longitude });
        setDepart({ mode: 'position' });
      },
      () => toast('Position refusée : autorise la localisation pour VintedFlow dans Réglages de l’iPhone.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };
  useEffect(() => {
    if (depart.mode === 'position') demanderPosition();
  }, []);

  // Coordonnées des lieux du carnet (une seule fois par lieu).
  useEffect(() => {
    if (!enLigne) return;
    let vivant = true;
    (async () => {
      for (const l of liste(state.lieux)) {
        if (!vivant) return;
        if (l.lat != null || !l.adresse || l.geoEchec) continue;
        try {
          const g = await geocoder(l.adresse);
          if (g) store.patch('lieux', l.id, { lat: g.lat, lon: g.lon });
          else store.patch('lieux', l.id, { geoEchec: true });
        } catch {
          return;
        }
      }
    })();
    return () => {
      vivant = false;
    };
  }, [enLigne, liste(state.lieux).length]);

  // Lieux permanents OpenStreetMap autour du point de départ.
  useEffect(() => {
    if (!enLigne || vue !== 'permanents') return;
    let vivant = true;
    setOsm((o) => ({ ...o, etat: 'chargement', erreur: '' }));
    lieuxOSM(origine.lat, origine.lon, rayonKm)
      .then((r) => vivant && setOsm({ lieux: r.lieux, etat: 'ok', erreur: '' }))
      .catch((e) => vivant && setOsm((o) => ({ ...o, etat: 'erreur', erreur: e?.message || 'Recherche indisponible.' })));
    return () => {
      vivant = false;
    };
  }, [enLigne, vue, origine.lat.toFixed(3), origine.lon.toFixed(3), Math.ceil(rayonKm)]);

  const rent = useMemo(() => Object.fromEntries(rentabiliteParLieu(state, today).map((r) => [r.lieu.id, r])), [store.version, today]);
  const ignores = new Set(liste(state.decouvertes).filter((d) => d.statut === 'ignore').map((d) => d.osmId));
  const carnet = liste(state.lieux).filter((l) => l.actif !== false);

  // Fusion carnet + découvertes OSM (une découverte proche d'un lieu du carnet est considérée comme connue).
  const tous = useMemo(() => {
    const items = carnet.map((l) => ({ ...l, cle: 'c:' + l.id, carnet: true }));
    for (const o of osm.lieux) {
      if (ignores.has(o.osmId)) continue;
      const connu = carnet.some((l) => l.osmId === o.osmId || (l.lat != null && distanceKm(l, o) < 0.08 && l.nom.toLowerCase().slice(0, 6) === o.nom.toLowerCase().slice(0, 6)));
      if (!connu) items.push({ ...o, id: o.osmId, cle: 'o:' + o.osmId, carnet: false, decouverte: true });
    }
    return items;
  }, [store.version, osm.lieux]);

  const nowMin = nowMinutes(now);
  const fenetre = quand === 'aujourdhui' ? [today, 1] : quand === 'weekend' ? (() => {
    const dow = dayOfWeek(today);
    const sam = dow === 0 ? addDays(today, -1) : addDays(today, (6 - dow + 7) % 7);
    return [sam < today ? today : sam, sam < today ? 1 : 2];
  })() : [today, 7];

  const resultats = tous
    .map((l) => {
      const km = distanceKm(origine, l);
      const r = l.carnet ? rent[l.id] : null;
      const visiteDeja = !!r && (r.sorties > 0 || r.achetes > 0);
      const evt = estEvenement(l.type);
      const date = evt ? prochaineDate(l, fenetre[0], fenetre[1]) : null;
      const horairesConnus = (l.ouverture || []).length > 0;
      return {
        ...l,
        km,
        evt,
        date,
        visiteDeja,
        rent: r,
        ouvertNow: ouvertMaintenant(l, today, nowMin),
        ouvertAuj: ouvertLe(l, today),
        horairesConnus
      };
    })
    .filter((l) => (vue === 'evenements' ? l.evt : !l.evt))
    .filter((l) => l.km == null || l.km <= rayonKm || !enLigne)
    .filter((l) => !types.length || types.includes(l.type))
    .filter((l) => visite === 'tous' || (visite === 'deja' ? l.visiteDeja : !l.visiteDeja))
    .filter((l) => source === 'tout' || (source === 'carnet' ? l.carnet : l.decouverte))
    .filter((l) => {
      if (vue === 'evenements') return !!l.date;
      if (ouverture === 'maintenant') return l.ouvertNow;
      if (ouverture === 'aujourdhui') return l.ouvertAuj || !l.horairesConnus;
      return true;
    })
    .sort((a, b) => (a.km ?? 999) - (b.km ?? 999));

  const nbDecouvertes = tous.filter((l) => l.decouverte && !estEvenement(l.type)).length;

  const couleur = (l) => {
    const ep = EPINGLES[l.type] || EPINGLES.autre;
    let bord = '#ffffff';
    let fond = ep.c;
    if (l.visiteDeja && l.rent?.parHeure != null) {
      fond = l.rent.parHeure >= SEUIL_RENTABLE ? '#0b7a35' : '#c81e35';
    }
    if (l.decouverte) bord = '#ffd60a';
    return { couleur: fond, bord, lettre: ep.l };
  };

  const points = resultats
    .filter((l) => l.lat != null)
    .slice(0, 80)
    .map((l) => ({ id: l.cle, lat: l.lat, lon: l.lon, titre: `${l.nom}, ${TYPES_LIEU[l.type] || l.type}, ${fmtKm(l.km)}`, selection: selection.includes(l.cle), ...couleur(l) }));

  const basculerSel = (cle) => setSelection(selection.includes(cle) ? selection.filter((x) => x !== cle) : [...selection, cle]);
  const typesVue = vue === 'evenements' ? TYPES_EVENEMENTS : PERMANENTS;

  const ajouterAuCarnet = (l, silencieux = false) => {
    const id = store.put('lieux', {
      nom: l.nom,
      type: l.type,
      adresse: l.adresse || '',
      lat: l.lat,
      lon: l.lon,
      osmId: l.osmId || null,
      ouverture: l.ouverture || [],
      horairesTexte: l.horairesTexte || '',
      heureIdeale: l.ouverture?.[0]?.debut || '',
      acces: accesEstime(domicile, l),
      notes: l.site ? `Site : ${l.site}` : '',
      aValider: true,
      actif: true,
      source: 'osm'
    });
    if (!silencieux) toast('Ajouté à ton carnet, à valider.');
    return id;
  };

  const ficheItem = fiche ? resultats.find((l) => l.cle === fiche) || tous.find((l) => l.cle === fiche) : null;

  return (
    <main class="page full" style="max-width:1100px">
      <a class="retour" href="#/semaine"><IconRetour size={20} />Semaine</a>
      <header class="top">
        <div class="col">
          <span class="sur">Autour de : {origine.label || 'point choisi'}</span>
          <h1>Carte</h1>
        </div>
        {vue === 'evenements' && <button class="btn s primary" onClick={() => setFeuille('evenement')}>+ Événement</button>}
      </header>

      <section class="card" aria-label="Point de départ">
        <div class="chips" role="group" aria-label="Point de départ">
          <button class="chip" aria-pressed={depart.mode === 'domicile'} onClick={() => setDepart({ mode: 'domicile' })}>Domicile</button>
          <button class="chip" aria-pressed={depart.mode === 'position'} onClick={demanderPosition}><IconPin size={16} /> Ma position</button>
          <button class="chip" aria-pressed={depart.mode === 'adresse'} onClick={() => setFeuille('adresse')}>{depart.mode === 'adresse' && depart.point ? depart.point.label.slice(0, 26) : 'Une adresse…'}</button>
        </div>
        {!s.domicile && <button class="btn s ghost" onClick={() => setFeuille('domicile')}>Enregistrer mon domicile (sinon : Timone approximatif)</button>}
        <div class="row wrap" style="gap:6px">
          <div class="chips" role="group" aria-label="Unité du rayon">
            <button class="chip" style="font-size:14px" aria-pressed={rayon.unite === 'km'} onClick={() => setRayon({ ...rayon, unite: 'km', valeur: 3 })}>km</button>
            <button class="chip" style="font-size:14px" aria-pressed={rayon.unite === 'min' && rayon.mode === 'pied'} onClick={() => setRayon({ unite: 'min', mode: 'pied', valeur: 20 })}>min à pied</button>
            <button class="chip" style="font-size:14px" aria-pressed={rayon.unite === 'min' && rayon.mode === 'velo'} onClick={() => setRayon({ unite: 'min', mode: 'velo', valeur: 15 })}>min à vélo</button>
          </div>
          <div class="chips" role="group" aria-label="Rayon">
            {(rayon.unite === 'km' ? [1, 2, 3, 5, 10] : [10, 15, 20, 30, 45]).map((v) => (
              <button key={v} class="chip" style="font-size:14px;min-width:48px" aria-pressed={rayon.valeur === v} onClick={() => setRayon({ ...rayon, valeur: v })}>{v}</button>
            ))}
          </div>
        </div>
      </section>

      <div class="chips" role="group" aria-label="Type de résultats">
        <button class="chip" aria-pressed={vue === 'permanents'} onClick={() => { setVue('permanents'); setTypes([]); setSelection([]); }}>Lieux permanents</button>
        <button class="chip" aria-pressed={vue === 'evenements'} onClick={() => { setVue('evenements'); setTypes([]); setSelection([]); }}>Événements datés</button>
      </div>

      <section class="col" style="gap:8px" aria-label="Filtres">
        {vue === 'permanents' ? (
          <div class="chips" role="group" aria-label="Ouverture">
            {[['aujourdhui', 'Ouvert aujourd’hui'], ['maintenant', 'Ouvert maintenant'], ['tous', 'Tous']].map(([k, l]) => (
              <button key={k} class="chip" style="font-size:14px" aria-pressed={ouverture === k} onClick={() => setOuverture(k)}>{l}</button>
            ))}
          </div>
        ) : (
          <div class="chips" role="group" aria-label="Date">
            {[['aujourdhui', 'Aujourd’hui'], ['weekend', 'Ce week-end'], ['semaine', '7 prochains jours']].map(([k, l]) => (
              <button key={k} class="chip" style="font-size:14px" aria-pressed={quand === k} onClick={() => setQuand(k)}>{l}</button>
            ))}
          </div>
        )}
        <details>
        <summary class="small strong" style="cursor:pointer;padding:8px 4px">Plus de filtres{types.length || visite !== 'tous' || source !== 'tout' ? ' (actifs)' : ''}</summary>
        <div class="col" style="gap:8px;padding-top:6px">
        <div class="chips" role="group" aria-label="Types">
          {typesVue.map((t) => (
            <button key={t} class="chip" style="font-size:13px;font-weight:600" aria-pressed={types.includes(t)} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])}>
              <span aria-hidden="true" style={`display:inline-block;width:10px;height:10px;border-radius:5px;margin-right:6px;background:${EPINGLES[t].c}`} />{TYPES_LIEU[t]}
            </button>
          ))}
        </div>
        <div class="chips" role="group" aria-label="Visites et source">
          {[['tous', 'Visités ou non'], ['deja', 'Déjà visités'], ['jamais', 'Jamais visités']].map(([k, l]) => (
            <button key={k} class="chip" style="font-size:13px;font-weight:600" aria-pressed={visite === k} onClick={() => setVisite(k)}>{l}</button>
          ))}
          {vue === 'permanents' && [['tout', 'Carnet + à découvrir'], ['carnet', 'Mon carnet'], ['decouvrir', `À découvrir (${nbDecouvertes})`]].map(([k, l]) => (
            <button key={k} class="chip" style="font-size:13px;font-weight:600" aria-pressed={source === k} onClick={() => setSource(k)}>{l}</button>
          ))}
        </div>
        </div>
        </details>
      </section>

      {enLigne ? (
        <>
          <div class="row between">
            <span class="small muted">
              {osm.etat === 'chargement' && vue === 'permanents' ? 'Recherche des lieux autour…' : `${resultats.length} résultat${resultats.length > 1 ? 's' : ''} dans ${fmtKm(rayonKm)}`}
              {osm.etat === 'erreur' && vue === 'permanents' ? ' · recherche OpenStreetMap indisponible, ton carnet reste affiché' : ''}
            </span>
            <button class="btn s ghost" onClick={() => setVoirCarte(!voirCarte)}>{voirCarte ? 'Masquer la carte' : 'Voir la carte'}</button>
          </div>
          {voirCarte && <CarteVue origine={origine} points={points} onSelect={(id) => setFiche(id)} />}
          <p class="xs muted">Épingles : couleur = type ; verte = rentable (≥ {SEUIL_RENTABLE} €/h), rouge = à éviter ; contour jaune = à découvrir. Carte © OpenFreeMap, © OpenMapTiles, données © contributeurs OpenStreetMap.</p>
        </>
      ) : (
        <div class="card warn tight row" style="flex-direction:row">
          <IconHorsLigne size={20} />
          <span class="small">Hors ligne : pas de carte ni de nouveaux lieux. Ton carnet reste consultable, avec les distances.</span>
        </div>
      )}

      <section class="col" style="gap:8px" aria-label="Résultats par distance">
        {resultats.length === 0 && (
          <p class="vide-etat">
            {vue === 'evenements'
              ? 'Aucun événement enregistré sur cette période. Ajoute-en un avec « + Événement ».'
              : 'Rien dans ce rayon avec ces filtres. Élargis le rayon ou passe sur « Tous ».'}
          </p>
        )}
        {resultats.slice(0, 60).map((l) => (
          <LigneLieu key={l.cle} l={l} today={today} nowMin={nowMin} couleur={couleur(l)} choisi={selection.includes(l.cle)} onChoisir={() => basculerSel(l.cle)} onOuvrir={() => setFiche(l.cle)} />
        ))}
        {vue === 'evenements' && (
          <a class="small strong" href="https://brocabrac.fr/13/marseille/" target="_blank" rel="noopener" style="padding:4px">Voir les brocantes à venir sur Brocabrac, puis ajoute celles qui t’intéressent</a>
        )}
      </section>

      {selection.length > 0 && (
        <div class="hero" style="position:sticky;bottom:calc(var(--tab-h) + 12px + var(--safe-b));z-index:15;padding:12px 14px;gap:8px">
          <div class="row between">
            <span class="strong">{selection.length} lieu{selection.length > 1 ? 'x' : ''} sélectionné{selection.length > 1 ? 's' : ''}</span>
            <button class="btn s ghost" style="color:inherit;border-color:var(--hero-track)" onClick={() => setSelection([])}>Vider</button>
          </div>
          <button class="btn light" onClick={() => setFeuille('tournee')}>Créer la tournée</button>
        </div>
      )}

      {ficheItem && (
        <FicheLieu
          l={ficheItem}
          origine={origine}
          today={today}
          nowMin={nowMin}
          choisi={selection.includes(ficheItem.cle)}
          onChoisir={() => basculerSel(ficheItem.cle)}
          onAjouter={() => { ajouterAuCarnet(ficheItem); setFiche(null); }}
          onIgnorer={() => { store.put('decouvertes', { id: ficheItem.osmId.replace('/', '-'), osmId: ficheItem.osmId, statut: 'ignore' }); setFiche(null); }}
          onClose={() => setFiche(null)}
        />
      )}
      {feuille === 'adresse' && <ChoixAdresse titre="Partir d’une adresse" pres={origine} onClose={() => setFeuille(null)} onChoix={(p) => { setDepart({ mode: 'adresse', point: p }); setFeuille(null); }} actionSecondaire={{ label: 'Choisir et enregistrer comme domicile', faire: (p) => { store.patch('settings', 'main', { domicile: p }); setDepart({ mode: 'domicile' }); setFeuille(null); toast('Domicile enregistré.'); } }} />}
      {feuille === 'domicile' && <ChoixAdresse titre="Mon domicile" pres={origine} onClose={() => setFeuille(null)} onChoix={(p) => { store.patch('settings', 'main', { domicile: p }); setDepart({ mode: 'domicile' }); setFeuille(null); toast('Domicile enregistré.'); }} />}
      {feuille === 'evenement' && <NouvelEvenement pres={origine} domicile={domicile} onClose={() => setFeuille(null)} />}
      {feuille === 'tournee' && (
        <CreerTournee
          items={selection.map((cle) => tous.find((x) => x.cle === cle)).filter(Boolean)}
          origine={domicile}
          ajouterAuCarnet={ajouterAuCarnet}
          onClose={() => setFeuille(null)}
          onFini={() => { setSelection([]); setFeuille(null); }}
        />
      )}
    </main>
  );
}

function horaireDuJour(l, iso) {
  const p = plagesDuJour(l, iso);
  if (p.length) return p.map((o) => `${o.debut}–${o.fin}`).join(', ');
  if (l.horairesTexte) return l.horairesTexte;
  return (l.ouverture || []).length ? 'Fermé aujourd’hui' : 'Horaires inconnus';
}

function LigneLieu({ l, today, nowMin, couleur, choisi, onChoisir, onOuvrir }) {
  return (
    <div class={'item' + (choisi ? ' sel' : '')} style="align-items:flex-start">
      <span aria-hidden="true" style={`width:30px;height:30px;border-radius:15px;flex-shrink:0;margin-top:2px;background:${couleur.couleur};border:3px solid ${couleur.bord === '#ffffff' ? 'transparent' : couleur.bord};color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center`}>{couleur.lettre}</span>
      <button class="col grow" style="background:none;border:0;padding:0;text-align:left;cursor:pointer;color:inherit;gap:3px" onClick={onOuvrir}>
        <span class="t ellipsis">{l.nom}</span>
        <span class="st ellipsis">{TYPES_LIEU[l.type] || l.type} · {fmtKm(l.km)} · {minutesPour(l.km, 'pied') ?? '?'} min à pied · {minutesPour(l.km, 'velo') ?? '?'} min à vélo</span>
        <span class="row wrap" style="gap:6px">
          {l.evt ? (
            <span class="pill accent">{l.date ? fmtCourt(l.date) : '–'}</span>
          ) : l.horairesConnus ? (
            <span class={'pill ' + (l.ouvertNow ? 'green' : '')}>{l.ouvertAuj ? `${l.ouvertNow ? 'Ouvert' : 'Fermé'} · ${horaireDuJour(l, today)}` : 'Fermé aujourd’hui'}</span>
          ) : (
            <span class="pill orange">Horaires à vérifier</span>
          )}
          {l.rent?.parHeure != null && <span class={'pill ' + (l.rent.parHeure >= SEUIL_RENTABLE ? 'green' : 'red')}>{fmtE(Math.round(l.rent.parHeure))}/h</span>}
          {l.visiteDeja && l.rent?.parHeure == null && <span class="pill">Déjà visité</span>}
          {l.decouverte && <span class="pill orange">À découvrir</span>}
          {l.carnet && l.aValider && <span class="pill">À valider</span>}
        </span>
      </button>
      <button class="chip" style="min-width:44px;padding:0 10px" aria-pressed={choisi} aria-label={choisi ? `Retirer ${l.nom} de la tournée` : `Ajouter ${l.nom} à la tournée`} onClick={onChoisir}>{choisi ? '✓' : '+'}</button>
    </div>
  );
}

function FicheLieu({ l, origine, today, nowMin, choisi, onChoisir, onAjouter, onIgnorer, onClose }) {
  const km = distanceKm(origine, l);
  const r = l.rent;
  return (
    <Feuille titre={l.nom} onClose={onClose}>
      <span class="row wrap" style="gap:6px">
        <span class="pill accent">{TYPES_LIEU[l.type] || l.type}</span>
        {l.decouverte && <span class="pill orange">À découvrir · OpenStreetMap</span>}
        {l.evt && l.date && <span class="pill solid">{fmtCourt(l.date)}</span>}
      </span>
      {l.adresse && <span class="small">{l.adresse}</span>}
      <div class="grid3">
        <div class="stat"><b>{fmtKm(km)}</b><span>distance</span></div>
        <div class="stat"><b>{minutesPour(km, 'pied') ?? '?'} min</b><span>à pied</span></div>
        <div class="stat"><b>{minutesPour(km, 'velo') ?? '?'} min</b><span>à vélo</span></div>
      </div>
      <div class="card tight">
        <div class="ligne"><span>Aujourd’hui</span><span>{horaireDuJour(l, today)}</span></div>
        {!l.evt && (l.ouverture || []).length > 0 && <div class="ligne"><span>Maintenant</span><span>{ouvertMaintenant(l, today, nowMin) ? 'Ouvert' : 'Fermé'}</span></div>}
        {l.horairesTexte && <div class="ligne"><span>Horaires OSM</span><span style="white-space:normal;text-align:right">{l.horairesTexte}</span></div>}
        {r && (r.sorties > 0 || r.achetes > 0) ? (
          <div class="ligne"><span>Ta rentabilité</span><span>{r.parHeure != null ? `${fmtE(Math.round(r.parHeure * 10) / 10)}/h` : 'pas encore assez de temps'} · {r.achetes} achetées, {r.vendus} vendues</span></div>
        ) : (
          <div class="ligne"><span>Ta rentabilité</span><span>jamais visité</span></div>
        )}
      </div>
      <span class="small strong">Itinéraire</span>
      <div class="grid3">
        <a class="btn s ghost" href={lienItineraire('plans', 'transports', origine, l)} target="_blank" rel="noopener">Plans · bus/tram</a>
        <a class="btn s ghost" href={lienItineraire('plans', 'pied', origine, l)} target="_blank" rel="noopener">Plans · à pied</a>
        <a class="btn s ghost" href={lienItineraire('google', 'velo', origine, l)} target="_blank" rel="noopener">Google · vélo</a>
      </div>
      <a class="small strong" href={lienItineraire('google', 'transports', origine, l)} target="_blank" rel="noopener">Google Maps · transports</a>
      <div class="btns">
        <button class="btn primary" onClick={() => { onChoisir(); onClose(); }}>{choisi ? 'Retirer de la tournée' : 'Ajouter à la tournée'}</button>
        {l.decouverte && <button class="btn ghost" onClick={onAjouter}>Ajouter à mon carnet</button>}
        {l.decouverte && <button class="btn s ghost" onClick={onIgnorer}>Ne plus me le proposer</button>}
        {l.carnet && <button class="btn s ghost" onClick={() => { onClose(); aller(`/lieu/${l.id}`); }}>Ouvrir la fiche du carnet</button>}
      </div>
    </Feuille>
  );
}

function ChoixAdresse({ titre, pres, onChoix, onClose, actionSecondaire }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [err, setErr] = useState('');
  const [choisi, setChoisi] = useState(null);
  const t = useRef(null);
  const chercher = (v) => {
    setQ(v);
    setChoisi(null);
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      try {
        setRes(await chercherAdresse(v, pres));
        setErr('');
      } catch (e) {
        setErr(navigator.onLine ? e.message : 'Pas de réseau.');
      }
    }, 250);
  };
  return (
    <Feuille titre={titre} onClose={onClose}>
      <label class="search">
        <IconLoupe size={20} />
        <span class="sr">Adresse</span>
        <input type="search" value={q} autocomplete="off" placeholder="12 rue…, Marseille" onInput={(e) => chercher(e.currentTarget.value)} />
      </label>
      {err && <span class="small" style="color:var(--red-ink)">{err}</span>}
      {res.map((r) => (
        <button key={r.label + r.lat} class={'item' + (choisi === r ? ' sel' : '')} onClick={() => (actionSecondaire ? setChoisi(r) : onChoix(r))}>
          <IconPin size={18} />
          <span class="t">{r.label}</span>
        </button>
      ))}
      {choisi && (
        <div class="btns">
          <button class="btn primary" onClick={() => onChoix(choisi)}>Partir d’ici</button>
          <button class="btn s ghost" onClick={() => actionSecondaire.faire(choisi)}>{actionSecondaire.label}</button>
        </div>
      )}
      <span class="xs muted">Adresses : Base Adresse Nationale (IGN).</span>
    </Feuille>
  );
}

function NouvelEvenement({ pres, domicile, onClose }) {
  const { store, today, toast } = useApp();
  const [f, setF] = useState({ lien: '', nom: '', type: 'vide-grenier', date: today, debut: '07:00', fin: '13:00' });
  const [adr, setAdr] = useState(null);
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const t = useRef(null);
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const chercher = (v) => {
    setQ(v);
    setAdr(null);
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      try {
        setRes(await chercherAdresse(v, pres));
      } catch {
        setRes([]);
      }
    }, 250);
  };
  const lireLien = (v) => {
    const n = { ...f, lien: v };
    try {
      const u = new URL(v);
      const morceaux = u.pathname.split('/').filter(Boolean).pop() || '';
      const nom = decodeURIComponent(morceaux).replace(/^\d+-?/, '').replace(/[-_]+/g, ' ').trim();
      if (nom && !f.nom) n.nom = nom.charAt(0).toUpperCase() + nom.slice(1);
      const d = v.match(/(20\d{2})-?(\d{2})-?(\d{2})/);
      if (d) n.date = `${d[1]}-${d[2]}-${d[3]}`;
      if (/brocante/i.test(v)) n.type = 'brocante';
      if (/braderie/i.test(v)) n.type = 'braderie';
    } catch {
      /* pas une URL */
    }
    setF(n);
  };
  const enregistrer = () => {
    if (!f.nom.trim()) return toast('Donne un nom à l’événement.');
    if (!adr && !q.trim()) return toast('Indique l’adresse.');
    store.put('lieux', {
      nom: f.nom.trim(),
      type: f.type,
      adresse: adr ? adr.label : q.trim(),
      lat: adr?.lat ?? null,
      lon: adr?.lon ?? null,
      ouverture: [{ date: f.date, debut: f.debut, fin: f.fin }],
      heureIdeale: f.debut,
      acces: accesEstime(domicile, adr),
      notes: f.lien ? `Annonce : ${f.lien}` : '',
      lien: f.lien || '',
      aValider: false,
      actif: true,
      source: 'manuel'
    });
    toast('Événement ajouté.');
    onClose();
  };
  return (
    <Feuille titre="Nouvel événement" onClose={onClose}>
      <Champ label="Lien de l’annonce (facultatif)"><input class="input" inputMode="url" value={f.lien} placeholder="Colle le lien de la brocante" onInput={(e) => lireLien(e.currentTarget.value)} /></Champ>
      <Champ label="Nom"><input class="input" value={f.nom} onInput={maj('nom')} /></Champ>
      <div class="chips">
        {TYPES_EVENEMENTS.map((t2) => <button key={t2} class="chip" aria-pressed={f.type === t2} onClick={() => setF({ ...f, type: t2 })}>{TYPES_LIEU[t2]}</button>)}
      </div>
      <div class="grid3">
        <Champ label="Date"><input class="input" type="date" value={f.date} min={today} onInput={maj('date')} /></Champ>
        <Champ label="De"><input class="input" type="time" value={f.debut} onInput={maj('debut')} /></Champ>
        <Champ label="À"><input class="input" type="time" value={f.fin} onInput={maj('fin')} /></Champ>
      </div>
      <Champ label="Adresse"><input class="input" value={adr ? adr.label : q} autocomplete="off" onInput={(e) => chercher(e.currentTarget.value)} /></Champ>
      {!adr && res.slice(0, 4).map((r) => <button key={r.label} class="item" onClick={() => { setAdr(r); setRes([]); }}><IconPin size={18} /><span class="t">{r.label}</span></button>)}
      <button class="btn primary" onClick={enregistrer}>Enregistrer</button>
    </Feuille>
  );
}

function CreerTournee({ items, origine, ajouterAuCarnet, onClose, onFini }) {
  const { store, state, s, today, toast } = useApp();
  const ordre = ordreTournee(origine, items);
  const jours = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const [date, setDate] = useState(() => {
    const e = ordre.find((l) => estEvenement(l.type));
    return (e && prochaineDate(e, today, 14)) || today;
  });
  const lundi = mondayOf(date);
  const sem = semaineInfo(state, lundi, s);
  const [heure, setHeure] = useState(() => {
    const p = plagesDuJour(ordre[0] || {}, date)[0];
    return p?.debut || ([0, 6].includes(dayOfWeek(date)) ? '07:00' : '14:00');
  });
  const fermes = ordre.filter((l) => (l.ouverture || []).length && !ouvertLe(l, date));
  const transport = coutTournee(ordre.map((l) => ({ acces: l.acces || accesEstime(origine, l) })), s.transport);
  const budgetVerrouille = sem.verrouillee ? Math.max(0, sem.nonAlloue) : null;
  const pleine = sem.sorties.length >= s.discipline.sortiesMaxSemaine;
  const longueur = ordre.reduce((t, l, i) => t + (distanceKm(i ? ordre[i - 1] : origine, l) || 0), 0);

  const creer = () => {
    if (pleine) return toast(`Tu as déjà ${s.discipline.sortiesMaxSemaine} sorties cette semaine-là.`);
    if (budgetVerrouille === 0) return toast('Semaine verrouillée sans budget disponible.');
    const ids = ordre.map((l) => (l.carnet ? l.id : ajouterAuCarnet(l, true)));
    store.put('sorties', {
      date,
      heure,
      lieuxIds: ids,
      budget: budgetVerrouille ?? 0,
      piecesMax: s.discipline.piecesMax,
      transportPrevu: transport,
      statut: 'prevue'
    });
    if (!sem.verrouillee) {
      queueMicrotask(() => {
        for (const r of repartitionBudget(store.state, lundi, s, today)) store.patch('sorties', r.id, { budget: r.budget });
      });
    }
    toast(`Tournée créée le ${fmtCourt(date)}.`);
    onFini();
    aller(date >= addDays(mondayOf(today), 7) ? '/semaine?w=1' : '/semaine');
  };

  return (
    <Feuille titre="Tournée" onClose={onClose}>
      <span class="small muted">Ordre le plus court depuis ton domicile · environ {fmtKm(longueur)} en tout.</span>
      {ordre.map((l, i) => (
        <div key={l.cle} class="item" style="min-height:52px">
          <span class="big" style="font-size:16px;width:22px">{i + 1}</span>
          <span class="col grow"><span class="t ellipsis">{l.nom}</span><span class="st">{horaireDuJour(l, date)}</span></span>
        </div>
      ))}
      {fermes.length > 0 && <div class="card warn tight"><span class="small">Fermé ce jour-là : {fermes.map((l) => l.nom).join(', ')}.</span></div>}
      <div class="grid2">
        <Champ label="Jour">
          <select class="input" value={date} onChange={(e) => setDate(e.currentTarget.value)}>
            {jours.map((d) => <option key={d} value={d}>{fmtCourt(d)}</option>)}
          </select>
        </Champ>
        <Champ label="Arrivée au 1er lieu"><input class="input" type="time" value={heure} onInput={(e) => setHeure(e.currentTarget.value)} /></Champ>
      </div>
      <div class="card tight">
        <div class="ligne"><span>Budget de la sortie</span><span>{sem.verrouillee ? fmtE(budgetVerrouille) + ' (reste de la semaine)' : 'réparti automatiquement'}</span></div>
        <div class="ligne"><span>Transport estimé</span><span>{fmtE(transport)}</span></div>
        <div class="ligne"><span>Sorties cette semaine-là</span><span>{sem.sorties.length} / {s.discipline.sortiesMaxSemaine}</span></div>
      </div>
      <button class="btn primary big" disabled={pleine} onClick={creer}>Créer la sortie</button>
    </Feuille>
  );
}
