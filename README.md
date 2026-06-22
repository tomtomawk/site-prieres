# Site de prières

Site statique bilingue de prières et de ressources catholiques traditionnelles.

## Stack

- Markdown pour les textes des prières
- HTML, CSS et JavaScript sans framework
- Génération statique avec Node.js
- Hébergement sur Cloudflare Pages

## Modifier ou ajouter une prière

Les textes se trouvent dans [`prieres/`](prieres/). Chaque fichier Markdown contient :

- les titres et libellés français/latin dans le bloc placé entre `---` ;
- une section `## Français` ;
- une section `## Latin`.

Après une modification, reconstruisez la page :

```sh
npm run build
```

Le fichier `index.html` est généré automatiquement. Il ne faut pas modifier directement les blocs de prières qu’il contient.

Pour vérifier que le JavaScript et la page générée sont à jour :

```sh
npm run check
```

## Cloudflare Pages

- Commande de build : `npm run build`
- Dossier de sortie : `.`

## Structure

- `prieres/` : sources Markdown
- `templates/index.template.html` : structure générale de la page
- `scripts/build-prayers.mjs` : générateur statique
- `index.html` : page générée publiée
