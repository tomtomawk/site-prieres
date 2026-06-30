# Audit graphique et technique

Date de l'audit : 2026-06-29

## Etat verifie

- Site servi localement depuis `public/` sur `http://127.0.0.1:4173/`.
- Verification technique passee avec le Node embarque :
  - `node --check script.js`
  - `node --check scripts/build-prayers.mjs`
  - `node scripts/build-prayers.mjs --check`
- `public/index.html`, `public/script.js` et `public/style.css` sont synchronises avec les sources.
- Rendu controle en desktop `1280x720` et mobile `375x812`, en mode francais et en mode francais/latin.

## Synthese

Le site a une base solide : generation statique claire, textes sources en Markdown, rendu sans framework, ambiance graphique coherente avec un missel, et comportement responsive globalement stable. Les risques principaux ne sont pas des erreurs bloquantes, mais des points de finition : accessibilite des controles, lisibilite du mode bilingue sur mobile, ergonomie des notifications et de la lecture vocale, puis documentation trop courte pour expliquer le fonctionnement reel du projet.

## Audit graphique

### Points forts

- Direction visuelle coherente : fond ivoire, papier central, rouge rubric, typographie serif, ornements religieux discrets.
- La structure "journee" matin / midi / soir est lisible et adaptee au contenu.
- Le mode francais/latin en vis-a-vis fonctionne bien sur desktop : deux colonnes, separation claire, largeur de lecture agrandie.
- Aucun debordement horizontal reel detecte en desktop ou mobile.
- Le panneau de parametres mobile reste dans le viewport et n'entre pas en conflit avec les boutons fixes du bas.

### Points a corriger

1. Premier ecran parfois deroutant
   - La page defile automatiquement vers la priere correspondant a l'heure courante.
   - C'est utile, mais un visiteur peut arriver directement au milieu du contenu sans voir le titre ni comprendre la logique.
   - Correction possible : ajouter une indication discrete de priere active, ou limiter l'autoscroll a un parametre explicite.

2. Mode bilingue mobile dense
   - Le vis-a-vis francais/latin tient techniquement, mais devient tres serre sur `375px`.
   - Les colonnes restent lisibles, mais l'experience est plus fatigante sur longues prieres.
   - Correction possible : sur mobile, proposer un mode alterne par paragraphe ou un basculement "vis-a-vis / empile".

3. Controle de langue peu explicite
   - L'icone `AE`/`Æ` et les boutons `FR` / `LAT` sont compacts, mais le mode parallele est implicite : il faut comprendre que les deux boutons actifs signifient "francais + latin".
   - Correction possible : etat visuel ou libelle court pour le mode parallele.

4. Boutons fixes nombreux
   - Sur mobile, le selecteur de langue, le retour haut et la roue des parametres occupent trois zones fixes.
   - L'ensemble reste fonctionnel, mais peut donner une sensation chargee sur les longs textes.
   - Correction possible : regrouper langue + parametres dans une barre compacte ou masquer le retour haut plus tard.

5. Bouton lecture trop discret
   - Le bouton `Lire` est petit et place juste sous les titres.
   - Il n'indique pas clairement qu'il s'agit d'une lecture vocale.
   - Correction possible : remplacer par un bouton avec icone/texte plus explicite, par exemple "Ecouter".

## Audit accessibilite

1. Noms accessibles insuffisants
   - Le bouton parametres est annonce comme `⚙` dans le snapshot navigateur.
   - Les boutons de lecture sont tous annonces `Lire`, sans nom de priere.
   - Le bouton de fermeture du panneau est annonce `×`.
   - Correction : ajouter des `aria-label` explicites, par exemple `Ouvrir les parametres`, `Lire la priere du soir`, `Fermer les parametres`.

2. Gestion du panneau parametres incomplete
   - Le panneau s'ouvre et se ferme correctement.
   - Il manque probablement la fermeture par `Escape`, le retour de focus au bouton d'ouverture, et une gestion plus nette du clic hors panneau.

3. Notifications a clarifier
   - Les notifications ne fonctionnent que tant que la page reste ouverte.
   - Le texte le dit, mais le README devra aussi l'expliquer pour eviter une attente de rappel en arriere-plan.

4. Lecture vocale dependante du navigateur
   - `speechSynthesis` est utilise directement.
   - Le latin peut ne pas disposer d'une voix adaptee selon le navigateur.
   - Le README doit presenter cette fonction comme une aide dependante du navigateur, pas comme une garantie.

## Audit technique

### Points forts

- Architecture statique simple :
  - `prieres/` contient les sources Markdown.
  - `templates/index.template.html` porte la structure.
  - `scripts/build-prayers.mjs` genere `public/`.
  - `script.js` et `style.css` sont copies dans `public/`.
- `npm run check` est bien pense : il verifie la syntaxe JS et que `public/` est a jour.
- Le generateur echappe le HTML avant rendu Markdown inline.
- Le site ne depend pas d'un framework frontend.
- Le stockage local est protege par `try/catch`.
- Le mode `prefers-reduced-motion` est pris en compte.

### Risques et fragilites

1. Parseur Markdown maison limite
   - Le rendu supporte titres `###`, paragraphes, listes simples, emphase, gras et liens HTTP.
   - C'est suffisant pour les prieres actuelles, mais fragile si les sources evoluent : listes imbriquees, citations, liens relatifs, caracteres Markdown complexes.
   - Correction possible : documenter strictement le format accepte ou introduire un parseur Markdown controle.

2. Couplage fort entre planning et code
   - Les chapitres et horaires par defaut sont dans `scripts/build-prayers.mjs`.
   - Les reglages dynamiques sont dans `script.js`.
   - Les fichiers Markdown ne pilotent pas le planning.
   - Correction possible : garder ce choix mais le documenter, ou extraire le planning dans une donnees JSON/source unique.

3. Fonctions frontales longues
   - `script.js` gere langue, horaires, Angélus, notifications, lecture vocale, scroll actif et animations dans un seul bloc.
   - C'est encore maintenable, mais les prochaines corrections gagneraient a regrouper les responsabilites par petites sections/fonctions.

4. Autoscroll au chargement
   - `scrollIntoView` oriente automatiquement vers la priere courante.
   - Fonctionnel, mais cela complique la perception du premier ecran et peut surprendre.
   - Correction a arbitrer fonctionnellement avant modification.

5. Absence de tests automatises de comportement
   - Les checks actuels valident la generation et la syntaxe.
   - Ils ne couvrent pas les scenarios utilisateur : changement de langue, ouverture parametres, activation Angélus, modification d'horaires, notifications, lecture vocale.
   - Correction possible : ajouter un petit script de smoke test DOM avec `jsdom` ou Playwright si le projet accepte une dependance dev.

6. README incomplet par rapport au site reel
   - Le README explique la generation et Cloudflare, mais pas les fonctionnalites visibles : modes de langue, horaires personnalisables, Angélus, notifications, lecture vocale, autoscroll.
   - Il ne donne pas de guide de correction/maintenance pour le planning et les limites Markdown.

## Priorites de correction

1. Accessibilite des controles
   - Ajouter `aria-label` aux boutons parametres, fermeture et lecture.
   - Ameliorer le texte du bouton lecture.
   - Ajouter fermeture `Escape` et retour focus du panneau.

2. Clarification UX de la langue
   - Rendre le mode parallele plus explicite.
   - Verifier que l'etat actif est comprehensible sans deviner.

3. Mobile bilingue
   - Decider si le vis-a-vis reste par defaut sur mobile ou si un affichage empile est preferable.
   - Eviter une densite trop forte sur les longues prieres.

4. Autoscroll
   - Decider si l'ouverture directe sur la priere courante reste le comportement attendu.
   - Si oui, ajouter un repere visuel clair.

5. Documentation
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
