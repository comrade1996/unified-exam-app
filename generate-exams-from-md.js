const fs = require("fs");
const path = require("path");

const downloads = "C:\\Users\\Omair Gibreel\\Downloads";
const generatedDir = path.join(__dirname, "generated-exams");

const subjectConfigs = [
  {
    id: "math-ai",
    title: "Mathematics for AI",
    description: "Fresh closed-question exams generated from the Math AI Markdown lecture and reference sources.",
    mdRoots: [path.join(__dirname, "markdown-sources", "math-ai")]
  },
  {
    id: "information-security",
    title: "Information Security",
    description: "Fresh closed-question exams generated from the Information Security Markdown lecture and reference sources.",
    mdRoots: [path.join(__dirname, "markdown-sources", "information-security")]
  },
  {
    id: "oop",
    title: "Object-Oriented Programming",
    description: "Fresh closed-question exams generated from the OOP Markdown lecture and reference sources.",
    mdRoots: [path.join(__dirname, "markdown-sources", "oop")]
  },
  {
    id: "ai-ethics",
    title: "AI Ethics",
    description: "Fresh closed-question exams generated from the AI Ethics Markdown lecture sources.",
    mdRoots: [path.join(__dirname, "markdown-sources", "ai-ethics")]
  },
  {
    id: "ai",
    title: "Artificial Intelligence",
    description: "Fresh closed-question exams generated from the AI Markdown lecture sources.",
    mdRoots: [path.join(__dirname, "markdown-sources", "ai")]
  },
  {
    id: "os",
    title: "Operating Systems",
    description: "Fresh closed-question exams generated from the existing OS Markdown lecture and algorithm sources.",
    mdRoots: [
      path.join(downloads, "OS", "os lectures md"),
      path.join(downloads, "OS", "algorithm text")
    ]
  }
];

const genericWrong = [
  "It is only a file name and has no effect on the system.",
  "It is used only when the computer is turned off.",
  "It always means the same thing as physical memory.",
  "It removes the need for operating system control.",
  "It is unrelated to performance, correctness, or security.",
  "It is only a user interface color or layout choice.",
  "It always runs without any limitation or condition.",
  "It is used only for printing documents."
];

function walkMd(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkMd(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) found.push(full);
  }
  return found;
}

function cleanLine(line) {
  return line
    .replace(/^[#>*\-\s\d.)•■◆●]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulFact(line) {
  if (line.length < 28 || line.length > 220) return false;
  if (/^(subject|source pdf|pages|extracted text|reference)\b/i.test(line)) return false;
  if (/^(dr\.?|prof\.?|instructor|prepared by|course|lecture notes?|جامعة|كلية)\b/i.test(line)) return false;
  if (/\b(dr\.?|prof\.?|instructor|prepared by)\b/i.test(line)) return false;
  if (/^(advanced applied mathematics|advanced object oriented programming|introduction to information security)$/i.test(line)) return false;
  if (/^[\p{L}\s\d:._-]+$/u && line.split(/\s+/).length <= 7 && !/\b(is|are|means|refers|occurs|used|can|must|should|requires|includes)\b/i.test(line)) return false;
  if (/^https?:\/\//i.test(line)) return false;
  if (!/[a-zA-Z\u0600-\u06FF]/.test(line)) return false;
  return true;
}

function titleFromFile(file) {
  return path.basename(file, ".md")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTopics(markdown, fallbackTitle) {
  const lines = markdown.split(/\n/);
  const topics = [];
  let current = { title: fallbackTitle, facts: [] };

  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^#{1,4}\s+(.+)/);
    if (heading) {
      if (/^extracted text$/i.test(cleanLine(heading[1]))) {
        continue;
      }
      if (current.facts.length) topics.push(current);
      current = { title: cleanLine(heading[1]) || fallbackTitle, facts: [] };
      continue;
    }
    const cleaned = cleanLine(line);
    if (isUsefulFact(cleaned)) current.facts.push(cleaned);
  }
  if (current.facts.length) topics.push(current);

  if (topics.length <= 1) {
    const facts = lines.map(cleanLine).filter(isUsefulFact);
    const chunkSize = 6;
    return facts.reduce((acc, fact, index) => {
      if (index % chunkSize === 0) acc.push({ title: `${fallbackTitle} topic ${Math.floor(index / chunkSize) + 1}`, facts: [] });
      acc[acc.length - 1].facts.push(fact);
      return acc;
    }, []);
  }

  return topics;
}

function uniqueFacts(facts) {
  const seen = new Set();
  return facts.filter(fact => {
    const key = fact.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeDistractors(correct, allFacts, topicTitle) {
  const normalizedCorrect = correct.toLowerCase();
  const fromFacts = allFacts
    .filter(fact => fact !== correct && !normalizedCorrect.includes(fact.toLowerCase()) && !fact.toLowerCase().includes(normalizedCorrect))
    .slice(0, 20);
  const pool = [
    ...fromFacts,
    `It means ${topicTitle} is always optional and can be ignored.`,
    `It means ${topicTitle} works without rules, states, or constraints.`,
    ...genericWrong
  ];
  return uniqueFacts(pool).slice(0, 3);
}

function extractSubjectPhrase(fact, topicTitle) {
  const cleaned = fact.replace(/\s+/g, " ").trim();
  const patterns = [
    /^(.{4,80}?)\s+(is|are|was|were|means|refers to|occurs when|happens when|consists of|contains|uses|provides|allows|requires|includes)\b/i,
    /^(.{4,80}?):/,
    /^(.{4,80}?)-/
  ];
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) return match[1].replace(/[,:;-]+$/g, "").trim();
  }
  return topicTitle;
}

function makeDirectPrompt(fact, topicTitle) {
  const subjectPhrase = extractSubjectPhrase(fact, topicTitle);
  if (/occurs when|happens when/i.test(fact)) {
    return `When does ${subjectPhrase} occur?`;
  }
  if (/^(what|why|when|how)\b/i.test(fact)) {
    return fact.replace(/\?*$/, "?");
  }
  return `What must you memorize about ${subjectPhrase}?`;
}

function makeCloze(fact) {
  const patterns = [
    /^(.+?\b(?:is|are|means|refers to|consists of|contains|uses|provides|allows|requires|includes)\b)\s+(.+)$/i,
    /^(.+?:)\s+(.+)$/,
    /^(.+?when)\s+(.+)$/i
  ];
  for (const pattern of patterns) {
    const match = fact.match(pattern);
    if (match && match[2].length >= 12) {
      return { prompt: `${match[1]} ____`, answer: match[2].replace(/[.;]+$/g, "") };
    }
  }
  const words = fact.split(/\s+/);
  const answer = words.slice(Math.max(0, Math.floor(words.length * 0.45))).join(" ");
  const prompt = `${words.slice(0, Math.max(4, Math.floor(words.length * 0.45))).join(" ")} ____`;
  return { prompt, answer: answer.replace(/[.;]+$/g, "") };
}

function extractAnswerClause(fact) {
  return makeCloze(fact).answer;
}

function makeQuestion(subjectId, sourceTitle, topicTitle, fact, allFacts, index) {
  const distractors = makeDistractors(fact, allFacts, topicTitle);
  while (distractors.length < 3) distractors.push(genericWrong[distractors.length]);
  const choices = [fact, ...distractors.slice(0, 3)];
  const rotate = index % choices.length;
  const rotated = choices.slice(rotate).concat(choices.slice(0, rotate));
  return {
    type: "Single Choice",
    prompt: makeDirectPrompt(fact, topicTitle),
    choices: rotated,
    answer: [rotated.indexOf(fact)],
    explanation: `Correct: ${fact}`,
    fullExplanation: `Topic: ${topicTitle}\nSource: ${sourceTitle}\nMemorize this exact idea: ${fact}`,
    points: 1,
    source: subjectId
  };
}

function makeSecondQuestion(subjectId, sourceTitle, topicTitle, fact, allFacts, index) {
  const cloze = makeCloze(fact);
  const wrong = makeDistractors(fact, allFacts, topicTitle).map(extractAnswerClause);
  const choices = [cloze.answer, ...wrong.slice(0, 3)];
  while (choices.length < 4) choices.push(genericWrong[choices.length]);
  const rotate = (index + 1) % choices.length;
  const rotated = choices.slice(rotate).concat(choices.slice(0, rotate));
  return {
    type: "Single Choice",
    prompt: `Complete the memorized idea: ${cloze.prompt}`,
    choices: rotated,
    answer: [rotated.indexOf(cloze.answer)],
    explanation: `This statement is correct for ${topicTitle}.`,
    fullExplanation: `Source: ${sourceTitle}\nTopic: ${topicTitle}\nWhy: ${fact}`,
    points: 1,
    source: subjectId
  };
}

function examIdFromTitle(title, index) {
  return `${String(index + 1).padStart(2, "0")}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function buildSubject(config) {
  const files = config.mdRoots.flatMap(walkMd).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const exams = files.map((file, fileIndex) => {
    const markdown = fs.readFileSync(file, "utf8");
    const sourceTitle = titleFromFile(file);
    const topics = splitTopics(markdown, sourceTitle);
    const allFacts = uniqueFacts(topics.flatMap(topic => topic.facts)).slice(0, 300);
    const questions = [];
    const usedPrompts = new Set();

    for (const topic of topics) {
      const facts = uniqueFacts(topic.facts).slice(0, 4);
      for (const fact of facts.slice(0, 2)) {
        const q1 = makeQuestion(config.id, sourceTitle, topic.title, fact, allFacts, questions.length);
        const q2 = makeSecondQuestion(config.id, sourceTitle, topic.title, fact, allFacts, questions.length);
        for (const question of [q1, q2]) {
          const key = `${question.prompt} ${question.choices[question.answer[0]]}`.toLowerCase();
          if (!usedPrompts.has(key)) {
            usedPrompts.add(key);
            questions.push(question);
          }
        }
      }
    }

    return {
      id: examIdFromTitle(sourceTitle, fileIndex),
      kind: "Closed Memorization Exam",
      title: sourceTitle,
      description: "Closed questions covering the titles, subtitles, and facts found in this Markdown source.",
      questions: questions.slice(0, 80)
    };
  }).filter(exam => exam.questions.length > 0);

  return {
    id: config.id,
    title: config.title,
    description: config.description,
    banks: [{ id: "rewritten-md", title: "Rewritten Markdown Exams", examCount: exams.length }],
    exams
  };
}

fs.mkdirSync(generatedDir, { recursive: true });
const subjects = subjectConfigs.map(buildSubject);
for (const subject of subjects) {
  const outFile = path.join(generatedDir, `${subject.id}.json`);
  fs.writeFileSync(outFile, JSON.stringify(subject, null, 2), "utf8");
}
console.log(`Generated ${subjects.length} subjects in ${generatedDir}`);
console.log(`Total exams: ${subjects.reduce((sum, subject) => sum + subject.exams.length, 0)}`);
console.log(`Total questions: ${subjects.reduce((sum, subject) => sum + subject.exams.reduce((n, exam) => n + exam.questions.length, 0), 0)}`);
