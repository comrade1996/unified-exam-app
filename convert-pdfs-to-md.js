const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const downloads = "C:\\Users\\Omair Gibreel\\Downloads";
const outRoot = path.join(__dirname, "markdown-sources");

const subjects = [
  { id: "math-ai", root: path.join(downloads, "math ai") },
  { id: "information-security", root: path.join(downloads, "Information Security") },
  { id: "oop", root: path.join(downloads, "Oop Lectures") },
  { id: "ai-ethics", root: path.join(downloads, "ai ethics") },
  { id: "ai", root: path.join(downloads, "AI") }
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["exam", "node_modules"].includes(entry.name.toLowerCase())) {
        files.push(...walk(full));
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      files.push(full);
    }
  }
  return files;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "source";
}

function normalizeText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function convertOne(subject, file) {
  const relative = path.relative(subject.root, file);
  const parser = new PDFParse({ data: fs.readFileSync(file) });
  const parsed = await parser.getText();
  const info = await parser.getInfo().catch(() => ({}));
  await parser.destroy();
  const text = normalizeText(parsed.text || "");
  const outDir = path.join(outRoot, subject.id, path.dirname(relative));
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${slugify(path.basename(file))}.md`);
  const title = path.basename(file, path.extname(file));
  const body = [
    `# ${title}`,
    "",
    `- Subject: ${subject.id}`,
    `- Source PDF: ${relative.replace(/\\/g, "/")}`,
    `- Pages: ${parsed.total || info.total || "unknown"}`,
    "",
    "## Extracted Text",
    "",
    text || "_No extractable text found._",
    ""
  ].join("\n");
  fs.writeFileSync(outFile, body, "utf8");
  return { source: file, output: outFile, pages: parsed.total || info.total || 0, chars: text.length };
}

(async () => {
  fs.mkdirSync(outRoot, { recursive: true });
  const summary = [];
  for (const subject of subjects) {
    const files = walk(subject.root);
    for (const file of files) {
      try {
        summary.push(await convertOne(subject, file));
      } catch (error) {
        summary.push({ source: file, error: error.message });
      }
    }
  }
  fs.writeFileSync(path.join(outRoot, "conversion-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  const converted = summary.filter(item => item.output).length;
  const failed = summary.length - converted;
  console.log(`Converted ${converted} PDFs to Markdown. Failed: ${failed}.`);
  console.log(`Output: ${outRoot}`);
})();
