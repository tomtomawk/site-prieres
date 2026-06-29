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

  const sections = [...document.querySelectorAll(".prayer-time")];
  const navLinks = [...document.querySelectorAll(".nav-link")];
  const mainNavigation = document.querySelector(".main-nav");
  const backToTop = document.querySelector(".back-to-top");
  const translationToggle = document.querySelector(".translation-toggle");
  const languageOptions = [...translationToggle.querySelectorAll(".language-option")];
  const settingsToggle = document.querySelector(".settings-toggle");
  const settingsPanel = document.querySelector(".settings-panel");
  const settingsClose = document.querySelector(".settings-close");
  const settingsForm = document.querySelector(".settings-form");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const defaultAngelusSettings = {
    enabled: true,
    morning: "06:00",
    noon: "12:00",
    evening: "18:00"
  };

  const angelusEntries = {
    morning: { id: "angelus-matin", inputName: "angelusMorning", duration: 30 },
    noon: { id: "angelus-midi", inputName: "angelusNoon", duration: 15 },
    evening: { id: "angelus-soir", inputName: "angelusEvening", duration: 90 }
  };

  const fixedPrayerTimes = {
    "priere-matin": "06:30",
    "repas-matin": "07:00",
    "repas-midi": "12:15",
    "repas-soir": "19:30",
    "priere-soir": "21:30"
  };

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

  function parseTimeToMinutes(value) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

    if (!match) {
      return null;
    }

    return Number(match[1]) * 60 + Number(match[2]);
  }

  function formatTimeLabel(value) {
    return value.replace(":", "h");
  }

  function sanitizeAngelusSettings(settings) {
    return {
      enabled: typeof settings.enabled === "boolean" ? settings.enabled : defaultAngelusSettings.enabled,
      morning: parseTimeToMinutes(settings.morning) === null ? defaultAngelusSettings.morning : settings.morning,
      noon: parseTimeToMinutes(settings.noon) === null ? defaultAngelusSettings.noon : settings.noon,
      evening: parseTimeToMinutes(settings.evening) === null ? defaultAngelusSettings.evening : settings.evening
    };
  }

  function loadAngelusSettings() {
    try {
      const savedSettings = JSON.parse(localStorage.getItem("prayer-angelus-settings") || "{}");
      return sanitizeAngelusSettings({ ...defaultAngelusSettings, ...savedSettings });
    } catch (error) {
      return defaultAngelusSettings;
    }
  }

  function saveAngelusSettings(settings) {
    try {
      localStorage.setItem("prayer-angelus-settings", JSON.stringify(settings));
    } catch (error) {
      // Les paramètres restent appliqués pour la session courante.
    }
  }

  let angelusSettings = loadAngelusSettings();

  function setSettingsPanelOpen(isOpen) {
    settingsPanel.hidden = !isOpen;
    settingsToggle.setAttribute("aria-expanded", String(isOpen));
  }

  function updateAngelusTime(entryId, value) {
    const label = formatTimeLabel(value);
    const sectionTime = document.querySelector(`#${entryId} .prayer-time-marker time`);
    const scheduleTime = document.querySelector(`.chapter-schedule-link[href="#${entryId}"] time`);

    [sectionTime, scheduleTime].forEach((timeElement) => {
      if (!timeElement) {
        return;
      }

      timeElement.textContent = label;
      timeElement.setAttribute("datetime", value);
    });
  }

  function getPrayerTime(section) {
    const key = Object.entries(angelusEntries).find(([, entry]) => entry.id === section.id)?.[0];

    if (key) {
      return angelusSettings[key];
    }

    return fixedPrayerTimes[section.id] || "23:59";
  }

  function sortChapterPrayers(chapter) {
    const header = chapter.querySelector(".chapter-header");
    const schedule = chapter.querySelector(".chapter-schedule");
    const chapterSections = [...chapter.querySelectorAll(".prayer-time")];

    chapterSections
      .sort((first, second) => (
        parseTimeToMinutes(getPrayerTime(first)) - parseTimeToMinutes(getPrayerTime(second))
      ))
      .forEach((section) => {
        chapter.append(section);
        const scheduleLink = schedule.querySelector(`.chapter-schedule-link[href="#${section.id}"]`);

        if (scheduleLink) {
          schedule.append(scheduleLink);
        }
      });

    chapter.prepend(header);
  }

  function sortPrayersBySettings() {
    document.querySelectorAll(".day-chapter").forEach(sortChapterPrayers);
  }

  function applyAngelusSettings() {
    settingsForm.elements.angelusEnabled.checked = angelusSettings.enabled;
    settingsForm.elements.angelusMorning.value = angelusSettings.morning;
    settingsForm.elements.angelusNoon.value = angelusSettings.noon;
    settingsForm.elements.angelusEvening.value = angelusSettings.evening;

    Object.entries(angelusEntries).forEach(([key, entry]) => {
      const section = document.getElementById(entry.id);
      const scheduleLink = document.querySelector(`.chapter-schedule-link[href="#${entry.id}"]`);

      section?.classList.toggle("is-hidden-by-settings", !angelusSettings.enabled);
      scheduleLink?.classList.toggle("is-hidden-by-settings", !angelusSettings.enabled);
      updateAngelusTime(entry.id, angelusSettings[key]);
    });

    sortPrayersBySettings();
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
  applyAngelusSettings();

  settingsToggle.addEventListener("click", () => {
    setSettingsPanelOpen(settingsPanel.hidden);
  });

  settingsClose.addEventListener("click", () => {
    setSettingsPanelOpen(false);
  });

  settingsForm.addEventListener("input", () => {
    angelusSettings = sanitizeAngelusSettings({
      enabled: settingsForm.elements.angelusEnabled.checked,
      morning: settingsForm.elements.angelusMorning.value,
      noon: settingsForm.elements.angelusNoon.value,
      evening: settingsForm.elements.angelusEvening.value
    });
    applyAngelusSettings();
    setActiveSection(getPrayerIdForDate(new Date()));
    saveAngelusSettings(angelusSettings);
  });

  settingsForm.querySelector(".settings-reset").addEventListener("click", () => {
    angelusSettings = { ...defaultAngelusSettings };
    applyAngelusSettings();
    setActiveSection(getPrayerIdForDate(new Date()));
    saveAngelusSettings(angelusSettings);
  });

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
  function getPrayerIdForDate(date) {
    const minutes = date.getHours() * 60 + date.getMinutes();
    const orderedPrayers = [...document.querySelectorAll(".prayer-time:not(.is-hidden-by-settings)")]
      .map((section) => ({ id: section.id, minutes: parseTimeToMinutes(getPrayerTime(section)) }))
      .sort((first, second) => first.minutes - second.minutes);
    const activePrayer = orderedPrayers.filter((prayer) => prayer.minutes <= minutes).at(-1);

    return activePrayer?.id || orderedPrayers.at(-1)?.id || "priere-soir";
  }

  /** Met à jour le lien actif et son information pour les lecteurs d'écran. */
  function setActiveSection(sectionId) {
    const activeSection = document.getElementById(sectionId);
    const activeChapterId = activeSection?.dataset.chapter || sectionId;

    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${activeChapterId}`;
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    sections.forEach((section) => {
      section.classList.toggle("is-active", section.id === sectionId);
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
      const chapterId = link.getAttribute("href").slice(1);
      const firstPrayer = document.querySelector(`.prayer-time[data-chapter="${chapterId}"]`);
      setActiveSection(firstPrayer?.id || chapterId);
    });
  });

  // Oriente la page vers la prière correspondant à l'heure locale.
  const prayerId = getPrayerIdForDate(new Date());
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
