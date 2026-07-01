# Equity Split Studio — PürInstinct

Outil interactif pour simuler et discuter la répartition d'équité entre
fondateurs, contributeurs clés, et rôles de direction (C-suite) pour
PürInstinct / PürInstinct Games / INSTINCT.

## Fonctionnalités

- **Split fondateurs** — trois méthodes de calcul (contribution pondérée,
  égalitaire, basée sur le marché), avec curseurs par facteur (idée, temps,
  risque, exécution, capital, réseau).
- **Simulation de ronde de financement** — dilution, recharge du pool ESOP,
  post-money.
- **Vesting** — cliff et durée ajustables, visualisation du déblocage.
- **Structure de direction (C-suite)** — 6 rôles pré-configurés (CEO, COO,
  CFO, CMO, Logistique & production événement, Creative director), avec :
  - un champ pour inscrire le nom pressenti sur chaque poste,
  - un champ "% temps plein" pour refléter les rôles fractionnaires,
  - un onglet **apport individuel par critère** (curseurs par personne),
  - un onglet **poids par catégorie** (curseurs globaux appliqués à tous
    les rôles à la fois).

Tout est calculé en direct côté client — aucune donnée n'est envoyée où que
ce soit.

## Installation

```bash
npm install
npm run dev
```

Ouvre ensuite `http://localhost:5173`.

## Build de production

```bash
npm run build
npm run preview
```

Les fichiers statiques sont générés dans `dist/`.

## Stack

- React 18
- Vite
- Tailwind CSS
- [recharts](https://recharts.org/) — camemberts de répartition
- [lucide-react](https://lucide.dev/) — icônes

## Structure

```
src/
  App.jsx        — composant principal (tout l'outil)
  main.jsx       — point d'entrée React
  index.css      — Tailwind
index.html
vite.config.js
tailwind.config.js
postcss.config.js
```

## Notes

- Toutes les valeurs par défaut (Dominique Soucy, CEO, etc.) sont éditables
  directement dans l'interface — rien n'est codé en dur de façon permanente.
- Le pool ESOP, les poids de facteurs et le pourcentage temps plein sont
  indépendants entre la section "Fondateurs" et la section "Structure de
  direction" pour permettre de les faire varier séparément.
