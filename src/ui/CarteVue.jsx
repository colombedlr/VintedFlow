// Carte MapLibre (fond OpenFreeMap, données OpenStreetMap). Chargée seulement quand on l'ouvre.
import { useEffect, useRef, useState } from 'preact/hooks';

let libPromise = null;
function chargerLib() {
  if (!libPromise) {
    libPromise = Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl.css'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url')
    ]).then(([lib, , worker]) => {
      lib.setWorkerUrl(worker.default);
      return lib;
    });
  }
  return libPromise;
}

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

function elementEpingle(p) {
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', p.titre);
  el.textContent = p.lettre;
  el.style.cssText = `width:30px;height:30px;border-radius:15px;border:3px solid ${p.bord};background:${p.couleur};color:#fff;font:700 13px Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.35);padding:0;${p.selection ? 'outline:3px solid #4b3bff;outline-offset:2px;' : ''}`;
  return el;
}

export function CarteVue({ origine, points, onSelect, hauteur = '42vh' }) {
  const conteneur = useRef(null);
  const carte = useRef(null);
  const lib = useRef(null);
  const marqueurs = useRef([]);
  const [etat, setEtat] = useState('chargement');

  useEffect(() => {
    let vivant = true;
    chargerLib()
      .then((ml) => {
        if (!vivant || !conteneur.current) return;
        lib.current = ml;
        const m = new ml.Map({
          container: conteneur.current,
          style: STYLE,
          center: [origine.lon, origine.lat],
          zoom: 13,
          attributionControl: { compact: true }
        });
        m.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
        m.on('load', () => vivant && setEtat('ok'));
        m.on('error', () => vivant && setEtat((e) => (e === 'chargement' ? 'erreur' : e)));
        carte.current = m;
      })
      .catch(() => vivant && setEtat('erreur'));
    return () => {
      vivant = false;
      carte.current?.remove();
      carte.current = null;
    };
  }, []);

  useEffect(() => {
    const m = carte.current;
    const ml = lib.current;
    if (!m || !ml) return;
    marqueurs.current.forEach((x) => x.remove());
    marqueurs.current = [];
    const o = document.createElement('div');
    o.setAttribute('aria-label', 'Point de départ');
    o.style.cssText = 'width:18px;height:18px;border-radius:9px;background:#0e0e12;border:3px solid #fff;box-shadow:0 0 0 2px #0e0e12';
    marqueurs.current.push(new ml.Marker({ element: o }).setLngLat([origine.lon, origine.lat]).addTo(m));
    const bornes = new ml.LngLatBounds([origine.lon, origine.lat], [origine.lon, origine.lat]);
    for (const p of points) {
      const el = elementEpingle(p);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(p.id);
      });
      marqueurs.current.push(new ml.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(m));
      bornes.extend([p.lon, p.lat]);
    }
    if (points.length) m.fitBounds(bornes, { padding: 48, maxZoom: 15, duration: 400 });
    else m.easeTo({ center: [origine.lon, origine.lat], zoom: 14, duration: 400 });
  }, [etat, origine.lat, origine.lon, points.map((p) => p.id + p.couleur + p.bord + (p.selection ? 1 : 0)).join('|')]);

  return (
    <div style={`position:relative;height:${hauteur};min-height:260px;border-radius:22px;overflow:hidden;background:var(--surface-2)`}>
      <div ref={conteneur} style="position:absolute;inset:0" />
      {etat !== 'ok' && (
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;pointer-events:none" class="small muted">
          {etat === 'chargement' ? 'Chargement de la carte…' : 'Carte indisponible. La liste ci-dessous reste utilisable.'}
        </div>
      )}
    </div>
  );
}
