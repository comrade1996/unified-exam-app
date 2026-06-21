const fs = require("fs");
const path = require("path");
const vm = require("vm");

const downloads = "C:\\Users\\Omair Gibreel\\Downloads";
const outDir = __dirname;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeQuestion(question) {
  const choices = Array.isArray(question.choices) ? question.choices.map(String) : [];
  const answer = Array.isArray(question.answer) ? question.answer.map(Number) : [];
  return {
    type: question.type || (answer.length > 1 ? "Multiple Select" : "Single Choice"),
    prompt: String(question.prompt || ""),
    choices,
    answer,
    explanation: String(question.explanation || ""),
    fullExplanation: question.fullExplanation ? String(question.fullExplanation) : null,
    points: Number(question.points || 1)
  };
}

function normalizeExam(subjectId, bankId, bankTitle, exam) {
  return {
    id: `${subjectId}__${bankId}__${exam.id}`,
    sourceId: exam.id,
    subjectId,
    bankId,
    bankTitle,
    kind: exam.kind || "Exam",
    title: exam.title || exam.id,
    description: exam.description || "",
    questions: (exam.questions || []).map(normalizeQuestion).filter(question => {
      return question.prompt && question.choices.length > 0 && question.answer.length > 0;
    })
  };
}

function loadJsonSubject(config) {
  const subject = {
    id: config.id,
    title: config.title,
    description: config.description,
    banks: [],
    exams: []
  };

  for (const file of config.files) {
    const json = readJson(path.join(config.dataDir, file.path));
    const bankId = file.bankId || path.basename(file.path, path.extname(file.path));
    const bankTitle = file.title || file.role || bankId;
    const exams = Array.isArray(json.exams) ? json.exams : [];
    subject.banks.push({ id: bankId, title: bankTitle, examCount: exams.length });
    subject.exams.push(...exams.map(exam => normalizeExam(config.id, bankId, bankTitle, exam)));
  }

  subject.questionCount = subject.exams.reduce((sum, exam) => sum + exam.questions.length, 0);
  subject.examCount = subject.exams.length;
  return subject;
}

function loadManifestSubject(config) {
  const manifest = readJson(path.join(config.dataDir, "manifest.json"));
  return loadJsonSubject({
    id: config.id,
    title: config.title || manifest.title,
    description: config.description || manifest.description,
    dataDir: config.dataDir,
    files: manifest.files.map(file => ({
      path: file.path,
      role: file.role,
      title: file.role
    }))
  });
}

function findJsonFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      found.push(fullPath);
    }
  }
  return found;
}

function loadAutoJsonSubject(config) {
  const subject = {
    id: config.id,
    title: config.title,
    description: config.description,
    banks: [],
    exams: []
  };

  const jsonFiles = [
    ...(config.seedFiles || []),
    ...findJsonFiles(config.rootDir)
  ];
  for (const filePath of jsonFiles) {
    let json;
    try {
      json = readJson(filePath);
    } catch {
      continue;
    }

    if (!Array.isArray(json.exams)) {
      continue;
    }

    const relative = path.relative(config.rootDir, filePath);
    const baseName = relative.startsWith("..") ? path.basename(filePath) : relative;
    const bankId = baseName
      .replace(/\\/g, "/")
      .replace(/\.json$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const bankTitle = json.title || path.basename(filePath, path.extname(filePath));
    subject.banks.push({ id: bankId, title: bankTitle, examCount: json.exams.length });
    subject.exams.push(...json.exams.map(exam => normalizeExam(config.id, bankId, bankTitle, exam)));
  }

  if (subject.banks.length === 0) {
    subject.banks.push({ id: "future-ai-exams", title: "Future AI Exams", examCount: 0 });
  }

  subject.questionCount = subject.exams.reduce((sum, exam) => sum + exam.questions.length, 0);
  subject.examCount = subject.exams.length;
  return subject;
}

function loadOsSubject() {
  const filePath = path.join(downloads, "OS", "exam-bank.js");
  const code = fs.readFileSync(filePath, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: filePath });

  const osBanks = sandbox.window.osExamBanks;
  const subject = {
    id: "os",
    title: "Operating Systems",
    description: "OS lecture and algorithm exams from the unified OS app.",
    banks: [],
    exams: []
  };

  for (const [bankId, bank] of Object.entries(osBanks)) {
    const exams = Array.isArray(bank.exams) ? bank.exams : [];
    subject.banks.push({ id: bankId, title: bank.title || bankId, examCount: exams.length });
    subject.exams.push(...exams.map(exam => normalizeExam("os", bankId, bank.title || bankId, exam)));
  }

  subject.questionCount = subject.exams.reduce((sum, exam) => sum + exam.questions.length, 0);
  subject.examCount = subject.exams.length;
  return subject;
}

function loadGeneratedSubject(subjectId) {
  const subject = readJson(path.join(outDir, "generated-exams", `${subjectId}.json`));
  subject.exams = subject.exams.map(exam => normalizeExam(subject.id, "rewritten-md", "Rewritten Markdown Exams", exam));
  subject.banks = [{ id: "rewritten-md", title: "Rewritten Markdown Exams", examCount: subject.exams.length }];
  subject.questionCount = subject.exams.reduce((sum, exam) => sum + exam.questions.length, 0);
  subject.examCount = subject.exams.length;
  return subject;
}

const subjects = [
  loadGeneratedSubject("math-ai"),
  loadGeneratedSubject("information-security"),
  loadGeneratedSubject("oop"),
  loadGeneratedSubject("ai-ethics"),
  loadGeneratedSubject("ai"),
  loadGeneratedSubject("os")
];

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  subjects
};

fs.writeFileSync(
  path.join(outDir, "data.js"),
  `window.UNIFIED_EXAM_DATA = ${JSON.stringify(output, null, 2)};\n`,
  "utf8"
);

console.log(`Wrote ${subjects.length} subjects to ${path.join(outDir, "data.js")}`);
console.log(`Total exams: ${subjects.reduce((sum, subject) => sum + subject.examCount, 0)}`);
console.log(`Total questions: ${subjects.reduce((sum, subject) => sum + subject.questionCount, 0)}`);
