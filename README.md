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

Le dossier `public/` est généré automatiquement. Il ne faut pas modifier directement les blocs de prières contenus dans `public/index.html`.

Pour vérifier que le JavaScript et la page générée sont à jour :

```sh
npm run check
```

## Cloudflare Pages

- Commande de build : `npm run build`
- Dossier de sortie : `public`

## Cloudflare Workers Builds

Le fichier `wrangler.jsonc` permet aussi le déploiement avec la commande utilisée par Cloudflare Workers Builds :

```sh
npx wrangler versions upload
```

Wrangler publie uniquement le contenu statique du dossier `public/`.

## Structure

- `prieres/` : sources Markdown
- `templates/index.template.html` : structure générale de la page
- `scripts/build-prayers.mjs` : générateur statique
- `public/` : page générée et assets statiques transmis à Cloudflare
