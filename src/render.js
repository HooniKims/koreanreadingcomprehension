// 학습 화면과 피드백 화면을 그리는 렌더링 모듈
import { buildSummaryPieces, createSummaryText } from "./summary.js";

const titleEl = document.querySelector("#lesson-title");
const subtitleEl = document.querySelector("#lesson-subtitle");
const progressLabelEl = document.querySelector("#progress-label");
const progressDotsEl = document.querySelector("#progress-dots");
const stageEl = document.querySelector("#lesson-stage");
const summaryEl = document.querySelector("#summary-stage");

export function renderStaticHeader(lesson) {
  titleEl.textContent = lesson.title;
  subtitleEl.textContent = lesson.subtitle;
}

export function renderProgress(lesson, state) {
  const currentNumber = Math.min(state.currentIndex + 1, lesson.paragraphs.length);
  progressLabelEl.textContent = state.isComplete
    ? "모든 문단 학습 완료"
    : `${currentNumber} / ${lesson.paragraphs.length} 문단`;

  progressDotsEl.replaceChildren(
    ...lesson.paragraphs.map((paragraph, index) => {
      const dot = document.createElement("span");
      dot.className = "progress-dot";
      dot.dataset.active = String(index === state.currentIndex && !state.isComplete);
      dot.dataset.done = String(state.solvedParagraphs.has(paragraph.id));
      dot.setAttribute("aria-label", `${paragraph.label} 진행 표시`);
      return dot;
    }),
  );
}

export function renderParagraph(lesson, state, handlers) {
  const paragraph = lesson.paragraphs[state.currentIndex];
  const isSolved = state.solvedParagraphs.has(paragraph.id);

  const section = document.createElement("article");
  section.className = "paragraph-panel";
  section.dataset.animate = String(handlers.animate ?? true);
  section.innerHTML = `
    <div class="paragraph-kicker">${paragraph.label}</div>
    <h2>${paragraph.sectionTitle}</h2>
    <p class="task-text">문장을 차례로 읽고 이 문단의 중심 문장을 선택하세요.</p>
    <div class="sentence-list"></div>
    <div class="feedback-panel" hidden></div>
    <div class="action-row"></div>
  `;

  const list = section.querySelector(".sentence-list");
  paragraph.sentences.forEach((sentence, index) => {
    const sentenceEl = document.createElement("span");
    sentenceEl.className = "sentence-block";
    sentenceEl.style.setProperty("--delay", `${index * 90}ms`);
    sentenceEl.dataset.animate = String(handlers.animate ?? true);
    sentenceEl.dataset.selected = String(state.selectedIndex === index);
    sentenceEl.dataset.correct = String(isSolved && index === paragraph.centerIndex);
    sentenceEl.dataset.noncenter = String(isSolved && index !== paragraph.centerIndex);
    sentenceEl.dataset.incorrect = String(
      state.selectedIndex === index && state.feedback && !state.feedback.isCorrect,
    );
    sentenceEl.dataset.disabled = String(isSolved);
    sentenceEl.setAttribute("role", "button");
    sentenceEl.setAttribute("tabindex", isSolved ? "-1" : "0");
    sentenceEl.setAttribute("aria-label", `${index + 1}문장 선택. ${sentence.text}`);
    sentenceEl.innerHTML = `<span class="sentence-text">${sentence.text}</span>`;

    if (!isSolved) {
      sentenceEl.addEventListener("click", () => handlers.onSelect(index));
      sentenceEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlers.onSelect(index);
        }
      });
    }

    list.append(sentenceEl);
    list.append(document.createTextNode(" "));
  });

  renderFeedback(section, paragraph, state, handlers);
  stageEl.replaceChildren(section);
  summaryEl.hidden = true;
}

function renderFeedback(section, paragraph, state, handlers) {
  const feedbackPanel = section.querySelector(".feedback-panel");
  const actionRow = section.querySelector(".action-row");

  if (!state.feedback) {
    feedbackPanel.hidden = true;
    actionRow.replaceChildren();
    return;
  }

  feedbackPanel.hidden = false;
  feedbackPanel.className = `feedback-panel ${state.feedback.isCorrect ? "is-correct" : "is-wrong"}`;
  feedbackPanel.dataset.animate = String(handlers.animate ?? true);

  if (state.feedback.isCorrect) {
    const shouldShowRelations = !state.reviewStarted || state.reviewFeedback?.isCorrect;
    feedbackPanel.innerHTML = `
      <p class="feedback-title">정답입니다.</p>
      <p class="feedback-copy">이 문장이 문단의 핵심 생각을 가장 넓게 담고 있습니다.</p>
      ${shouldShowRelations ? renderRelationList(paragraph) : ""}
      ${
        state.reviewStarted
          ? renderReviewQuestion(paragraph, state)
          : `
            <div class="review-ready">
              <div>
                <p class="review-ready-title">이제 확인 문제를 풀겠습니다.</p>
                <p class="shiny-text">그 전에 각 문장의 설명을 잘 읽어보세요.</p>
              </div>
              <button class="secondary-action review-start" type="button">확인 문제 풀기</button>
            </div>
          `
      }
    `;
  } else {
    feedbackPanel.innerHTML = `
      <p class="feedback-title">다시 생각해 봅시다.</p>
      <p class="feedback-copy">선택한 문장은 <strong>${state.feedback.role}</strong>입니다.</p>
      <p class="hint-copy">${state.feedback.relation}</p>
    `;
  }

  feedbackPanel.querySelectorAll(".review-option").forEach((button, index) => {
    button.addEventListener("click", () => handlers.onReviewSelect(index));
  });
  feedbackPanel.querySelector(".review-start")?.addEventListener("click", handlers.onReviewStart);

  actionRow.replaceChildren();
  if (state.feedback.isCorrect && state.reviewFeedback?.isCorrect) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary-action";
    button.textContent = handlers.isLast ? "전체 요약 보기" : "다음 문단으로";
    button.addEventListener("click", handlers.onNext);
    actionRow.append(button);
  }
}

function renderRelationList(paragraph) {
  return `
    <div class="relation-list">
      ${paragraph.sentences
        .map(
          (sentence, index) => `
            <div class="relation-item ${index === paragraph.centerIndex ? "is-center" : ""}">
              <span>${index + 1}문장</span>
              <p>${sentence.relation}</p>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderReviewQuestion(paragraph, state) {
  const answerIndex = state.reviewTargetIndex;
  const review = createReviewQuestion(paragraph, answerIndex);

  return `
    <section class="review-panel" aria-label="문장 내용 확인 문제">
      <p class="review-kicker">확인 문제</p>
      <h3>${review.prompt}</h3>
      <div class="review-options">
        ${paragraph.sentences
          .map(
            (sentence, index) => `
              <button
                class="review-option"
                type="button"
                data-selected="${state.reviewAnswerIndex === index}"
                data-correct="${state.reviewFeedback?.isCorrect && answerIndex === index}"
                data-incorrect="${state.reviewAnswerIndex === index && state.reviewFeedback && !state.reviewFeedback.isCorrect}"
                ${state.reviewFeedback?.isCorrect ? "disabled" : ""}
              >
                <span>${index + 1}문장</span>
              </button>
            `,
          )
          .join("")}
      </div>
      ${
        state.reviewFeedback
          ? `<p class="review-feedback" data-correct="${state.reviewFeedback.isCorrect}">${state.reviewFeedback.message}</p>`
          : `<p class="review-help">본문의 각 문장이 무슨 역할을 했는지 떠올리며 골라 보세요.</p>`
      }
    </section>
  `;
}

function createReviewQuestion(paragraph, answerIndex) {
  const sentence = paragraph.sentences[answerIndex];
  const clue = sentence.relation.split(".")[0];

  return {
    prompt: `다음 설명에 해당하는 문장은 몇 번째 문장인가요? ${clue}.`,
  };
}

export function renderSummary(lesson, state, handlers) {
  stageEl.replaceChildren();
  summaryEl.hidden = false;
  if (!state.shuffledSummaryCenters) {
    state.shuffledSummaryCenters = shuffleSummaryCenters(state.collectedCenters);
  }
  const pieces = buildSummaryPieces(state.shuffledSummaryCenters);
  const modelPieces = buildSummaryPieces(state.collectedCenters);
  const summaryText = createSummaryText(state.collectedCenters);

  summaryEl.innerHTML = `
    <div class="summary-panel">
      <p class="eyebrow">전체 글 요약</p>
      <h2>중심 문장들을 바탕으로 전체 글을 직접 요약하세요.</h2>
      <div class="collected-sentences">
        ${pieces
          .map(
            (piece, index) => `
              <div class="center-chip" style="--delay:${index * 100}ms">
                <div class="center-chip-header">
                  <p>${piece.text}</p>
                  <button class="copy-center-sentence" type="button" data-copy-text="${escapeHtml(piece.text)}">복사하기</button>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
      <form class="student-summary-form">
        <label for="student-summary">나의 요약</label>
        <textarea
          id="student-summary"
          name="studentSummary"
          rows="6"
          placeholder="중심 문장들을 이어보고, 문장들을 자연스럽게 연결할 수 있는 말을 포함해서 글의 핵심 내용을 정리해보세요."
        >${escapeHtml(state.studentSummary)}</textarea>
        <div class="summary-actions">
          <button class="summary-submit" type="submit">확인</button>
          <button class="secondary-action restart-summary" type="button">처음부터 다시 학습하기</button>
        </div>
        <p class="summary-submit-help">확인 버튼을 누르면 모범 답안을 볼 수 있습니다.</p>
      </form>
      ${
        state.isModelSummaryVisible
          ? `
            <div class="model-summary-backdrop" role="presentation">
              <section class="model-summary-modal" role="dialog" aria-modal="true" aria-labelledby="model-summary-title">
                <p class="model-summary-kicker">문단 요약 모범 답안</p>
                <h3 id="model-summary-title">이런 식으로 문장을 이어 쓸 수 있습니다.</h3>
                <p>${renderModelSummary(modelPieces)}</p>
                <button class="model-summary-close" type="button">확인</button>
              </section>
            </div>
          `
          : ""
      }
    </div>
  `;

  summaryEl.querySelector(".student-summary-form").addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.onCheck(summaryEl.querySelector("#student-summary").value);
  });
  summaryEl.querySelector(".restart-summary").addEventListener("click", handlers.onRestart);
  summaryEl.querySelectorAll(".copy-center-sentence").forEach((button) => {
    button.addEventListener("click", () => copyCenterSentence(button));
  });
  summaryEl.querySelector(".model-summary-close")?.addEventListener("click", handlers.onCloseModelSummary);
  summaryEl.dataset.summary = summaryText;
  renderProgress(lesson, state);
}

function renderModelSummary(pieces) {
  return pieces
    .map(
      (piece) =>
        `<span class="rainbow-connector">${escapeHtml(piece.connector)}</span>, ${escapeHtml(piece.text)}`,
    )
    .join(" ");
}

function shuffleSummaryCenters(collectedCenters) {
  const shuffled = [...collectedCenters];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (isOriginalOrder(collectedCenters, shuffled) && shuffled.length > 1) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled;
}

function isOriginalOrder(original, shuffled) {
  return original.every((item, index) => item.paragraphId === shuffled[index]?.paragraphId);
}

async function copyCenterSentence(button) {
  const text = button.dataset.copyText;

  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "복사됨";
  } catch {
    button.textContent = "복사 실패";
  }

  window.setTimeout(() => {
    button.textContent = "복사하기";
  }, 1200);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
