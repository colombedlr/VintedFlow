import { useState } from 'preact/hooks';
import { Etincelle } from './base.jsx';

const ERREURS = {
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/wrong-password': 'Mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cet e-mail.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail : connecte-toi.',
  'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
  'auth/invalid-email': 'E-mail invalide.',
  'auth/network-request-failed': 'Pas de réseau. La première connexion demande Internet ; ensuite l’app marche hors ligne.',
  'auth/admin-restricted-operation': 'La création de compte est fermée sur ce projet.',
  'auth/too-many-requests': 'Trop d’essais. Attends quelques minutes.'
};

export function Login({ auth, authMod }) {
  const [mode, setMode] = useState('connexion');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [attente, setAttente] = useState(false);

  const envoyer = async (e) => {
    e.preventDefault();
    setErreur('');
    setAttente(true);
    try {
      if (mode === 'connexion') await authMod.signInWithEmailAndPassword(auth, email.trim(), mdp);
      else await authMod.createUserWithEmailAndPassword(auth, email.trim(), mdp);
    } catch (err) {
      setErreur(ERREURS[err?.code] || 'Connexion impossible. Réessaie.');
    } finally {
      setAttente(false);
    }
  };

  const oubli = async () => {
    if (!email.trim()) return setErreur('Écris d’abord ton e-mail.');
    try {
      await authMod.sendPasswordResetEmail(auth, email.trim());
      setInfo('E-mail de réinitialisation envoyé.');
    } catch (err) {
      setErreur(ERREURS[err?.code] || 'Envoi impossible.');
    }
  };

  return (
    <main class="page" style="justify-content:center;min-height:100dvh;padding-bottom:40px;max-width:440px">
      <span class="row" style="font-family:var(--display);font-weight:700;font-size:26px;gap:10px"><Etincelle size={22} color="var(--accent)" />VintedFlow</span>
      <p class="muted">{mode === 'connexion' ? 'Connecte-toi pour retrouver tes données sur l’iPhone et le Mac.' : 'Crée ton compte (une seule fois).'}</p>
      <form class="card" onSubmit={envoyer}>
        <label class="field"><span>E-mail</span><input class="input" type="email" autocomplete="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} required /></label>
        <label class="field"><span>Mot de passe</span><input class="input" type="password" autocomplete={mode === 'connexion' ? 'current-password' : 'new-password'} value={mdp} onInput={(e) => setMdp(e.currentTarget.value)} required minLength={6} /></label>
        {erreur && <span class="small" style="color:var(--red-ink)">{erreur}</span>}
        {info && <span class="small" style="color:var(--green-ink)">{info}</span>}
        <button class="btn primary big" type="submit" disabled={attente}>{attente ? '…' : mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}</button>
        <button class="btn s ghost" type="button" onClick={() => { setMode(mode === 'connexion' ? 'creation' : 'connexion'); setErreur(''); }}>
          {mode === 'connexion' ? 'Première fois ? Créer mon compte' : 'J’ai déjà un compte'}
        </button>
        {mode === 'connexion' && <button class="btn s ghost" type="button" onClick={oubli}>Mot de passe oublié</button>}
      </form>
    </main>
  );
}
