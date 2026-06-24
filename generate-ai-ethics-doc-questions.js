const fs = require("fs");
const path = require("path");

const sourceDir = path.join(__dirname, "markdown-sources", "ai-ethics");
const outFile = path.join(__dirname, "generated-exams", "ai-ethics-doc-questions.json");

const sourceFiles = fs.readdirSync(sourceDir)
  .filter(file => file.endsWith(".md") && file.includes("أسئلة-محلولة"))
  .sort((left, right) => chapterNumber(left) - chapterNumber(right));

function chapterNumber(file) {
  const match = file.match(/جابتر-?(\d+)|جابتر-(\d+)/);
  return Number(match?.[1] || match?.[2] || 999);
}

function cleanLine(line) {
  return line
    .replace(/^\s*✅\s*/, "")
    .replace(/^الإجابة\s*[:：]?\s*/, "")
    .replace(/^[-–]\s*/, "")
    .trim();
}

function cleanBlock(lines) {
  return lines
    .map(cleanLine)
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseQuestions(markdown) {
  const lines = markdown
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.trim());

  const questions = [];
  let index = 0;

  while (index < lines.length) {
    const numberMatch = lines[index].match(/^(\d+)\.$/);
    if (!numberMatch) {
      index += 1;
      continue;
    }

    index += 1;
    const promptLines = [];
    while (index < lines.length && !lines[index].startsWith("✅") && !lines[index].match(/^\d+\.$/)) {
      if (lines[index] && !lines[index].match(/^[🔹🔸]+/u)) {
        promptLines.push(lines[index]);
      }
      index += 1;
    }

    const answerLines = [];
    if (index < lines.length && lines[index].startsWith("✅")) {
      answerLines.push(lines[index]);
      index += 1;
      while (index < lines.length && !lines[index].match(/^\d+\.$/)) {
        if (lines[index] && !lines[index].match(/^[🔹🔸]+/u)) {
          answerLines.push(lines[index]);
        }
        index += 1;
      }
    }

    const prompt = cleanBlock(promptLines);
    const modelAnswer = cleanBlock(answerLines);
    if (prompt && modelAnswer) {
      questions.push({
        type: "Open Answer",
        prompt,
        choices: [],
        answer: [],
        modelAnswer,
        explanation: modelAnswer,
        points: 0
      });
    }
  }

  return questions;
}

const exams = sourceFiles.map(file => {
  const chapter = chapterNumber(file);
  const markdown = fs.readFileSync(path.join(sourceDir, file), "utf8");
  const questions = parseQuestions(markdown);
  return {
    id: `chapter-${chapter}-solved-questions`,
    kind: "Open Exam",
    title: `Chapter ${chapter} Solved Questions`,
    description: `Open-answer practice from ${file}. Press Show answer to reveal the model answer.`,
    questions
  };
}).filter(exam => exam.questions.length > 0);

const output = {
  id: "ai-ethics-doc-questions",
  title: "AI Ethics Solved Questions",
  description: "Open-answer AI Ethics questions extracted from the solved chapter DOCX files.",
  banks: [
    {
      id: "solved-docs",
      title: "Solved DOCX Questions",
      examCount: exams.length
    }
  ],
  exams
};

fs.writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${exams.length} exams and ${exams.reduce((sum, exam) => sum + exam.questions.length, 0)} questions to ${outFile}`);
