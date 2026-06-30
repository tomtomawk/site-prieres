### Points a corriger

1. Premier ecran parfois deroutant
   - La page defile automatiquement vers la priere correspondant a l'heure courante.
   - Réponse : Le désativer à la première visite et ajouter une indication discrète de priere active

2. Mode bilingue mobile dense
   - Le vis-a-vis francais/latin tient techniquement, mais devient tres serre sur `375px`.
   - Reponse : Effet missel conservé

3. Controle de langue peu explicite
   - L'icone `AE`/`Æ` et les boutons `FR` / `LAT` sont compacts, mais le mode parallele est implicite : il faut comprendre que les deux boutons actifs signifient "francais + latin".
   - Réponse : A conserver, l'utilisateur clique sur latin : le français se conserve, le latin s'active donc on comprends le fonctionnement au tap/clique.

4. Boutons fixes nombreux
   - Sur mobile, le selecteur de langue, le retour haut et la roue des parametres occupent trois zones fixes.
   - L'ensemble reste fonctionnel, mais peut donner une sensation chargee sur les longs textes.
   - Réponse : bouton parametres plus gros pas dans un rond blanc, masquer le retour haut plus tard.

5. Bouton lecture trop discret
   - Le bouton `Lire` est petit et place juste sous les titres.
   - Il n'indique pas clairement qu'il s'agit d'une lecture vocale.
   - Réponse : remplacer par un bouton avec icone ""écouter "nom de la prière"".

## Points accessibilites

1. Noms accessibles insuffisants
   - Le bouton parametres est annonce comme `⚙` dans le snapshot navigateur.
   - Les boutons de lecture sont tous annonces `Lire`, sans nom de priere.
   - Le bouton de fermeture du panneau est annonce `×`.
   - Correction : ajouter des `aria-label` explicites, par exemple `Ouvrir les parametres`, `Lire la priere du soir`, `Fermer les parametres`.

2. Gestion du panneau parametres incomplete
   - Le panneau s'ouvre et se ferme correctement.
   - Correction : fermeture par `Escape`, le retour de focus au bouton d'ouverture, et une gestion plus nette du clic hors panneau.

## Points techniques

1. Parseur Markdown maison limite
   - Le rendu supporte titres `###`, paragraphes, listes simples, emphase, gras et liens HTTP.
   - C'est suffisant pour les prieres actuelles, mais fragile si les sources evoluent : listes imbriquees, citations, liens relatifs, caracteres Markdown complexes.
   - Correction : documenter strictement le format accepte

2. Couplage fort entre planning et code
   - Les chapitres et horaires par defaut sont dans `scripts/build-prayers.mjs`.
   - Les reglages dynamiques sont dans `script.js`.
   - Les fichiers Markdown ne pilotent pas le planning.
   - Correction : extraire le planning dans une donnees JSON/source unique.

3. Fonctions frontales longues
   - `script.js` gere langue, horaires, Angélus, notifications, lecture vocale, scroll actif et animations dans un seul bloc.
   - Correction regrouper les responsabilites par petites sections/fonctions.

4. Autoscroll au chargement
   - `scrollIntoView` oriente automatiquement vers la priere courante.
   - Fonctionnel, mais cela complique la perception du premier ecran et peut surprendre.
   - Correction vue plus haut

5. Absence de tests automatises de comportement
   - Les checks actuels valident la generation et la syntaxe.
   - Ils ne couvrent pas les scenarios utilisateur : changement de langue, ouverture parametres, activation Angélus, modification d'horaires, notifications, lecture vocale.
   - Correction : ajouter un petit script de smoke test DOM avec `jsdom` ou Playwright.

6. README incomplet par rapport au site reel
   - Le README explique la generation et Cloudflare, mais pas les fonctionnalites visibles : modes de langue, horaires personnalisables, Angélus, notifications, lecture vocale, autoscroll.
   - Il ne donne pas de guide de correction/maintenance pour le planning et les limites Markdown.
   - Correction : A ajouter au Readme

   - Refaire le README apres corrections avec :
     - presentation du site ;
     - structure des fichiers ;
     - commandes de build/check ;
     - format Markdown accepte ;
     - fonctionnement du planning ;
     - limites des notifications et de la lecture vocale ;
     - deploiement Cloudflare Pages / Workers Builds.

## Notes pour la suite

- Ne pas modifier directement `public/index.html` pour les textes : modifier `prieres/` et reconstruire.
- Les corrections visuelles doivent etre faites dans `style.css`, puis validees via `npm run build` ou `node scripts/build-prayers.mjs`.
- Toute correction de template doit etre faite dans `templates/index.template.html`, puis regeneree.
- Garder une validation desktop et mobile apres chaque correction touchant aux controles fixes ou au mode bilingue.
