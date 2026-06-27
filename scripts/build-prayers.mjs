import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prayersDirectory = path.join(projectRoot, "prieres");
const templatePath = path.join(projectRoot, "templates", "index.template.html");
const publicDirectory = path.join(projectRoot, "public");
const publicOutputPath = path.join(publicDirectory, "index.html");
const staticAssets = ["script.js", "style.css"];
const checkOnly = process.argv.includes("--check");

const requiredMetadata = [
  "id",
  "order",
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

function renderInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

function renderMarkdown(markdown) {
  const blocks = markdown
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    throw new Error("Une section de langue est vide.");
  }

  return blocks
    .map((block) => {
      if (/^###\s+[^\r\n]+$/.test(block)) {
        return `          <h3 class="prayer-subtitle">${renderInlineMarkdown(block.replace(/^###\s+/, ""))}</h3>`;
      }

      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

      if (lines.every((line) => line.startsWith("- "))) {
        const items = lines
          .map((line) => `            <li>${renderInlineMarkdown(line.slice(2))}</li>`)
          .join("\n");
        return `          <ul class="prayer-list">\n${items}\n          </ul>`;
      }

      const className = block.toLocaleLowerCase("fr") === "amen." ? ' class="amen"' : "";
      const content = lines.map(renderInlineMarkdown).join("<br>\n            ");
      return `          <p${className}>${content}</p>`;
    })
    .join("\n");
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

  const order = Number(metadata.order);

  if (!Number.isFinite(order)) {
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

function renderNavigation(prayers) {
  return prayers
    .map((prayer, index) => {
      const separator = index === prayers.length - 1
        ? ""
        : '\n      <span class="nav-separator" aria-hidden="true">•</span>';

      return `      <a class="nav-link" href="#${prayer.id}"><span class="ui-fr">${escapeHtml(prayer.nav_fr)}</span><span class="ui-la">${escapeHtml(prayer.nav_la)}</span></a>${separator}`;
    })
    .join("\n");
}

function renderPrayer(prayer) {
  return `    <section id="${prayer.id}" class="prayer-section" aria-labelledby="titre-${prayer.id}">
      <div class="ornament" aria-hidden="true">✦</div>
      <p class="moment"><span class="ui-fr">${escapeHtml(prayer.moment_fr)}</span><span class="ui-la">${escapeHtml(prayer.moment_la)}</span></p>
      <h2 id="titre-${prayer.id}"><span class="ui-fr">${escapeHtml(prayer.title_fr)}</span><span class="ui-la">${escapeHtml(prayer.title_la)}</span></h2>
      <div class="prayer-text prayer-pair">
        <div class="prayer-language prayer-fr" lang="fr">
${renderMarkdown(prayer.french)}
        </div>
        <div class="prayer-language prayer-la" lang="la">
${renderMarkdown(prayer.latin)}
        </div>
      </div>
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

  prayers.sort((a, b) => a.order - b.order);

  const ids = prayers.map((prayer) => prayer.id);
  const duplicateId = ids.find((id, index) => ids.indexOf(id) !== index);

  if (duplicateId) {
    throw new Error(`Identifiant de prière en double : ${duplicateId}`);
  }

  const template = await readFile(templatePath, "utf8");
  const generatedHtml = template
    .replace("{{PRAYER_NAVIGATION}}", renderNavigation(prayers))
    .replace("{{PRAYER_SECTIONS}}", prayers.map(renderPrayer).join("\n\n"));

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
