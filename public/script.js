/**
 * Comportements de la page :
 * - choix automatique de la prière selon l'heure locale ;
 * - mise en évidence de la section lue ;
 * - apparition douce des sections ;
 * - affichage du bouton de retour en haut.
 */

document.documentElement.classList.add("js-enabled");

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const sections = [...document.querySelectorAll(".prayer-section")];
  const navLinks = [...document.querySelectorAll(".nav-link")];
  const mainNavigation = document.querySelector(".main-nav");
  const backToTop = document.querySelector(".back-to-top");
  const translationToggle = document.querySelector(".translation-toggle");
  const languageOptions = [...translationToggle.querySelectorAll(".language-option")];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const languageModes = ["french", "latin", "parallel"];
  const languageModeDetails = {
    french: {
      label: "FR",
      name: "français",
      htmlLang: "fr",
      pageTitle: "Prières quotidiennes",
      navLabel: "Prières de la journée",
      backLabel: "Retourner en haut de la page"
    },
    latin: {
      label: "LAT",
      name: "latin",
      htmlLang: "la",
      pageTitle: "Preces quotidianae",
      navLabel: "Preces diei",
      backLabel: "Ad summum paginae redire"
    },
    parallel: {
      label: "FR | LAT",
      name: "français et latin en vis-à-vis",
      htmlLang: "fr",
      pageTitle: "Prières quotidiennes — Français et latin",
      navLabel: "Prières de la journée",
      backLabel: "Retourner en haut de la page"
    }
  };

  function getLanguagesFromMode(mode) {
    if (mode === "latin") {
      return { fr: false, la: true };
    }

    if (mode === "parallel") {
      return { fr: true, la: true };
    }

    return { fr: true, la: false };
  }

  function getModeFromLanguages(languages) {
    if (languages.fr && languages.la) {
      return "parallel";
    }

    if (languages.la) {
      return "latin";
    }

    return "french";
  }

  /** Applique le mode choisi et le conserve pour la prochaine visite. */
  function setLanguageMode(mode) {
    const safeMode = languageModes.includes(mode) ? mode : "french";
    const details = languageModeDetails[safeMode];
    const displayedLanguages = getLanguagesFromMode(safeMode);

    document.documentElement.dataset.languageMode = safeMode;
    document.documentElement.lang = details.htmlLang;
    document.title = details.pageTitle;
    mainNavigation.setAttribute("aria-label", details.navLabel);
    backToTop.setAttribute("aria-label", details.backLabel);

    languageOptions.forEach((option) => {
      const isSelected = Boolean(displayedLanguages[option.dataset.language]);
      option.classList.toggle("is-selected", isSelected);
      option.setAttribute("aria-pressed", String(isSelected));
    });

    translationToggle.setAttribute("aria-label", `Langues affichées : ${details.name}`);

    try {
      localStorage.setItem("prayer-language-mode", safeMode);
    } catch (error) {
      // Le changement reste fonctionnel si le stockage local est indisponible.
    }
  }

  let savedLanguageMode = "french";

  try {
    savedLanguageMode = localStorage.getItem("prayer-language-mode") || "french";
  } catch (error) {
    // Le français reste le mode par défaut.
  }

  setLanguageMode(savedLanguageMode);

  languageOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const currentLanguages = getLanguagesFromMode(document.documentElement.dataset.languageMode);
      const language = option.dataset.language;

      currentLanguages[language] = !currentLanguages[language];

      if (!currentLanguages.fr && !currentLanguages.la) {
        currentLanguages[language] = true;
      }

      setLanguageMode(getModeFromLanguages(currentLanguages));
    });
  });

  /** Retourne l'identifiant de la prière adaptée à l'heure locale. */
  function getPrayerIdForHour(hour) {
    if (hour >= 5 && hour < 12) {
      return "matin";
    }

    if (hour >= 12 && hour < 19) {
      return "benedicite";
    }

    return "soir";
  }

  /** Met à jour le lien actif et son information pour les lecteurs d'écran. */
  function setActiveSection(sectionId) {
    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${sectionId}`;
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  // Active l'animation progressive sans masquer le contenu si JS est coupé.
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    // Un simple contact avec la zone visible suffit : sur mobile, une longue
    // prière peut être plus de dix fois plus haute que l'écran et ne jamais
    // atteindre un seuil calculé en pourcentage de sa hauteur totale.
    }, { rootMargin: "0px 0px -8%", threshold: 0 });

    sections.forEach((section) => revealObserver.observe(section));

    // La section la plus présente dans la zone de lecture devient active.
    const navigationObserver = new IntersectionObserver((entries) => {
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visibleEntries.length > 0) {
        setActiveSection(visibleEntries[0].target.id);
      }
    }, { rootMargin: "-25% 0px -50%", threshold: [0.05, 0.25, 0.5] });

    sections.forEach((section) => navigationObserver.observe(section));
  } else {
    // Compatibilité avec les navigateurs plus anciens.
    sections.forEach((section) => section.classList.add("is-visible"));
  }

  // Le bouton reste discret tant que le visiteur est proche du haut de page.
  function updateBackToTop() {
    backToTop.classList.toggle("is-visible", window.scrollY > 500);
  }

  window.addEventListener("scroll", updateBackToTop, { passive: true });
  updateBackToTop();

  // Les liens du menu reflètent immédiatement le choix de l'utilisateur.
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setActiveSection(link.getAttribute("href").slice(1));
    });
  });

  // Oriente la page vers la prière correspondant à l'heure locale.
  const prayerId = getPrayerIdForHour(new Date().getHours());
  const targetSection = document.getElementById(prayerId);
  setActiveSection(prayerId);

  if (targetSection) {
    // Deux images d'animation laissent le navigateur terminer sa mise en page.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        targetSection.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start"
        });
      });
    });
  }
});
