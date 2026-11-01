# VintedFlow

Web app personnelle pour l'achat-revente Y2K sur Vinted à Marseille : planifier les sorties, acheter avec discipline (budget, sacs, feu vert/orange/rouge, contrôle contrefaçon), gérer le stock par lots et suivre l'objectif du mois.

- iPhone : ouvrir l'adresse dans Safari, puis Partager → Sur l'écran d'accueil.
- Mac : ouvrir l'adresse dans Safari, puis Fichier → Ajouter au Dock.
- Hors connexion : tout se saisit sans réseau, la synchronisation se fait seule au retour du réseau (Firestore, cache persistant).

## Structure

- `src/data` : modèle de données, catalogue des marques, lieux de Marseille, adaptateurs (Firestore et local).
- `src/logic` : règles d'achat, dates et jours ouvrés, calculs (objectif, trésorerie, rentabilité), planning.
- `src/ui` : écrans (Aujourd'hui, Semaine, Lieux, Sortie, Vérifier, Marques, Stock, Bilan, Réglages).
- `src/ai/gemini.js` : analyse photo et fiche marque (Firebase AI Logic, Gemini).
- `firestore.rules` : règles de sécurité à coller dans la console Firebase.

## Commandes

```
npm install
npm test            # tests des règles et des calculs
npm run build       # version installable (dist/)
npm run build:essai # version d'essai sans Firebase (dist-essai/)
```

La configuration Firebase se met dans `src/config.js`.
