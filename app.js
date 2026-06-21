const data = window.UNIFIED_EXAM_DATA;
const storageKey = "unified-exam-progress-v1";

if (!data || !Array.isArray(data.subjects) || data.subjects.length === 0) {
  const showDataError = () => {
    const subjectTitle = document.getElementById("subjectTitle");
    const subjectDescription = document.getElementById("subjectDescription");
    const examTotal = document.getElementById("examTotal");
    const questionTotal = document.getElementById("questionTotal");
    const welcome = document.getElementById("welcome");

    if (subjectTitle) subjectTitle.textContent = "Data did not load";
    if (subjectDescription) {
      subjectDescription.textContent = "Refresh the page once. If this stays empty, the data.js file is blocked or cached incorrectly.";
    }
    if (examTotal) examTotal.textContent = "0 exams";
    if (questionTotal) questionTotal.textContent = "0 questions";
    if (welcome) {
      welcome.innerHTML = `
        <p class="eyebrow">Data error</p>
        <h2>Question data is missing</h2>
        <p>The app loaded, but the question bank file did not. Refresh the page or clear this site's cache.</p>
      `;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showDataError);
  } else {
    showDataError();
  }

  throw new Error("Unified exam data did not load.");
}

const state = {
  subjectId: data.subjects[0]?.id || "",
  search: "",
  examId: null,
  submitted: false,
  progress: loadProgress()
};

const els = {
  subjectSelect: document.getElementById("subjectSelect"),
  resetBtn: document.getElementById("resetBtn"),
  subjectTitle: document.getElementById("subjectTitle"),
  subjectDescription: document.getElementById("subjectDescription"),
  examTotal: document.getElementById("examTotal"),
  questionTotal: document.getElementById("questionTotal"),
  searchBox: document.getElementById("searchBox"),
  examList: document.getElementById("examList"),
  welcome: document.getElementById("welcome"),
  examForm: document.getElementById("examForm"),
  examKind: document.getElementById("examKind"),
  examTitle: document.getElementById("examTitle"),
  examDescription: document.getElementById("examDescription"),
  examQuestionCount: document.getElementById("examQuestionCount"),
  questions: document.getElementById("questions"),
  retryBtn: document.getElementById("retryBtn"),
  results: document.getElementById("results")
};

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(storageKey, JSON.stringify(state.progress));
}

function currentSubject() {
  return data.subjects.find(subject => subject.id === state.subjectId) || data.subjects[0];
}

function currentExam() {
  return currentSubject()?.exams.find(exam => exam.id === state.examId) || null;
}

function filteredExams() {
  const subject = currentSubject();
  const search = state.search.trim().toLowerCase();
  return subject.exams.filter(exam => {
    const text = `${exam.title} ${exam.kind} ${exam.bankTitle}`.toLowerCase();
    const searchOk = !search || text.includes(search);
    return searchOk;
  }).sort((left, right) => examSortKey(left).localeCompare(examSortKey(right), undefined, { numeric: true }));
}

function examSortKey(exam) {
  const lecture = exam.title.match(/^Lecture\s+(\d+)/i);
  if (lecture) return `0-${lecture[1].padStart(2, "0")}-${exam.title}`;
  const algorithm = exam.title.match(/^Algorithm/i);
  if (algorithm) return `1-${exam.title}`;
  return `2-${exam.title}`;
}

function renderSelectors() {
  els.subjectSelect.innerHTML = data.subjects.map(subject => {
    return `<option value="${escapeAttr(subject.id)}">${escapeHtml(subject.title)}</option>`;
  }).join("");
  els.subjectSelect.value = state.subjectId;
}

function renderSubject() {
  const subject = currentSubject();
  els.subjectTitle.textContent = subject.title;
  els.subjectDescription.textContent = subject.description || "";
  els.examTotal.textContent = `${subject.examCount} exams`;
  els.questionTotal.textContent = `${subject.questionCount} questions`;
}

function renderExamList() {
  const exams = filteredExams();
  els.examList.innerHTML = exams.map(exam => {
    const progress = state.progress[exam.id];
    const active = exam.id === state.examId ? " active" : "";
    const score = progress ? `Score ${progress.score}/${progress.total}` : "Not attempted";
    return `
      <button class="exam-item${active}" type="button" data-exam-id="${escapeAttr(exam.id)}">
        <strong>${escapeHtml(exam.title)}</strong>
        <span>${escapeHtml(exam.kind)} · ${escapeHtml(exam.bankTitle)} · ${exam.questions.length} questions · ${score}</span>
      </button>
    `;
  }).join("") || `<div class="subject-card"><p>No exams match your filters.</p></div>`;
}

function renderExam() {
  const exam = currentExam();
  if (!exam) {
    els.welcome.classList.remove("hidden");
    els.examForm.classList.add("hidden");
    els.results.classList.add("hidden");
    return;
  }

  state.submitted = Boolean(state.progress[exam.id]?.submitted);
  els.welcome.classList.add("hidden");
  els.examForm.classList.remove("hidden");
  els.examKind.textContent = `${exam.kind} · ${exam.bankTitle}`;
  els.examTitle.textContent = exam.title;
  els.examDescription.textContent = exam.description || "";
  els.examQuestionCount.textContent = `${exam.questions.length} questions`;
  els.examForm.classList.toggle("submitted", state.submitted);
  els.retryBtn.classList.toggle("hidden", !state.submitted);

  const savedAnswers = state.progress[exam.id]?.answers || {};
  els.questions.innerHTML = exam.questions.map((question, index) => {
    const inputType = question.type === "Multiple Select" ? "checkbox" : "radio";
    const saved = savedAnswers[index] || [];
    const correct = new Set(question.answer);
    return `
      <section class="question-card" data-question-index="${index}">
        <p class="eyebrow">${escapeHtml(question.type)}</p>
        <h3 dir="auto">${index + 1}. ${escapeHtml(question.prompt)}</h3>
        ${question.choices.map((choice, choiceIndex) => {
          const checked = saved.includes(choiceIndex) ? " checked" : "";
          const resultClass = state.submitted
            ? correct.has(choiceIndex)
              ? " correct"
              : saved.includes(choiceIndex)
                ? " wrong"
                : ""
            : "";
          return `
            <label class="choice${resultClass}">
              <input type="${inputType}" name="q-${index}" value="${choiceIndex}"${checked}${state.submitted ? " disabled" : ""}>
              <span dir="auto">${escapeHtml(choice)}</span>
            </label>
          `;
        }).join("")}
        <div class="feedback" dir="auto">${escapeHtml(question.fullExplanation || question.explanation)}</div>
      </section>
    `;
  }).join("");

  renderResults();
}

function renderResults() {
  const exam = currentExam();
  const progress = exam ? state.progress[exam.id] : null;
  if (!progress?.submitted) {
    els.results.classList.add("hidden");
    els.results.innerHTML = "";
    return;
  }
  const percent = Math.round((progress.score / progress.total) * 100);
  const cls = percent >= 70 ? "result-good" : "result-bad";
  els.results.classList.remove("hidden");
  els.results.innerHTML = `
    <h2 class="${cls}">${progress.score}/${progress.total} · ${percent}%</h2>
    <p>Saved locally in this browser on ${new Date(progress.completedAt).toLocaleString()}.</p>
  `;
}

function getAnswersFromForm(exam) {
  const answers = {};
  exam.questions.forEach((_, index) => {
    const selected = [...els.examForm.querySelectorAll(`[name="q-${index}"]:checked`)].map(input => Number(input.value));
    answers[index] = selected;
  });
  return answers;
}

function scoreExam(exam, answers) {
  return exam.questions.reduce((score, question, index) => {
    const selected = [...(answers[index] || [])].sort((a, b) => a - b);
    const correct = [...question.answer].sort((a, b) => a - b);
    return score + (arraysEqual(selected, correct) ? 1 : 0);
  }, 0);
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function renderAll() {
  renderSubject();
  renderExamList();
  renderExam();
}

els.subjectSelect.addEventListener("change", event => {
  state.subjectId = event.target.value;
  state.examId = null;
  els.searchBox.value = "";
  state.search = "";
  renderAll();
});

els.searchBox.addEventListener("input", event => {
  state.search = event.target.value;
  renderExamList();
});

els.examList.addEventListener("click", event => {
  const button = event.target.closest("[data-exam-id]");
  if (!button) return;
  state.examId = button.dataset.examId;
  renderExamList();
  renderExam();
});

els.examForm.addEventListener("submit", event => {
  event.preventDefault();
  const exam = currentExam();
  if (!exam) return;
  const answers = getAnswersFromForm(exam);
  const score = scoreExam(exam, answers);
  state.progress[exam.id] = {
    submitted: true,
    score,
    total: exam.questions.length,
    answers,
    completedAt: new Date().toISOString()
  };
  saveProgress();
  renderExamList();
  renderExam();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

els.retryBtn.addEventListener("click", () => {
  const exam = currentExam();
  if (!exam) return;
  delete state.progress[exam.id];
  saveProgress();
  renderExamList();
  renderExam();
});

els.resetBtn.addEventListener("click", () => {
  const subject = currentSubject();
  const confirmed = window.confirm(`Reset saved progress for ${subject.title}?`);
  if (!confirmed) return;
  for (const exam of subject.exams) {
    delete state.progress[exam.id];
  }
  saveProgress();
  renderExamList();
  renderExam();
});

renderSelectors();
renderAll();
