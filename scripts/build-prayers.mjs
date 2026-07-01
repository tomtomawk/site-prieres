import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prayersDirectory = path.join(projectRoot, "prieres");
const templatePath = path.join(projectRoot, "templates", "index.template.html");
const schedulePath = path.join(projectRoot, "prayer-schedule.json");
const publicDirectory = path.join(projectRoot, "public");
const publicOutputPath = path.join(publicDirectory, "index.html");
const staticAssets = ["script.js", "style.css"];
const checkOnly = process.argv.includes("--check");

const requiredMetadata = [
  "id",
  "nav_fr",
  "nav_la",
  "moment_fr",
  "moment_la",
  "title_fr",
  "title_la"
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSafeId(value) {
  return /^[a-z0-9-]+$/.test(value);
}

function isValidTimeLabel(value) {
  return /^([01]\d|2[0-3])h([0-5]\d)$/.test(value);
}

function renderDataAttributes(attributes) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([name, value]) => ` ${name}="${escapeHtml(String(value))}"`)
    .join("");
}

async function readSchedule() {
  const schedule = JSON.parse(await readFile(schedulePath, "utf8"));

  if (!Array.isArray(schedule.chapters) || schedule.chapters.length === 0) {
    throw new Error("prayer-schedule.json doit contenir une liste chapters non vide.");
  }

  schedule.chapters.forEach((chapter) => {
    if (!isSafeId(chapter.id) || !chapter.title_fr || !chapter.title_la || !Array.isArray(chapter.entries)) {
      throw new Error(`Chapitre invalide dans prayer-schedule.json : ${chapter.id || "sans identifiant"}`);
    }

    chapter.entries.forEach((entry) => {
      if (!isSafeId(entry.id) || !isSafeId(entry.prayerId) || !isValidTimeLabel(entry.time)) {
        throw new Error(`Entree de planning invalide : ${entry.id || "sans identifiant"}`);
      }
    });
  });

  return schedule.chapters;
}

function renderInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

function getMarkdownBlocks(markdown) {
  const blocks = markdown
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    throw new Error("Une section de langue est vide.");
  }

  return blocks;
}

function renderMarkdownBlock(block, indent = "          ") {
  if (/^###\s+[^\r\n]+$/.test(block)) {
    return `${indent}<h3 class="prayer-subtitle">${renderInlineMarkdown(block.replace(/^###\s+/, ""))}</h3>`;
  }

  const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (lines.every((line) => line.startsWith("- "))) {
    const items = lines
      .map((line) => `${indent}  <li>${renderInlineMarkdown(line.slice(2))}</li>`)
      .join("\n");
    return `${indent}<ul class="prayer-list">\n${items}\n${indent}</ul>`;
  }

  const className = block.toLocaleLowerCase("fr") === "amen." ? ' class="amen"' : "";
  const content = lines.map(renderInlineMarkdown).join("<br>\n            ");
  return `${indent}<p${className}>${content}</p>`;
}

function renderMarkdown(markdown) {
  return getMarkdownBlocks(markdown).map((block) => renderMarkdownBlock(block)).join("\n");
}

const alignmentKeys = new Map([
  ["signe de la croix", "signum-crucis"],
  ["signum crucis", "signum-crucis"],
  ["adoration", "adoration"],
  ["action de graces et offrande", "gratiarum-actio-oblatio"],
  ["gratiarum actio et oblatio", "gratiarum-actio-oblatio"],
  ["action de graces", "gratiarum-actio"],
  ["demande de lumiere", "petitio-luminis"],
  ["examen", "examen"],
  ["ferme propos", "propositum"],
  ["resolution", "propositum"],
  ["propositum", "propositum"],
  ["demande des graces necessaires", "petitio-gratiarum"],
  ["petitio gratiarum necessariarum", "petitio-gratiarum"],
  ["oraison dominicale", "oratio-dominicalis"],
  ["oratio dominicalis", "oratio-dominicalis"],
  ["salutation angelique", "salutatio-angelica"],
  ["salutatio angelica", "salutatio-angelica"],
  ["symbole des apotres", "symbolum-apostolorum"],
  ["symbolum apostolorum", "symbolum-apostolorum"],
  ["confession des peches", "confessio-peccatorum"],
  ["confessio peccatorum", "confessio-peccatorum"],
  ["invocation de la sainte vierge de notre bon ange et de notre saint patron", "invocatio-sanctorum"],
  ["invocatio sanctae virginis boni angeli nostri et sancti patroni", "invocatio-sanctorum"],
  ["acte de foi", "actus-fidei"],
  ["actus fidei", "actus-fidei"],
  ["acte desperance", "actus-spei"],
  ["actus spei", "actus-spei"],
  ["acte de charite", "actus-caritatis"],
  ["actus caritatis", "actus-caritatis"],
  ["les commandements de dieu", "praecepta-dei"],
  ["praecepta dei", "praecepta-dei"],
  ["les commandements de leglise", "praecepta-ecclesiae"],
  ["praecepta ecclesiae", "praecepta-ecclesiae"],
  ["recommandation", "recommendatio"],
  ["priere pour les vivants et pour les trepasses", "oratio-pro-vivis-defunctis"],
  ["litanies de la sainte vierge", "litaniae-bmv"],
  ["litaniae beatae mariae virginis", "litaniae-bmv"],
  ["litanies du saint nom de jesus", "litaniae-nominis-jesu"],
  ["litaniae sanctissimi nominis jesu", "litaniae-nominis-jesu"],
  ["oraison", "oratio"],
  ["prions", "oratio"],
  ["oratio", "oratio"],
  ["oremus", "oratio"]
]);

function normalizeAlignmentTitle(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getAlignmentKey(block) {
  const match = block.match(/^###\s+([^\r\n]+)$/);

  if (!match) {
    return "";
  }

  const normalizedTitle = normalizeAlignmentTitle(match[1]);
  return alignmentKeys.get(normalizedTitle) || normalizedTitle;
}

function getAlignedSections(markdown) {
  const sections = [];

  getMarkdownBlocks(markdown).forEach((block) => {
    const key = getAlignmentKey(block);

    if (key || sections.length === 0) {
      sections.push({ key, blocks: [block] });
      return;
    }

    sections.at(-1).blocks.push(block);
  });

  return sections;
}

function alignSections(frenchSections, latinSections) {
  const rows = [];
  const usedLatinIndexes = new Set();

  frenchSections.forEach((frenchSection) => {
    const latinIndex = latinSections.findIndex((latinSection, index) => (
      !usedLatinIndexes.has(index) && latinSection.key && latinSection.key === frenchSection.key
    ));

    if (latinIndex === -1) {
      rows.push({ french: frenchSection, latin: null });
      return;
    }

    usedLatinIndexes.add(latinIndex);
    rows.push({ french: frenchSection, latin: latinSections[latinIndex] });
  });

  latinSections.forEach((latinSection, index) => {
    if (!usedLatinIndexes.has(index)) {
      rows.push({ french: null, latin: latinSection });
    }
  });

  return rows;
}

function renderAlignedSection(section) {
  return section
    ? section.blocks.map((block) => renderMarkdownBlock(block, "            ")).join("\n")
    : "";
}

function renderAlignedMarkdown(french, latin) {
  const rows = alignSections(getAlignedSections(french), getAlignedSections(latin));

  return rows.map((row) => {
    const frenchBlock = renderAlignedSection(row.french);
    const latinBlock = renderAlignedSection(row.latin);

    return `          <div class="prayer-aligned-row">
            <div class="prayer-aligned-cell" lang="fr">
${frenchBlock}
            </div>
            <div class="prayer-aligned-cell" lang="la">
${latinBlock}
            </div>
          </div>`;
  }).join("\n");
}

function parseFrontMatter(source, filename) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    throw new Error(`${filename} doit commencer par un bloc de métadonnées entre deux lignes ---`);
  }

  const metadata = {};

  match[1].split(/\r?\n/).forEach((line) => {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      throw new Error(`Métadonnée invalide dans ${filename} : ${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    metadata[key] = value;
  });

  requiredMetadata.forEach((key) => {
    if (!metadata[key]) {
      throw new Error(`Métadonnée manquante dans ${filename} : ${key}`);
    }
  });

  if (!/^[a-z0-9-]+$/.test(metadata.id)) {
    throw new Error(`Identifiant invalide dans ${filename} : ${metadata.id}`);
  }

  const order = metadata.order ? Number(metadata.order) : null;

  if (metadata.order && !Number.isFinite(order)) {
    throw new Error(`Ordre invalide dans ${filename} : ${metadata.order}`);
  }

  return { metadata: { ...metadata, order }, content: match[2] };
}

function parseLanguages(content, filename) {
  const frenchMatch = content.match(/^## Français\s*\r?\n([\s\S]*?)(?=^## Latin\s*$)/m);
  const latinMatch = content.match(/^## Latin\s*\r?\n([\s\S]*)$/m);

  if (!frenchMatch || !latinMatch) {
    throw new Error(`${filename} doit contenir les titres « ## Français » puis « ## Latin ».`);
  }

  return {
    french: frenchMatch[1].trim(),
    latin: latinMatch[1].trim()
  };
}

function renderNavigation(chapters) {
  return chapters
    .map((chapter, index) => {
      const separator = index === chapters.length - 1
        ? ""
        : '\n      <span class="nav-separator" aria-hidden="true">•</span>';

      return `      <a class="nav-link" href="#${chapter.id}"><span class="ui-fr">${escapeHtml(chapter.title_fr)}</span><span class="ui-la">${escapeHtml(chapter.title_la)}</span></a>${separator}`;
    })
    .join("\n");
}

function renderChapterSchedule(chapter) {
  return chapter.entries
    .map((entry) => `          <a class="chapter-schedule-link" href="#${entry.id}"${renderDataAttributes({
              "data-schedule-target": entry.id,
              "data-setting-key": entry.settingKey,
              "data-default-time": entry.time.replace("h", ":"),
              "data-optional-key": entry.optionalKey
            })}>
            <time datetime="${entry.time.replace("h", ":")}">${escapeHtml(entry.time)}</time>
            <span><span class="ui-fr">${escapeHtml(entry.title_fr || entry.prayer.title_fr)}</span><span class="ui-la">${escapeHtml(entry.title_la || entry.prayer.title_la)}</span></span>
          </a>`)
    .join("\n");
}

function renderPrayerEntry(entry) {
  const prayer = entry.prayer;
  const titleFr = entry.title_fr || prayer.title_fr;
  const titleLa = entry.title_la || prayer.title_la;

  return `      <section id="${entry.id}" class="prayer-section prayer-time" aria-labelledby="titre-${entry.id}"${renderDataAttributes({
          "data-chapter": entry.chapterId,
          "data-title-fr": titleFr,
          "data-title-la": titleLa,
          "data-setting-key": entry.settingKey,
          "data-input-name": entry.inputName,
          "data-default-time": entry.time.replace("h", ":"),
          "data-angelus-key": entry.angelusKey,
          "data-angelus-duration": entry.duration,
          "data-optional-key": entry.optionalKey,
          "data-rosary": entry.rosary ? "true" : undefined
        })}>
        <div class="prayer-time-marker" aria-hidden="true">
          <span class="prayer-time-dot">✝</span>
          <time datetime="${entry.time.replace("h", ":")}">${escapeHtml(entry.time)}</time>
        </div>
        <div class="prayer-time-content">
      <p class="moment"><span class="ui-fr">${escapeHtml(prayer.moment_fr)}</span><span class="ui-la">${escapeHtml(prayer.moment_la)}</span></p>
      <div class="prayer-title-row">
        <h3 id="titre-${entry.id}"><span class="ui-fr">${escapeHtml(titleFr)}</span><span class="ui-la">${escapeHtml(titleLa)}</span></h3>
        <button class="speech-toggle" type="button" data-speech-target="${entry.id}" data-speech-title-fr="${escapeHtml(titleFr)}" data-speech-title-la="${escapeHtml(titleLa)}" aria-label="Écouter ${escapeHtml(titleFr)}" aria-pressed="false" title="Écouter ${escapeHtml(titleFr)}">
          <span class="speech-icon" aria-hidden="true">♪</span>
          <span class="speech-button-text">
            <span class="ui-fr"><span class="speech-action-fr">Écouter</span> ${escapeHtml(titleFr)}</span>
            <span class="ui-la"><span class="speech-action-la">Audire</span> ${escapeHtml(titleLa)}</span>
          </span>
        </button>
      </div>
      <div class="prayer-text prayer-pair">
        <div class="prayer-language prayer-fr" lang="fr">
${renderMarkdown(prayer.french)}
        </div>
        <div class="prayer-language prayer-la" lang="la">
${renderMarkdown(prayer.latin)}
        </div>
        <div class="prayer-aligned">
${renderAlignedMarkdown(prayer.french, prayer.latin)}
        </div>
      </div>
        </div>
      </section>`;
}

function renderChapter(chapter) {
  return `    <section id="${chapter.id}" class="day-chapter" aria-labelledby="titre-${chapter.id}">
      <header class="chapter-header">
        <div class="ornament" aria-hidden="true">✝</div>
        <p class="moment"><span class="ui-fr">Temps de prière</span><span class="ui-la">Tempus orationis</span></p>
        <h2 id="titre-${chapter.id}"><span class="ui-fr">${escapeHtml(chapter.title_fr)}</span><span class="ui-la">${escapeHtml(chapter.title_la)}</span></h2>
        <nav class="chapter-schedule" aria-label="Prières du ${escapeHtml(chapter.title_fr)}">
${renderChapterSchedule(chapter)}
        </nav>
      </header>
${chapter.entries.map(renderPrayerEntry).join("\n")}
    </section>`;
}

async function build() {
  const filenames = (await readdir(prayersDirectory))
    .filter((filename) => filename.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b, "fr"));

  if (filenames.length === 0) {
    throw new Error("Aucune prière Markdown trouvée dans le dossier prieres.");
  }

  const prayers = await Promise.all(filenames.map(async (filename) => {
    const source = await readFile(path.join(prayersDirectory, filename), "utf8");
    const { metadata, content } = parseFrontMatter(source, filename);
    const languages = parseLanguages(content, filename);
    return { ...metadata, ...languages };
  }));

  prayers.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

  const ids = prayers.map((prayer) => prayer.id);
  const duplicateId = ids.find((id, index) => ids.indexOf(id) !== index);

  if (duplicateId) {
    throw new Error(`Identifiant de prière en double : ${duplicateId}`);
  }

  const dayChapters = await readSchedule();
  const prayersById = new Map(prayers.map((prayer) => [prayer.id, prayer]));
  const chapters = dayChapters.map((chapter) => ({
    ...chapter,
    entries: chapter.entries.map((entry) => {
      const prayer = prayersById.get(entry.prayerId);

      if (!prayer) {
        throw new Error(`Prière introuvable pour ${entry.id} : ${entry.prayerId}`);
      }

      return { ...entry, chapterId: chapter.id, prayer };
    })
  }));

  const template = await readFile(templatePath, "utf8");
  const generatedHtml = template
    .replace("{{PRAYER_NAVIGATION}}", renderNavigation(chapters))
    .replace("{{PRAYER_SECTIONS}}", chapters.map(renderChapter).join("\n\n"));

  if (generatedHtml.includes("{{PRAYER_")) {
    throw new Error("Un emplacement du modèle HTML n’a pas été remplacé.");
  }

  if (checkOnly) {
    const publicHtml = await readFile(publicOutputPath, "utf8");

    if (publicHtml !== generatedHtml) {
      throw new Error("public/index.html n’est pas à jour. Lancez « npm run build ».");
    }

    await Promise.all(staticAssets.map(async (filename) => {
      const source = await readFile(path.join(projectRoot, filename), "utf8");
      const published = await readFile(path.join(publicDirectory, filename), "utf8");

      if (source !== published) {
        throw new Error(`public/${filename} n’est pas à jour. Lancez « npm run build ».`);
      }
    }));

    console.log(`Vérification réussie : ${prayers.length} prières Markdown.`);
    return;
  }

  await mkdir(publicDirectory, { recursive: true });
  await writeFile(publicOutputPath, generatedHtml, "utf8");
  await Promise.all(staticAssets.map((filename) => (
    copyFile(path.join(projectRoot, filename), path.join(publicDirectory, filename))
  )));
  console.log(`public/ généré à partir de ${prayers.length} prières Markdown.`);
}

build().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
