# Site de prières quotidiennes

Site statique de prières catholiques en français et en latin, pensé comme un petit missel numérique consultable sans framework.

## Fonctionnalités

- Prières organisées par moments de la journée : matin, midi et soir.
- Affichage français, latin, ou français/latin en vis-à-vis.
- Indication discrète de la prière active.
- Horaires personnalisables depuis le panneau de paramètres.
- Angélus activable ou masquable selon l’usage.
- Chapelet optionnel avec mystères adaptés au jour.
- Notifications locales optionnelles, tant que la page reste ouverte.
- Lecture vocale via les capacités du navigateur.
- Génération statique dans `public/` pour Cloudflare Pages ou Workers Builds.

## Structure

- `prieres/` : textes sources des prières en Markdown.
- `prayer-schedule.json` : planning de la journée, horaires par défaut et rattachement des prières aux chapitres.
- `templates/index.template.html` : structure HTML générale.
- `scripts/build-prayers.mjs` : générateur statique.
- `script.js` : interactions côté navigateur.
- `style.css` : mise en page et thème graphique.
- `public/` : site généré à publier.
- `AUDIT.md` : audit graphique et technique utilisé pour guider les corrections.
- `consigne suite AUDIT.md` : décisions de correction après audit.

## Installation

Le projet utilise Node.js pour générer la page.

```sh
npm install
```

Si `npm` n’est pas disponible dans l’environnement local, il reste possible de lancer directement le script avec Node :

```sh
node scripts/build-prayers.mjs
```

## Générer le site

Après modification d’une prière, du planning, du template, du CSS ou du JS :

```sh
npm run build
```

Cette commande génère :

- `public/index.html`
- `public/style.css`
- `public/script.js`

Ne modifiez pas directement les blocs de prières dans `public/index.html` : ils sont régénérés depuis `prieres/`, `prayer-schedule.json` et `templates/index.template.html`.

## Vérifier

```sh
npm run check
```

Le check vérifie :

- la syntaxe de `script.js` ;
- la syntaxe de `scripts/build-prayers.mjs` ;
- la synchronisation entre les sources et le dossier `public/`.

## Ajouter ou modifier une prière

Les fichiers Markdown de `prieres/` commencent par un bloc de métadonnées :

```md
---
id: matin
nav_fr: Matin
nav_la: Mane
moment_fr: Au commencement du jour
moment_la: Initio diei
title_fr: Prière du matin
title_la: Oratio matutina
---
```

La métadonnée `order` n'est plus obligatoire. L'ordre d'affichage public vient du fichier `prayer-schedule.json`. Elle peut rester dans d'anciens fichiers comme repère interne, mais elle n'est pas nécessaire pour ajouter une prière.

Chaque fichier doit ensuite contenir deux sections dans cet ordre :

```md
## Français

Texte français.

## Latin

Texte latin.
```

Format Markdown accepté par le générateur :

- titres `###` ;
- paragraphes simples ;
- listes simples commençant par `- ` ;
- emphase `*texte*` ;
- gras `**texte**` ;
- liens HTTP ou HTTPS.

Le générateur maison ne gère pas volontairement tout Markdown : évitez les tableaux, citations, listes imbriquées et HTML brut.

## Modifier le planning

Le planning se trouve dans `prayer-schedule.json`.

Chaque entrée indique :

- `id` : identifiant HTML unique de l’entrée ;
- `prayerId` : prière source à utiliser depuis `prieres/` ;
- `time` : horaire par défaut au format `HHhMM` ;
- `settingKey` : clé utilisée par le JavaScript pour les réglages ;
- `inputName` : champ correspondant dans le panneau de paramètres ;
- `angelusKey` et `duration` pour les entrées d’Angélus ;
- `optionalKey` pour masquer une prière tant que son option n'est pas activée ;
- `rosary` pour indiquer que l'entrée doit afficher les mystères du Chapelet selon le jour.

Le Chapelet est déclaré dans `prieres/05-chapelet.md` et branché au soir dans `prayer-schedule.json`. Les mystères affichés automatiquement sont :

- lundi et mercredi : joyeux ;
- mardi et vendredi : douloureux ;
- jeudi, samedi et dimanche : glorieux.

Après une modification :

```sh
npm run build
npm run check
```

## Comportements navigateur

Le site mémorise localement :

- le mode de langue choisi ;
- les horaires personnalisés ;
- l’activation de l’Angélus ;
- l'activation du Chapelet ;
- l’activation des notifications ;
- le fait que la première visite a déjà eu lieu.

À la première visite, la page ne défile plus automatiquement vers la prière de l’heure courante. Aux visites suivantes, elle peut rejoindre directement la prière correspondant à l’heure locale.

Les notifications utilisent l’API `Notification` du navigateur. Elles ne fonctionnent pas comme un service en arrière-plan : la page doit rester ouverte.

La lecture vocale utilise `speechSynthesis`. La qualité et la disponibilité des voix, surtout en latin, dépendent du navigateur et du système.

## Déploiement Cloudflare

Cloudflare Pages :

- commande de build : `npm run build`
- dossier de sortie : `public`

Cloudflare Workers Builds peut utiliser `wrangler.jsonc` :

```sh
npx wrangler versions upload
```

Wrangler publie uniquement le contenu statique du dossier `public/`.
