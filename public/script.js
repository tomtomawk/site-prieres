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
  const scheduleLinks = [...document.querySelectorAll(".chapter-schedule-link")];
  const mainNavigation = document.querySelector(".main-nav");
  const backToTop = document.querySelector(".back-to-top");
  const currentPrayer = document.querySelector(".current-prayer");
  const currentPrayerLink = document.querySelector(".current-prayer-link");
  const translationToggle = document.querySelector(".translation-toggle");
  const languageOptions = [...translationToggle.querySelectorAll(".language-option")];
  const settingsToggle = document.querySelector(".settings-toggle");
  const settingsPanel = document.querySelector(".settings-panel");
  const settingsClose = document.querySelector(".settings-close");
  const settingsForm = document.querySelector(".settings-form");
  const notificationPermission = document.querySelector(".notification-permission");
  const speechButtons = [...document.querySelectorAll(".speech-toggle")];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const firstVisitStorageKey = "prayer-has-visited";

  const defaultPrayerSettings = {
    enabled: false,
    rosaryEnabled: false,
    notificationsEnabled: false
  };

  const timeInputsBySettingKey = {};
  const angelusEntries = {};
  const optionalEntries = [];

  sections.forEach((section) => {
    const { settingKey, inputName, defaultTime, angelusKey, angelusDuration, optionalKey } = section.dataset;

    if (!settingKey || !inputName || parseTimeToMinutes(defaultTime) === null) {
      return;
    }

    defaultPrayerSettings[settingKey] = defaultTime;
    timeInputsBySettingKey[settingKey] = inputName;

    if (angelusKey) {
      angelusEntries[angelusKey] = {
        id: section.id,
        inputName,
        duration: Number(angelusDuration) || 0
      };
    }

    if (optionalKey) {
      optionalEntries.push({
        id: section.id,
        optionalKey
      });
    }
  });

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

  function sanitizePrayerSettings(settings) {
    return Object.fromEntries(Object.entries(defaultPrayerSettings).map(([key, defaultValue]) => {
      if (typeof defaultValue === "boolean") {
        return [key, typeof settings[key] === "boolean" ? settings[key] : defaultValue];
      }

      return [
        key,
        parseTimeToMinutes(settings[key]) === null ? defaultValue : settings[key]
      ];
    }));
  }

  function loadPrayerSettings() {
    try {
      const savedSettings = JSON.parse(localStorage.getItem("prayer-schedule-settings") || "{}");
      const legacySettings = JSON.parse(localStorage.getItem("prayer-angelus-settings") || "{}");
      return sanitizePrayerSettings({ ...defaultPrayerSettings, ...legacySettings, ...savedSettings });
    } catch (error) {
      return defaultPrayerSettings;
    }
  }

  function savePrayerSettings(settings) {
    try {
      localStorage.setItem("prayer-schedule-settings", JSON.stringify(settings));
    } catch (error) {
      // Les paramètres restent appliqués pour la session courante.
    }
  }

  let prayerSettings = loadPrayerSettings();

  function setSettingsPanelOpen(isOpen, options = {}) {
    settingsPanel.hidden = !isOpen;
    settingsToggle.setAttribute("aria-expanded", String(isOpen));
    settingsToggle.setAttribute("aria-label", isOpen ? "Paramètres ouverts" : "Ouvrir les paramètres");

    if (isOpen && options.focusPanel) {
      settingsClose.focus();
    }

    if (!isOpen && options.restoreFocus) {
      settingsToggle.focus();
    }
  }

  function updatePrayerTime(entryId, value) {
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
    return prayerSettings[section.dataset.settingKey] || section.dataset.defaultTime || "23:59";
  }

  function getChapterIdForTime(value) {
    const minutes = parseTimeToMinutes(value);

    if (minutes === null) {
      return "soir";
    }

    if (minutes >= 5 * 60 && minutes < 12 * 60) {
      return "matin";
    }

    if (minutes >= 12 * 60 && minutes < 19 * 60) {
      return "midi";
    }

    return "soir";
  }

  function movePrayerToChapter(section) {
    const targetChapterId = getChapterIdForTime(getPrayerTime(section));
    const targetChapter = document.getElementById(targetChapterId);
    const targetSchedule = targetChapter?.querySelector(".chapter-schedule");
    const scheduleLink = document.querySelector(`.chapter-schedule-link[href="#${section.id}"]`);

    if (!targetChapter || !targetSchedule) {
      return;
    }

    section.dataset.chapter = targetChapterId;
    targetChapter.append(section);

    if (scheduleLink) {
      targetSchedule.append(scheduleLink);
    }
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
    sections.forEach(movePrayerToChapter);
    document.querySelectorAll(".day-chapter").forEach(sortChapterPrayers);
  }

  function getSectionTitle(section) {
    const mode = document.documentElement.dataset.languageMode;

    if (mode === "latin") {
      return section.dataset.titleLa || section.dataset.titleFr || "Prière";
    }

    return section.dataset.titleFr || section.dataset.titleLa || "Prière";
  }

  function getNotificationSchedule() {
    return [...document.querySelectorAll(".prayer-time:not(.is-hidden-by-settings)")]
      .map((section) => ({
        id: section.id,
        title: getSectionTitle(section),
        minutes: parseTimeToMinutes(getPrayerTime(section))
      }))
      .filter((entry) => Number.isFinite(entry.minutes));
  }

  let notificationTimer = null;
  let lastNotificationKey = "";
  let speechSessionId = 0;

  function updateNotificationPermissionState() {
    const isSupported = "Notification" in window;
    const permission = isSupported ? Notification.permission : "unsupported";

    notificationPermission.disabled = !isSupported || permission === "granted";
    notificationPermission.textContent = permission === "granted"
      ? "Autorisées"
      : "Autoriser";
  }

  function maybeNotifyCurrentPrayer() {
    if (!prayerSettings.notificationsEnabled || !("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentPrayer = getNotificationSchedule().find((entry) => entry.minutes === currentMinutes);
    const notificationKey = currentPrayer ? `${currentPrayer.id}-${now.toDateString()}-${currentMinutes}` : "";

    if (!currentPrayer || notificationKey === lastNotificationKey) {
      return;
    }

    lastNotificationKey = notificationKey;
    new Notification("Temps de prière", {
      body: currentPrayer.title,
      tag: currentPrayer.id
    });
  }

  function restartNotificationTimer() {
    if (notificationTimer) {
      window.clearInterval(notificationTimer);
      notificationTimer = null;
    }

    if (!prayerSettings.notificationsEnabled) {
      return;
    }

    maybeNotifyCurrentPrayer();
    notificationTimer = window.setInterval(maybeNotifyCurrentPrayer, 30000);
  }

  function getSpeechText(section) {
    const mode = document.documentElement.dataset.languageMode;
    const selectors = mode === "latin"
      ? [".prayer-la"]
      : mode === "parallel"
        ? [".prayer-fr", ".prayer-la"]
        : [".prayer-fr"];

    return selectors
      .map((selector) => section.querySelector(selector)?.textContent.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function getSpeechChunks(text, maxLength = 2800) {
    const chunks = [];
    const parts = text.replace(/\s+/g, " ").match(/[^.!?;:]+[.!?;:]?/g) || [];
    let currentChunk = "";

    parts.forEach((part) => {
      const nextChunk = currentChunk ? `${currentChunk} ${part}` : part;

      if (nextChunk.length <= maxLength) {
        currentChunk = nextChunk;
        return;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      if (part.length <= maxLength) {
        currentChunk = part;
        return;
      }

      for (let index = 0; index < part.length; index += maxLength) {
        chunks.push(part.slice(index, index + maxLength));
      }

      currentChunk = "";
    });

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  function updateSpeechButtons(activeButton = null) {
    speechButtons.forEach((button) => {
      const isActive = button === activeButton;
      const isLatin = document.documentElement.dataset.languageMode === "latin";
      const title = isLatin ? button.dataset.speechTitleLa : button.dataset.speechTitleFr;
      const actionFr = button.querySelector(".speech-action-fr");
      const actionLa = button.querySelector(".speech-action-la");

      button.classList.toggle("is-speaking", isActive);
      button.setAttribute("aria-pressed", String(isActive));
      button.setAttribute("aria-label", `${isActive ? "Arrêter la lecture de" : "Écouter"} ${title}`);
      button.title = `${isActive ? "Arrêter" : "Écouter"} ${title}`;

      if (actionFr) {
        actionFr.textContent = isActive ? "Arrêter" : "Écouter";
      }

      if (actionLa) {
        actionLa.textContent = isActive ? "Sistere" : "Audire";
      }
    });
  }

  function getRosaryMysteryForDate(date) {
    const day = date.getDay();

    if (day === 2 || day === 5) {
      return "douloureux";
    }

    if (day === 1 || day === 4) {
      return "joyeux";
    }

    return "glorieux";
  }

  const virtualRosaryPrayers = {
    signe: {
      name: "Signe de la Croix",
      text: "Au nom du Père, et du Fils, et du Saint-Esprit. Ainsi soit-il."
    },
    credo: {
      name: "Je crois en Dieu",
      long: true,
      text: "Je crois en Dieu, le Père tout-puissant, créateur du ciel et de la terre ; et en Jésus-Christ, son Fils unique, notre Seigneur, qui a été conçu du Saint-Esprit, est né de la Vierge Marie, a souffert sous Ponce Pilate, a été crucifié, est mort et a été enseveli, est descendu aux enfers, le troisième jour est ressuscité des morts, est monté aux cieux, est assis à la droite de Dieu le Père tout-puissant, d'où il viendra juger les vivants et les morts. Je crois au Saint-Esprit, à la sainte Église catholique, à la communion des saints, à la rémission des péchés, à la résurrection de la chair, à la vie éternelle. Ainsi soit-il."
    },
    pater: {
      name: "Notre Père",
      text: "Notre Père, qui êtes aux cieux, que votre nom soit sanctifié, que votre règne arrive, que votre volonté soit faite sur la terre comme au ciel. Donnez-nous aujourd'hui notre pain de chaque jour. Pardonnez-nous nos offenses, comme nous pardonnons à ceux qui nous ont offensés. Et ne nous laissez pas succomber à la tentation. Mais délivrez-nous du mal. Ainsi soit-il."
    },
    ave: {
      name: "Je vous salue Marie",
      text: "Je vous salue, Marie, pleine de grâce, le Seigneur est avec vous. Vous êtes bénie entre toutes les femmes, et Jésus, le fruit de vos entrailles, est béni. Sainte Marie, Mère de Dieu, priez pour nous, pauvres pécheurs, maintenant et à l'heure de notre mort. Ainsi soit-il."
    },
    gloria: {
      name: "Gloire au Père",
      text: "Gloire soit au Père, et au Fils, et au Saint-Esprit. Comme il était au commencement, maintenant et toujours, et dans les siècles des siècles. Ainsi soit-il."
    },
    domine: {
      name: "Ô mon Jésus",
      text: "Ô mon Jésus, pardonnez-nous nos péchés, préservez-nous du feu de l'enfer, conduisez au Ciel toutes les âmes, surtout celles qui ont le plus besoin de votre miséricorde. Ainsi soit-il."
    }
  };

  const virtualRosaryMysteries = {
    joyeux: {
      label: "Joyeux",
      items: [
        { title: "L'Annonciation", verse: "« Voici la servante du Seigneur ; que tout m'advienne selon ta parole. » (Lc 1, 38)", fruit: "Fruit du mystère : l'humilité" },
        { title: "La Visitation", verse: "« Tu es bénie entre toutes les femmes, et le fruit de tes entrailles est béni. » (Lc 1, 42)", fruit: "Fruit du mystère : la charité fraternelle" },
        { title: "La Nativité", verse: "« Elle mit au monde son fils premier-né ; elle l'emmaillota et le coucha dans une mangeoire. » (Lc 2, 7)", fruit: "Fruit du mystère : l'esprit de pauvreté" },
        { title: "La Présentation au Temple", verse: "« Mes yeux ont vu le salut que tu préparais à la face des peuples. » (Lc 2, 30-31)", fruit: "Fruit du mystère : l'obéissance et la pureté" },
        { title: "Le Recouvrement de Jésus au Temple", verse: "« Ne saviez-vous pas qu'il me faut être aux affaires de mon Père ? » (Lc 2, 49)", fruit: "Fruit du mystère : la recherche de Dieu" }
      ]
    },
    douloureux: {
      label: "Douloureux",
      items: [
        { title: "L'Agonie à Gethsémani", verse: "« Père, s'il est possible, que cette coupe passe loin de moi ! Cependant, non pas comme moi je veux, mais comme toi tu veux. » (Mt 26, 39)", fruit: "Fruit du mystère : la contrition" },
        { title: "La Flagellation", verse: "« Pilate prit alors Jésus et le fit flageller. » (Jn 19, 1)", fruit: "Fruit du mystère : la mortification des sens" },
        { title: "Le Couronnement d'épines", verse: "« Les soldats tressèrent une couronne avec des épines et la lui mirent sur la tête. » (Jn 19, 2)", fruit: "Fruit du mystère : le courage dans l'épreuve" },
        { title: "Le Portement de croix", verse: "« Portant lui-même sa croix, il sortit vers le lieu dit du Crâne. » (Jn 19, 17)", fruit: "Fruit du mystère : la patience" },
        { title: "La Crucifixion", verse: "« Père, entre tes mains je remets mon esprit. » (Lc 23, 46)", fruit: "Fruit du mystère : l'amour de Dieu et le salut des âmes" }
      ]
    },
    glorieux: {
      label: "Glorieux",
      items: [
        { title: "La Résurrection", verse: "« Pourquoi cherchez-vous le Vivant parmi les morts ? Il n'est pas ici, il est ressuscité. » (Lc 24, 5-6)", fruit: "Fruit du mystère : la foi" },
        { title: "L'Ascension", verse: "« Il fut emporté au ciel et s'assit à la droite de Dieu. » (Mc 16, 19)", fruit: "Fruit du mystère : l'espérance" },
        { title: "La Pentecôte", verse: "« Tous furent remplis d'Esprit Saint. » (Ac 2, 4)", fruit: "Fruit du mystère : la charité et le zèle apostolique" },
        { title: "L'Assomption de Marie", verse: "« Le Puissant fit pour moi des merveilles ; saint est son nom. » (Lc 1, 49)", fruit: "Fruit du mystère : la grâce d'une bonne mort" },
        { title: "Le Couronnement de Marie", verse: "« Un signe grandiose apparut dans le ciel : une femme, ayant le soleil pour manteau, la lune sous les pieds, et sur la tête une couronne de douze étoiles. » (Ap 12, 1)", fruit: "Fruit du mystère : la persévérance et la confiance en Marie" }
      ]
    }
  };

  const virtualRosaryOrdinals = [
    "Premier mystère",
    "Deuxième mystère",
    "Troisième mystère",
    "Quatrième mystère",
    "Cinquième mystère"
  ];

  const virtualRosaryDayNames = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi"
  ];

  const virtualRosaryCategoryOrder = ["joyeux", "douloureux", "glorieux"];
  const virtualRosaryIntroSteps = [
    { type: "signe", shape: "cross" },
    { type: "credo", sameEl: true },
    { type: "pater", r: 10 },
    { type: "ave", r: 7, intention: "pour la foi" },
    { type: "ave", r: 7, intention: "pour l'espérance" },
    { type: "ave", r: 7, intention: "pour la charité" },
    { type: "gloria", r: 8 }
  ];
  const virtualRosaryDecadeSteps = [
    { type: "pater", r: 12, label: "Pater" },
    ...Array.from({ length: 10 }, (_, index) => ({ type: "ave", r: 8, ave: index + 1 })),
    { type: "gloria", r: 10, label: "Gloria" },
    { type: "domine", r: 9, label: "Domine Jesu" }
  ];

  function initVirtualRosary(root, date = new Date()) {
    const svg = root.querySelector("[data-rosary-svg]");
    const stage = root.querySelector("[data-rosary-stage]");
    const dayLabel = root.querySelector("[data-rosary-day]");
    const ordinal = root.querySelector("[data-rosary-ordinal]");
    const title = root.querySelector("[data-rosary-title]");
    const verse = root.querySelector("[data-rosary-verse]");
    const fruit = root.querySelector("[data-rosary-fruit]");
    const prayerName = root.querySelector("[data-rosary-prayer-name]");
    const prayerText = root.querySelector("[data-rosary-prayer-text]");
    const previousButton = root.querySelector("[data-rosary-previous]");
    const nextButton = root.querySelector("[data-rosary-next]");
    const svgNamespace = "http://www.w3.org/2000/svg";
    let categoryOrderIndex = virtualRosaryCategoryOrder.indexOf(getRosaryMysteryForDate(date));
    let category = virtualRosaryCategoryOrder[categoryOrderIndex];
    let mysteryIndex = 0;
    let introActive = true;
    let rosaryDone = false;
    let sequence = [];
    let stepToElement = [];
    let elementFirstStep = [];
    let elementShapes = [];
    let step = -1;

    function buildSequence() {
      sequence = introActive
        ? [...virtualRosaryIntroSteps, ...virtualRosaryDecadeSteps]
        : [...virtualRosaryDecadeSteps];
      stepToElement = [];
      elementFirstStep = [];
      let elementIndex = -1;

      sequence.forEach((definition, index) => {
        if (!definition.sameEl) {
          elementIndex += 1;
          elementFirstStep[elementIndex] = index;
        }

        stepToElement[index] = elementIndex;
      });
    }

    function createSvgElement(name) {
      return document.createElementNS(svgNamespace, name);
    }

    function buildRosary() {
      buildSequence();
      svg.innerHTML = "";
      elementShapes = [];
      const elementCount = elementFirstStep.length;
      const getPosition = (elementIndex) => {
        const ratio = elementIndex / (elementCount - 1);
        return {
          x: 40 + ratio * 600,
          y: 60 + 115 * Math.sin(Math.PI * ratio)
        };
      };
      const chain = createSvgElement("path");
      const chainPath = Array.from({ length: elementCount }, (_, elementIndex) => {
        const point = getPosition(elementIndex);
        return `${elementIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`;
      }).join(" ");

      chain.setAttribute("d", chainPath);
      chain.setAttribute("class", "virtual-rosary-chain");
      svg.append(chain);

      elementFirstStep.forEach((firstStep, elementIndex) => {
        const definition = sequence[firstStep];
        const point = getPosition(elementIndex);
        const group = createSvgElement("g");
        let shape;

        if (definition.shape === "cross") {
          shape = createSvgElement("path");
          shape.setAttribute("d", `M ${point.x} ${point.y - 15} L ${point.x} ${point.y + 15} M ${point.x - 9} ${point.y - 4} L ${point.x + 9} ${point.y - 4}`);
          shape.setAttribute("class", "virtual-rosary-cross");
        } else {
          shape = createSvgElement("circle");
          shape.setAttribute("cx", point.x);
          shape.setAttribute("cy", point.y);
          shape.setAttribute("r", definition.r);
          shape.setAttribute("class", "virtual-rosary-bead");
        }

        group.append(shape);
        elementShapes.push(shape);

        if (definition.label) {
          const label = createSvgElement("text");
          label.setAttribute("x", point.x);
          label.setAttribute("y", point.y - definition.r - 9);
          label.setAttribute("text-anchor", "middle");
          label.setAttribute("class", "virtual-rosary-label");
          label.textContent = definition.label;
          group.append(label);
        }

        svg.append(group);
      });
    }

    function setPrayer(name, text, options = {}) {
      prayerText.classList.add("is-fading");

      window.setTimeout(() => {
        prayerName.textContent = name;
        prayerText.textContent = text;
        prayerText.classList.toggle("is-hint", Boolean(options.hint));
        prayerText.classList.toggle("is-long", Boolean(options.long));
        prayerText.classList.remove("is-fading");
      }, prefersReducedMotion ? 0 : 160);
    }

    function renderMystery() {
      const mystery = virtualRosaryMysteries[category].items[mysteryIndex];
      dayLabel.textContent = `Aujourd'hui ${virtualRosaryDayNames[date.getDay()]} — mystères ${virtualRosaryMysteries[category].label.toLowerCase()}`;
      ordinal.textContent = `${virtualRosaryOrdinals[mysteryIndex]} ${virtualRosaryMysteries[category].label.toLowerCase()}`;
      title.textContent = mystery.title;
      verse.textContent = mystery.verse;
      fruit.textContent = mystery.fruit;
    }

    function render() {
      const currentElement = step >= 0 && step < sequence.length ? stepToElement[step] : -1;

      elementShapes.forEach((shape, elementIndex) => {
        const lastStepOfElement = stepToElement.lastIndexOf(elementIndex);
        shape.classList.toggle("is-done", step > lastStepOfElement);
        shape.classList.toggle("is-current", elementIndex === currentElement);
      });

      if (step === -1) {
        setPrayer("", introActive ? "Touchez la croix pour commencer." : "Touchez la première perle pour commencer la dizaine.", { hint: true });
        return;
      }

      if (step >= sequence.length) {
        if (mysteryIndex < 4) {
          shiftMystery(1);
          return;
        }

        rosaryDone = true;
        const nextCategory = virtualRosaryCategoryOrder[(categoryOrderIndex + 1) % virtualRosaryCategoryOrder.length];
        setPrayer("", `Chapelet terminé. Touchez pour poursuivre avec les mystères ${virtualRosaryMysteries[nextCategory].label.toLowerCase()}.`, { hint: true });
        return;
      }

      const stepDefinition = sequence[step];
      const prayer = virtualRosaryPrayers[stepDefinition.type];
      let name = prayer.name;

      if (stepDefinition.ave) {
        name += ` — ${stepDefinition.ave} / 10`;
      }

      if (stepDefinition.intention) {
        name += ` — ${stepDefinition.intention}`;
      }

      setPrayer(name, prayer.text, { long: prayer.long });
    }

    function goToStep(index) {
      if (index === step) {
        return;
      }

      step = Math.max(0, Math.min(index, sequence.length));
      render();
    }

    function resetDecade() {
      step = -1;
      buildRosary();
      renderMystery();
      render();
    }

    function shiftMystery(delta) {
      introActive = false;
      rosaryDone = false;
      mysteryIndex = (mysteryIndex + delta + 5) % 5;
      resetDecade();
    }

    function goToNextCategory() {
      categoryOrderIndex = (categoryOrderIndex + 1) % virtualRosaryCategoryOrder.length;
      category = virtualRosaryCategoryOrder[categoryOrderIndex];
      mysteryIndex = 0;
      rosaryDone = false;
      resetDecade();
    }

    stage.addEventListener("click", () => {
      if (rosaryDone) {
        goToNextCategory();
        return;
      }

      goToStep(step + 1);
    });

    previousButton.addEventListener("click", () => shiftMystery(-1));
    nextButton.addEventListener("click", () => shiftMystery(1));

    buildRosary();
    renderMystery();
    render();
  }

  function initVirtualRosaries() {
    document.querySelectorAll("[data-virtual-rosary]").forEach((root) => initVirtualRosary(root));
  }

  function getMysteryKeyFromText(text) {
    if (/joyeux|gaudiosa/i.test(text)) {
      return "joyeux";
    }

    if (/douloureux|dolorosa/i.test(text)) {
      return "douloureux";
    }

    if (/glorieux|gloriosa/i.test(text)) {
      return "glorieux";
    }

    return "";
  }

  function applyMysteryVisibility(container, activeMystery) {
    let currentMystery = "";

    [...container.children].forEach((child) => {
      const heading = child.matches(".prayer-subtitle")
        ? child
        : child.querySelector(".prayer-subtitle");
      const mystery = heading ? getMysteryKeyFromText(heading.textContent) : "";

      if (mystery) {
        currentMystery = mystery;
      } else if (heading && currentMystery) {
        currentMystery = "";
      }

      child.hidden = Boolean(currentMystery && currentMystery !== activeMystery);
    });
  }

  function applyRosaryMysteries(date = new Date()) {
    const activeMystery = getRosaryMysteryForDate(date);

    document.querySelectorAll('[data-rosary="true"]').forEach((section) => {
      section.dataset.rosaryMystery = activeMystery;
      section.querySelectorAll(".prayer-language, .prayer-aligned").forEach((container) => {
        applyMysteryVisibility(container, activeMystery);
      });
    });
  }

  function speakPrayer(section, button) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      const actionFr = button.querySelector(".speech-action-fr");
      const actionLa = button.querySelector(".speech-action-la");

      if (actionFr) {
        actionFr.textContent = "Indisponible";
      }

      if (actionLa) {
        actionLa.textContent = "Indisponibile";
      }

      button.setAttribute("aria-label", "Lecture vocale indisponible");
      return;
    }

    if (button.classList.contains("is-speaking")) {
      speechSessionId += 1;
      window.speechSynthesis.cancel();
      updateSpeechButtons();
      return;
    }

    const chunks = getSpeechChunks(getSpeechText(section));

    if (chunks.length === 0) {
      return;
    }

    const sessionId = speechSessionId + 1;
    speechSessionId = sessionId;
    window.speechSynthesis.cancel();
    updateSpeechButtons(button);

    const speakChunk = (index = 0) => {
      if (speechSessionId !== sessionId) {
        return;
      }

      if (index >= chunks.length) {
        updateSpeechButtons();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.lang = document.documentElement.dataset.languageMode === "latin" ? "la" : "fr-FR";
      utterance.rate = 0.92;
      utterance.onend = () => speakChunk(index + 1);
      utterance.onerror = () => updateSpeechButtons();
      window.speechSynthesis.speak(utterance);
    };

    speakChunk();
  }

  function applyAngelusSettings() {
    settingsForm.elements.angelusEnabled.checked = prayerSettings.enabled;
    if (settingsForm.elements.rosaryEnabled) {
      settingsForm.elements.rosaryEnabled.checked = prayerSettings.rosaryEnabled;
    }
    settingsForm.elements.notificationsEnabled.checked = prayerSettings.notificationsEnabled;

    Object.entries(timeInputsBySettingKey).forEach(([settingKey, inputName]) => {
      if (settingsForm.elements[inputName]) {
        settingsForm.elements[inputName].value = prayerSettings[settingKey];
      }
    });

    Object.entries(angelusEntries).forEach(([key, entry]) => {
      const section = document.getElementById(entry.id);
      const scheduleLink = document.querySelector(`.chapter-schedule-link[href="#${entry.id}"]`);

      section?.classList.toggle("is-hidden-by-settings", !prayerSettings.enabled);
      scheduleLink?.classList.toggle("is-hidden-by-settings", !prayerSettings.enabled);
      updatePrayerTime(entry.id, prayerSettings[key]);
    });

    optionalEntries.forEach((entry) => {
      const section = document.getElementById(entry.id);
      const scheduleLink = document.querySelector(`.chapter-schedule-link[href="#${entry.id}"]`);
      const isEnabled = Boolean(prayerSettings[entry.optionalKey]);

      section?.classList.toggle("is-hidden-by-settings", !isEnabled);
      scheduleLink?.classList.toggle("is-hidden-by-settings", !isEnabled);
    });

    sections.forEach((section) => {
      updatePrayerTime(section.id, getPrayerTime(section));
    });

    applyRosaryMysteries();
    sortPrayersBySettings();
    restartNotificationTimer();
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

    if ("speechSynthesis" in window) {
      speechSessionId += 1;
      window.speechSynthesis.cancel();
    }

    updateSpeechButtons();
    updateCurrentPrayerIndicator(document.querySelector(".prayer-time.is-active"));
  }

  let savedLanguageMode = "french";

  try {
    savedLanguageMode = localStorage.getItem("prayer-language-mode") || "french";
  } catch (error) {
    // Le français reste le mode par défaut.
  }

  setLanguageMode(savedLanguageMode);
  applyAngelusSettings();
  initVirtualRosaries();
  updateNotificationPermissionState();

  settingsToggle.addEventListener("click", () => {
    const shouldOpen = settingsPanel.hidden;
    setSettingsPanelOpen(shouldOpen, { focusPanel: shouldOpen, restoreFocus: !shouldOpen });
  });

  settingsClose.addEventListener("click", () => {
    setSettingsPanelOpen(false, { restoreFocus: true });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !settingsPanel.hidden) {
      setSettingsPanelOpen(false, { restoreFocus: true });
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (
      settingsPanel.hidden
      || settingsPanel.contains(event.target)
      || settingsToggle.contains(event.target)
    ) {
      return;
    }

    setSettingsPanelOpen(false);
  });

  settingsForm.addEventListener("input", () => {
    const nextSettings = {
      enabled: settingsForm.elements.angelusEnabled.checked,
      rosaryEnabled: settingsForm.elements.rosaryEnabled?.checked || false,
      notificationsEnabled: settingsForm.elements.notificationsEnabled.checked
    };

    Object.entries(timeInputsBySettingKey).forEach(([settingKey, inputName]) => {
      nextSettings[settingKey] = settingsForm.elements[inputName]?.value;
    });

    prayerSettings = sanitizePrayerSettings(nextSettings);
    applyAngelusSettings();
    setActiveSection(getPrayerIdForDate(new Date()));
    savePrayerSettings(prayerSettings);
  });

  settingsForm.querySelector(".settings-reset").addEventListener("click", () => {
    prayerSettings = { ...defaultPrayerSettings };
    applyAngelusSettings();
    setActiveSection(getPrayerIdForDate(new Date()));
    savePrayerSettings(prayerSettings);
  });

  notificationPermission.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      updateNotificationPermissionState();
      return;
    }

    await Notification.requestPermission();
    updateNotificationPermissionState();
    restartNotificationTimer();
  });

  speechButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const section = document.getElementById(button.dataset.speechTarget);

      if (section) {
        speakPrayer(section, button);
      }
    });
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

  function updateCurrentPrayerIndicator(section) {
    if (!currentPrayer || !currentPrayerLink || !section) {
      return;
    }

    currentPrayer.hidden = false;
    currentPrayerLink.href = `#${section.id}`;
    currentPrayerLink.textContent = getSectionTitle(section);
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

    scheduleLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${sectionId}`;
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    updateCurrentPrayerIndicator(activeSection);
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
    backToTop.classList.toggle("is-visible", window.scrollY > 1200);
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

  function hasVisitedBefore() {
    try {
      return localStorage.getItem(firstVisitStorageKey) === "true";
    } catch (error) {
      return false;
    }
  }

  function rememberVisit() {
    try {
      localStorage.setItem(firstVisitStorageKey, "true");
    } catch (error) {
      // La visite courante reste fonctionnelle sans stockage local.
    }
  }

  // Oriente la page vers la prière correspondant à l'heure locale après la première visite.
  const prayerId = getPrayerIdForDate(new Date());
  const targetSection = document.getElementById(prayerId);
  const shouldAutoScroll = hasVisitedBefore();
  setActiveSection(prayerId);
  rememberVisit();

  if (targetSection && shouldAutoScroll) {
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
