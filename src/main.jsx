import { render } from 'preact';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/unbounded/latin-500.css';
import '@fontsource/unbounded/latin-700.css';
import './styles.css';
import { FIREBASE_CONFIG, RECAPTCHA_SITE_KEY } from './config.js';
import { createStore } from './data/store.js';
import { localAdapter } from './data/adapterLocal.js';
import { App } from './ui/App.jsx';
import { Login } from './ui/Login.jsx';

const ESSAI = import.meta.env.VITE_ESSAI === '1';
const EMULATEUR = import.meta.env.VITE_EMULATEUR === '1';
const root = document.getElementById('app');

async function demarrer() {
  if (ESSAI || (!FIREBASE_CONFIG && !EMULATEUR)) {
    const store = createStore(localAdapter(ESSAI ? 'vintedflow-essai' : 'vintedflow'));
    render(<App store={store} essai={ESSAI} sansConfig={!ESSAI} />, root);
    return;
  }

  const config = FIREBASE_CONFIG || { apiKey: 'demo-key', projectId: 'demo-vintedflow', authDomain: 'demo-vintedflow.firebaseapp.com', appId: '1:1:web:1' };
  const [{ initializeApp }, authMod, { firestoreAdapter }, { configurerIA }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('./data/adapterFirestore.js'),
    import('./ai/gemini.js')
  ]);
  const app = initializeApp(config);

  if (RECAPTCHA_SITE_KEY && !EMULATEUR) {
    try {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
    } catch (e) {
      console.warn('App Check indisponible', e);
    }
  }

  const auth = authMod.initializeAuth(app, {
    persistence: [authMod.indexedDBLocalPersistence, authMod.browserLocalPersistence]
  });
  if (EMULATEUR) authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  configurerIA(EMULATEUR ? null : app);

  let store = null;
  authMod.onAuthStateChanged(auth, (user) => {
    if (user) {
      if (!store || store.uid !== user.uid) {
        store = createStore(
          firestoreAdapter({
            app,
            uid: user.uid,
            emulateur: EMULATEUR ? { host: '127.0.0.1', port: 8080 } : null,
            onSignOut: () => authMod.signOut(auth)
          })
        );
        store.uid = user.uid;
        store.email = user.email;
        store.app = app;
      }
      render(<App store={store} />, root);
    } else {
      store = null;
      render(<Login auth={auth} authMod={authMod} />, root);
    }
  });
}

demarrer();
