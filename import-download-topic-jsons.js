const fs = require("fs");
const path = require("path");

const downloads = "C:\\Users\\Omair Gibreel\\Downloads";
const outDir = path.join(__dirname, "generated-exams");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function answerLetterToIndex(answer) {
  const letter = String(answer || "").trim().toUpperCase();
  return Math.max(0, letter.charCodeAt(0) - "A".charCodeAt(0));
}

function normalizeClosedQuestion(question) {
  const options = question.options || {};
  const letters = Object.keys(options).sort();
  return {
    type: "Single Choice",
    prompt: question.question || question.prompt || "",
    choices: letters.map(letter => String(options[letter])),
    answer: [answerLetterToIndex(question.answer)],
    explanation: question.explanation || question.answer_text || "",
    points: 1,
    sourceTopic: question.topic || question.section || question.source_section || question.source_file || null
  };
}

function singleExamFromQuestionFile(filePath, id, title, description) {
  const json = readJson(filePath);
  return {
    id,
    kind: "Downloaded Topic JSON Exam",
    title,
    description,
    sourceFile: filePath,
    questions: (json.questions || []).map(normalizeClosedQuestion)
  };
}

function subjectFromExamFiles(subjectConfig) {
  const exams = [];
  for (const file of subjectConfig.files) {
    const fullPath = path.join(downloads, file.path);
    const json = readJson(fullPath);
    const sourceExams = Array.isArray(json.exams) ? json.exams : [];
    for (const exam of sourceExams) {
      exams.push({
        ...exam,
        id: `${file.bankId}-${exam.id || slug(exam.title)}`,
        kind: exam.kind || file.kind || "Downloaded JSON Exam",
        title: exam.title || cleanTitle(exam.id),
        description: [
          file.bankTitle,
          exam.description
        ].filter(Boolean).join(" - "),
        sourceFile: fullPath
      });
    }
  }

  return {
    id: subjectConfig.id,
    title: subjectConfig.title,
    description: subjectConfig.description,
    banks: [
      {
        id: subjectConfig.bankId,
        title: subjectConfig.bankTitle,
        examCount: exams.length
      }
    ],
    exams
  };
}

const imports = [
  subjectFromExamFiles({
    id: "math-ai",
    title: "Mathematics for AI",
    description: "Downloaded Math AI JSON exams imported from Downloads.",
    bankId: "downloads-json",
    bankTitle: "Downloaded Math AI JSON Exams",
    files: [
      { path: "math ai\\exam\\data\\exams.json", bankId: "weekly", bankTitle: "Weekly Lecture Exams" },
      { path: "math ai\\exam\\data\\lab-tutorial-exams.json", bankId: "labs", bankTitle: "Lab and Tutorial Exams" },
      { path: "math ai\\exam\\data\\full-lab-exams.json", bankId: "full-labs", bankTitle: "Full Lab Exams" },
      { path: "math ai\\exam\\data\\full-tutorial-exams.json", bankId: "full-tutorials", bankTitle: "Full Tutorial Exams" },
      { path: "math ai\\exam\\data\\reference-exams.json", bankId: "references", bankTitle: "Reference Exam" },
      { path: "math ai\\exam\\data\\comprehensive-exams.json", bankId: "finals", bankTitle: "Comprehensive Final Exams" }
    ]
  }),
  subjectFromExamFiles({
    id: "information-security",
    title: "Information Security",
    description: "Downloaded Information Security JSON exams imported from Downloads.",
    bankId: "downloads-json",
    bankTitle: "Downloaded Information Security JSON Exams",
    files: [
      { path: "Information Security\\exam\\data\\exams.json", bankId: "lectures", bankTitle: "Lecture Exams" },
      { path: "Information Security\\exam\\data\\reference-exams.json", bankId: "references", bankTitle: "Reference Exams" },
      { path: "Information Security\\exam\\data\\comprehensive-exams.json", bankId: "finals", bankTitle: "Comprehensive Final Exams" }
    ]
  }),
  subjectFromExamFiles({
    id: "oop",
    title: "Object-Oriented Programming",
    description: "Downloaded OOP JSON exams imported from Downloads.",
    bankId: "downloads-json",
    bankTitle: "Downloaded OOP JSON Exams",
    files: [
      { path: "Oop Lectures\\exam\\data\\exams.json", bankId: "lectures", bankTitle: "Lecture and Comprehensive Exams" },
      { path: "Oop Lectures\\exam\\data\\advanced-exams.json", bankId: "advanced", bankTitle: "Advanced Full-Lecture Exams" }
    ]
  }),
  subjectFromExamFiles({
    id: "ai-ethics",
    title: "AI Ethics",
    description: "Downloaded AI Ethics JSON exams imported from Downloads.",
    bankId: "downloads-json",
    bankTitle: "Downloaded AI Ethics JSON Exams",
    files: [
      { path: "ai ethics\\exam\\data\\ai-ethics-exams.json", bankId: "chapters", bankTitle: "Chapter Exams" }
    ]
  }),
  {
    id: "ai",
    title: "Artificial Intelligence",
    description: "Downloaded AI topic closed JSON exams imported from Downloads.",
    banks: [
      {
        id: "downloads-topic-json",
        title: "Downloaded AI Topic JSON Exams",
        examCount: 4
      }
    ],
    exams: [
      singleExamFromQuestionFile(
        path.join(downloads, "closed_exam_1_ALL_TOPICS_with_answers.json"),
        "downloaded-ai-closed-exam-1-all-topics",
        "Downloaded AI Closed Exam 1 - All Topics",
        "388-question closed exam covering all AI topic Markdown files."
      ),
      singleExamFromQuestionFile(
        path.join(downloads, "closed_exam_2_ALL_TOPICS_with_answers.json"),
        "downloaded-ai-closed-exam-2-all-topics",
        "Downloaded AI Closed Exam 2 - All Topics",
        "388-question closed exam covering all AI topic Markdown files."
      ),
      singleExamFromQuestionFile(
        path.join(downloads, "closed_exam_1_with_answers.json"),
        "downloaded-ai-closed-exam-1-probability-practice",
        "Downloaded AI Closed Exam 1 - Probability Practice",
        "38-question closed practice exam focused on probability basics."
      ),
      singleExamFromQuestionFile(
        path.join(downloads, "closed_exam_2_with_answers.json"),
        "downloaded-ai-closed-exam-2-probability-practice",
        "Downloaded AI Closed Exam 2 - Probability Practice",
        "38-question closed practice exam focused on probability basics."
      )
    ]
  }
];

const outputs = [
  ["imported-math-ai-downloads.json", imports[0]],
  ["imported-information-security-downloads.json", imports[1]],
  ["imported-oop-downloads.json", imports[2]],
  ["imported-ai-ethics-downloads.json", imports[3]],
  ["imported-ai-topic-downloads.json", imports[4]]
];

for (const [fileName, subject] of outputs) {
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(subject, null, 2) + "\n", "utf8");
  const questionCount = subject.exams.reduce((sum, exam) => sum + (exam.questions || []).length, 0);
  console.log(`${fileName}: ${subject.exams.length} exams, ${questionCount} questions`);
}
