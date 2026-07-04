// 학생 활동 화면, 요약 활동 화면, 교사용 현황 화면을 그리는 모듈
import { renderCoachMarkdown } from "./markdown.js";
import {
  getCorrectSummaryOrder,
  getModelOverallSummary,
  getParagraphResponse,
  getParagraphSummary,
  prepareSummaryCards,
} from "./state.js";

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
  const labels = {
    paragraphs: `${Math.min(state.currentIndex + 1, lesson.paragraphs.length)} / ${lesson.paragraphs.length} 문단`,
    summaries: "문단별 요약 작성",
    order: "문단 요약 카드 순서 배치",
    overall: "전체 종합 요약",
    done: "활동 완료",
  };

  progressLabelEl.textContent =
    state.ui.view === "teacher" ? "교사용 진행 현황" : labels[state.phase] ?? labels.paragraphs;

  progressDotsEl.replaceChildren(
    ...lesson.paragraphs.map((paragraph, index) => {
      const dot = document.createElement("span");
      dot.className = "progress-dot";
      dot.dataset.active = String(
        state.phase === "paragraphs" && index === state.currentIndex && state.ui.view === "student",
      );
      dot.dataset.done = String(state.solvedParagraphs.has(paragraph.id));
      dot.setAttribute("aria-label", `${paragraph.label} 진행 표시`);
      return dot;
    }),
  );
}

export function renderParagraph(lesson, state, handlers) {
  const paragraph = lesson.paragraphs[state.currentIndex];
  const response = getParagraphResponse(state, paragraph.id);
  const selectedIndex = response?.isComplete ? response.selectedIndex : state.selectedIndex;

  summaryEl.hidden = true;
  stageEl.replaceChildren();
  stageEl.innerHTML = `
    ${renderModeTools(state)}
    <article class="paragraph-panel" data-phase="paragraphs">
      <div class="paragraph-heading">
        <div>
          <p class="paragraph-kicker">${escapeHtml(paragraph.label)}</p>
          <h2>${escapeHtml(paragraph.sectionTitle)}</h2>
        </div>
        <div class="help-action-wrap">
          <button class="help-action" type="button">도움!</button>
          ${
            state.ui.helpMessage
              ? `<span class="help-confirmation" role="status">${escapeHtml(
                  state.ui.helpMessage || "도움을 요청했어요!",
                )}</span>`
              : ""
          }
        </div>
      </div>
      <p class="task-text">문장을 눌러 중심문장을 고르고, 왜 그렇게 생각했는지 작성하세요.</p>
      <div class="paragraph-workspace">
        <section class="reading-column" aria-label="문단 본문">
          <div class="sentence-list" role="group" aria-label="문장 선택">
            ${paragraph.sentences
              .map((sentence, index) => renderSentenceButton(sentence, index, selectedIndex))
              .join(" ")}
          </div>
        </section>
        <section class="response-column" aria-label="답변과 AI 도움">
          ${renderFeedback(state, response)}
          ${renderParagraphActions(lesson, state, response)}
          <section class="ai-coach-box" aria-label="AI 코치 도움">
            <div>
              <p class="ai-coach-title">AI 코치</p>
              <p>정답을 바로 알려주지 않고, 다시 생각할 질문으로 도와줍니다.</p>
            </div>
            <button class="ai-coach-action" type="button" aria-label="AI 코치에게 힌트 받기">
              <img class="ai-coach-avatar" src="./assets/ai-coach-button.png" alt="" aria-hidden="true" />
              <span>AI 코치 열기</span>
            </button>
          </section>
        </section>
      </div>
    </article>
    ${state.aiChat?.isOpen ? renderAiCoachChat(state) : ""}
  `;

  wireCommonHandlers(stageEl, handlers);
  stageEl.querySelectorAll(".sentence-card").forEach((sentenceEl) => {
    sentenceEl.addEventListener("click", () => handlers.onSelect(Number(sentenceEl.dataset.index)));
    sentenceEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handlers.onSelect(Number(sentenceEl.dataset.index));
      }
    });
  });
  stageEl.querySelector(".activity-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    handlers.onParagraphSubmit({
      reason: form.get("reason"),
    });
  });
  stageEl.querySelector(".ai-coach-action").addEventListener("click", () => {
    handlers.onOpenAiChat();
  });
  stageEl.querySelector(".help-action").addEventListener("click", () => {
    handlers.onHelp("문단 활동");
  });
  stageEl.querySelector(".paragraph-continue")?.addEventListener("click", handlers.onParagraphContinue);
  stageEl.querySelector(".ai-chat-close")?.addEventListener("click", handlers.onCloseAiChat);
  stageEl.querySelector(".ai-chat-clear")?.addEventListener("click", handlers.onClearAiChat);
  stageEl.querySelector(".ai-chat-backdrop")?.addEventListener("click", handlers.onCloseAiChat);
  stageEl.querySelector(".ai-chat-form textarea")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  });
  stageEl.querySelector(".ai-chat-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const chatForm = new FormData(event.currentTarget);
    const activityFormEl = stageEl.querySelector(".activity-form");
    const activityForm = activityFormEl ? new FormData(activityFormEl) : null;
    handlers.onAiChatSubmit({
      question: chatForm.get("question"),
      reason: activityForm?.get("reason") ?? response?.reason ?? "",
    });
  });
  scrollAiChatToLatestAfterLayout();
}

function renderSentenceButton(sentence, index, selectedIndex) {
  return `
    <span class="sentence-card"
      role="button"
      tabindex="0"
      data-index="${index}"
      data-selected="${selectedIndex === index}"
      aria-pressed="${selectedIndex === index}"
    >
      <span class="sentence-text">${escapeHtml(sentence.text)}</span>
    </span>
  `;
}

function renderFeedback(state, response) {
  const feedback = response?.feedback ?? state.feedback;

  if (!feedback) {
    return `<section class="coach-panel is-neutral"><p>선택한 뒤 이유를 쓰면 AI 코치가 다음 질문을 제시합니다.</p></section>`;
  }

  return renderCoachPanel(feedback);
}

function renderCoachPanel(feedback, { isStreaming = false } = {}) {
  const title =
    feedback.status === "complete"
      ? "해설 확인"
      : feedback.status === "selected"
        ? "선택 완료"
        : "이유 쓰기 힌트";

  return `
    <section class="coach-panel ${feedback.status === "coaching" ? "is-coaching" : "is-neutral"} ${
      isStreaming ? "is-streaming" : ""
    }">
      <p class="coach-title">${title}</p>
      <div class="coach-message">${renderCoachMarkdown(feedback.message)}</div>
      ${
        feedback.revealsAnswer
          ? `
            <div class="answer-box">
              <p><strong>모범 중심문장</strong> ${escapeHtml(feedback.modelCenterSentence)}</p>
              <p><strong>이유</strong> ${escapeHtml(feedback.modelReason)}</p>
            </div>
          `
          : `<p class="coach-note">정답은 바로 보여주지 않습니다. 질문을 보고 다시 생각해 보세요.</p>`
      }
    </section>
  `;
}

export function updateParagraphCoachPanel(feedback, options = {}) {
  const panelEl = stageEl.querySelector(".response-column > .coach-panel");

  if (!panelEl) {
    return;
  }

  panelEl.outerHTML = renderCoachPanel(feedback, options);
}

export function setParagraphSubmitPending(isPending) {
  const submitButton = stageEl.querySelector(".activity-form .primary-action");

  if (!submitButton) {
    return;
  }

  submitButton.disabled = Boolean(isPending);
  submitButton.textContent = isPending ? "힌트 받는 중" : "저장하고 정답 확인";
}

function renderParagraphActions(lesson, state, response) {
  if (response?.isComplete) {
    const label = state.currentIndex >= lesson.paragraphs.length - 1 ? "문단 요약으로" : "다음 문단으로";

    return `
      <div class="action-row paragraph-continue-row">
        <button class="primary-action paragraph-continue" type="button">${label}</button>
      </div>
    `;
  }

  return `
    <form class="activity-form">
      <label>
        <span>중심문장이라고 생각한 이유</span>
        <textarea
          name="reason"
          rows="3"
          placeholder="예: 이 문장이 문단 전체 내용을 가장 넓게 말하고, 다른 문장들이 이 문장을 설명하기 때문입니다."
        >${escapeHtml(response?.reason ?? "")}</textarea>
      </label>
      <div class="action-row">
        <button class="primary-action" type="submit">저장하고 정답 확인</button>
      </div>
    </form>
  `;
}

function renderAiCoachChat(state) {
  const messages = state.aiChat?.messages ?? [];

  return `
    <div class="ai-chat-backdrop" aria-hidden="true"></div>
    <section class="ai-chat-modal" role="dialog" aria-modal="true" aria-labelledby="ai-chat-title">
      <header class="ai-chat-header">
        <div>
          <img class="ai-chat-avatar" src="./assets/ai-coach-button.png" alt="" aria-hidden="true" />
          <div>
            <p class="ai-chat-kicker">AI 코치</p>
            <h3 id="ai-chat-title">궁금한 점 물어보기</h3>
          </div>
        </div>
        <div class="ai-chat-actions">
          <button class="ai-chat-clear" type="button">질문 초기화</button>
          <button class="ai-chat-close" type="button">닫기</button>
        </div>
      </header>
      <div class="ai-chat-messages" aria-live="polite">
        ${
          messages.length > 0
            ? messages.map(renderAiChatMessage).join("")
            : `<article class="ai-chat-message is-assistant"><p>궁금한 점을 물어보세요. 정답을 바로 말하지 않고, 스스로 찾도록 도와드릴게요.</p></article>`
        }
        ${
          state.aiChat?.isLoading
            ? `<article class="ai-chat-message is-assistant is-loading"><p>잠시만 기다려주세요!</p></article>`
            : ""
        }
      </div>
      <form class="ai-chat-form">
        <textarea
          name="question"
          rows="3"
          aria-label="AI 코치에게 물어볼 내용"
          placeholder="예: 중심문장은 어떻게 찾나요?"
          ${state.aiChat?.isLoading ? "disabled" : ""}
        ></textarea>
        <button class="summary-submit" type="submit" ${state.aiChat?.isLoading ? "disabled" : ""}>${
          state.aiChat?.isLoading ? "기다리는 중" : "묻기"
        }</button>
      </form>
    </section>
  `;
}

function renderAiChatMessage(message) {
  const isUser = message.role === "user";

  return `
    <article class="ai-chat-message ${isUser ? "is-user" : "is-assistant"}">
      ${isUser ? `<p>${escapeHtml(message.message)}</p>` : renderCoachMarkdown(message.message)}
    </article>
  `;
}

function scrollAiChatToLatest() {
  const messagesEl = stageEl.querySelector(".ai-chat-messages");

  if (!messagesEl) {
    return;
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function scrollAiChatToLatestAfterLayout() {
  const requestAnimationFrame = globalThis.requestAnimationFrame;

  scrollAiChatToLatest();
  requestAnimationFrame?.(scrollAiChatToLatest);
}

export function renderSummary(lesson, state, handlers) {
  stageEl.replaceChildren();
  summaryEl.hidden = false;

  if (state.phase === "summaries") {
    renderParagraphSummaries(lesson, state, handlers);
    return;
  }

  if (state.phase === "order") {
    renderSummaryOrder(lesson, state, handlers);
    return;
  }

  renderOverallSummary(lesson, state, handlers);
}

function renderParagraphSummaries(lesson, state, handlers) {
  summaryEl.innerHTML = `
    ${renderModeTools(state)}
    <section class="summary-panel">
      <p class="eyebrow">문단별 요약</p>
      <h2>모든 문단을 본 뒤, 각 문단의 핵심을 한 문장으로 정리하세요.</h2>
      <p class="task-text is-inverted">찾아 둔 중심문장을 참고해서 문단마다 짧게 요약하면 됩니다.</p>
      <form class="paragraph-summary-form">
        <div class="paragraph-summary-list" aria-label="문단별 요약 입력">
          ${lesson.paragraphs.map((paragraph) => renderParagraphSummaryInput(paragraph, state)).join("")}
        </div>
        ${
          state.paragraphSummaryFeedback
            ? `<p class="summary-feedback" data-complete="${
                state.paragraphSummaryFeedback.status === "complete"
              }">${escapeHtml(state.paragraphSummaryFeedback.message)}</p>`
            : ""
        }
        <div class="summary-actions">
          <button class="secondary-action help-inline" type="button">도움 요청</button>
          <button class="summary-submit" type="submit">문단 요약 저장</button>
        </div>
      </form>
    </section>
  `;

  wireCommonHandlers(summaryEl, handlers);
  summaryEl.querySelector(".paragraph-summary-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const summaries = Object.fromEntries(
      lesson.paragraphs.map((paragraph) => [paragraph.id, form.get(`summary-${paragraph.id}`)]),
    );
    handlers.onParagraphSummariesSubmit(summaries);
  });
  summaryEl.querySelector(".help-inline").addEventListener("click", () => {
    handlers.onHelp("문단 요약 작성");
  });
}

function renderParagraphSummaryInput(paragraph, state) {
  const summary = getParagraphSummary(state, paragraph.id);
  const response = getParagraphResponse(state, paragraph.id);
  const centerText = response?.modelCenterSentence ?? paragraph.sentences[paragraph.centerIndex].text;

  return `
    <label class="paragraph-summary-item">
      <span>${escapeHtml(paragraph.label)}</span>
      <p>중심문장: ${escapeHtml(centerText)}</p>
      <textarea
        name="summary-${escapeHtml(paragraph.id)}"
        rows="3"
        placeholder="이 문단의 핵심 내용을 한 문장으로 적어 보세요."
      >${escapeHtml(summary?.text ?? response?.paragraphSummary ?? "")}</textarea>
    </label>
  `;
}

function renderSummaryOrder(lesson, state, handlers) {
  const cardOrder = prepareSummaryCards(state, lesson);
  const correctOrder = getCorrectSummaryOrder(lesson);

  summaryEl.innerHTML = `
    ${renderModeTools(state)}
    <section class="summary-panel">
      <p class="eyebrow">글 구조 이해</p>
      <h2>문단 요약 카드를 글의 흐름에 맞게 배열하세요.</h2>
      <p class="task-text is-inverted">카드는 드래그해서 옮길 수 있고, 위/아래 버튼으로도 이동할 수 있습니다.</p>
      <div class="summary-card-list" aria-label="문단 요약 카드">
        ${cardOrder.map((paragraphId, index) => renderSummaryCard(lesson, state, paragraphId, index)).join("")}
      </div>
      ${
        state.orderFeedback
          ? `<p class="order-feedback" data-correct="${state.orderFeedback.isCorrect}">${escapeHtml(state.orderFeedback.message)}</p>`
          : ""
      }
      <div class="summary-actions">
        <button class="secondary-action help-inline" type="button">도움 요청</button>
        <button class="summary-submit order-submit" type="button">순서 제출</button>
      </div>
    </section>
  `;

  wireCommonHandlers(summaryEl, handlers);
  wireCardSorting(summaryEl, handlers);
  summaryEl.querySelector(".order-submit").addEventListener("click", () => {
    handlers.onOrderSubmit(correctOrder);
  });
  summaryEl.querySelector(".help-inline").addEventListener("click", () => {
    handlers.onHelp("요약 카드 순서 배치");
  });
}

function renderSummaryCard(lesson, state, paragraphId, index) {
  const paragraph = lesson.paragraphs.find((item) => item.id === paragraphId);
  const summary = getParagraphSummary(state, paragraphId);
  const text = summary?.text ?? paragraph?.modelSummary ?? "";

  return `
    <article class="summary-card" draggable="true" data-index="${index}" data-id="${escapeHtml(paragraphId)}">
      <div>
        <p class="summary-card-label">${escapeHtml(paragraph?.label ?? "")}</p>
        <p>${escapeHtml(text)}</p>
      </div>
      <div class="card-move-actions" aria-label="카드 이동">
        <button class="move-card" type="button" data-direction="up" ${index === 0 ? "disabled" : ""}>위</button>
        <button class="move-card" type="button" data-direction="down" ${
          index === (state.cardOrder?.length ?? 1) - 1 ? "disabled" : ""
        }>아래</button>
      </div>
    </article>
  `;
}

function renderOverallSummary(lesson, state, handlers) {
  const summaries = lesson.paragraphs.map((paragraph) => ({
    paragraph,
    summary: getParagraphSummary(state, paragraph.id),
  }));

  summaryEl.innerHTML = `
    ${renderModeTools(state)}
    <section class="summary-panel">
      <p class="eyebrow">전체 종합 요약</p>
      <h2>문단별 요약을 참고해서 글 전체를 요약하세요.</h2>
      <div class="collected-sentences">
        ${summaries
          .map(({ paragraph, summary }) => {
            const summaryText = summary?.text ?? paragraph.modelSummary;

            return `
              <div
                class="center-chip"
                draggable="true"
                tabindex="0"
                role="button"
                aria-label="${escapeHtml(`${paragraph.label} 요약 문장 넣기`)}"
                data-summary-text="${escapeHtml(summaryText)}"
              >
                <span>${escapeHtml(paragraph.label)}</span>
                <p>${escapeHtml(summaryText)}</p>
              </div>
            `;
          })
          .join("")}
      </div>
      <form class="student-summary-form">
        <label for="student-summary">나의 전체 요약</label>
        <textarea
          id="student-summary"
          name="studentSummary"
          rows="6"
          placeholder="글의 주제와 흐름이 드러나도록 정리해 보세요."
        >${escapeHtml(state.overallSummary.text)}</textarea>
        ${
          state.overallSummary.feedback
            ? `<p class="summary-feedback" data-complete="${state.overallSummary.isComplete}">${escapeHtml(
                state.overallSummary.feedback.message,
              )}</p>`
            : ""
        }
        ${
          state.overallSummary.modelVisible
            ? `<div class="answer-box is-final"><p><strong>모범 전체 요약</strong> ${escapeHtml(
                getModelOverallSummary(lesson),
              )}</p></div>`
            : ""
        }
        <div class="summary-actions">
          <button class="secondary-action restart-summary" type="button">처음부터 다시</button>
          <button class="summary-submit" type="submit">전체 요약 제출</button>
        </div>
      </form>
    </section>
  `;

  wireCommonHandlers(summaryEl, handlers);
  wireOverallSummaryDrop(summaryEl);
  summaryEl.querySelector(".student-summary-form").addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.onOverallSubmit(summaryEl.querySelector("#student-summary").value);
  });
  summaryEl.querySelector(".restart-summary").addEventListener("click", handlers.onRestart);
}

export function renderTeacherDashboard(lesson, state, handlers) {
  summaryEl.hidden = true;
  stageEl.replaceChildren();

  const completedCount = state.solvedParagraphs.size;
  const coachingCount = state.coachingLog.length;

  stageEl.innerHTML = `
    ${renderModeTools(state)}
    <section class="teacher-dashboard">
      <div class="teacher-heading">
        <div>
          <p class="eyebrow">교사용 화면</p>
          <h2>${escapeHtml(state.classroom.classCode || "수업 코드 없음")} 활동 현황</h2>
        </div>
        <div class="teacher-heading-actions">
          <p class="privacy-note">실명이나 학번 없이 닉네임 기준으로만 표시합니다.</p>
          <button class="teacher-reset-button" type="button">시연 초기화</button>
        </div>
      </div>
      <div class="metric-grid">
        <div class="metric-card"><span>활동 학생</span><strong>${escapeHtml(
          state.classroom.nickname || "익명",
        )}</strong></div>
        <div class="metric-card"><span>완료 문단</span><strong>${completedCount} / ${
          lesson.paragraphs.length
        }</strong></div>
        <div class="metric-card"><span>도움 요청</span><strong>${state.helpRequests.length}</strong></div>
        <div class="metric-card"><span>AI 코칭</span><strong>${coachingCount}</strong></div>
      </div>
      <div class="teacher-columns">
        <section class="teacher-panel">
          <h3>문단별 진행</h3>
          <div class="teacher-table">
            ${lesson.paragraphs.map((paragraph) => renderTeacherRow(paragraph, state)).join("")}
          </div>
        </section>
        <section class="teacher-panel">
          <h3>도움 요청 학생</h3>
          ${renderHelpRequests(state)}
        </section>
        <section class="teacher-panel">
          <h3>빠르게 완료한 학생</h3>
          ${renderFastFinishers(state)}
        </section>
        <section class="teacher-panel">
          <h3>코칭이 필요한 학생</h3>
          ${renderCoachingLog(state)}
        </section>
      </div>
    </section>
  `;

  wireCommonHandlers(stageEl, handlers);
  stageEl.querySelector(".teacher-reset-button").addEventListener("click", handlers.onTeacherReset);
  stageEl.querySelectorAll(".dismiss-help").forEach((button) => {
    button.addEventListener("click", () => handlers.onDismissHelp(button.dataset.id));
  });
}

function renderTeacherRow(paragraph, state) {
  const response = getParagraphResponse(state, paragraph.id);
  const selected = response?.selectedIndex ?? null;

  return `
    <div class="teacher-row">
      <strong>${escapeHtml(paragraph.label)}</strong>
      <span>${response?.isComplete ? "완료" : "진행 중"}</span>
      <span>선택: ${selected === null ? "아직 없음" : `${selected + 1}문장`}</span>
      <span>이유: ${response?.reason ? "작성" : "미작성"}</span>
      <span>요약: ${response?.paragraphSummary ? "작성" : "미작성"}</span>
      <span>코칭 ${response?.coachingCount ?? 0}회</span>
    </div>
  `;
}

function renderHelpRequests(state) {
  if (state.helpRequests.length === 0) {
    return `<p class="empty-note">아직 도움 요청이 없습니다.</p>`;
  }

  return `
    <div class="help-list">
      ${state.helpRequests
        .map(
          (request) => `
            <article class="help-item">
              <div>
                <strong>${escapeHtml(request.nickname)}</strong>
                <p>${escapeHtml(request.stage)} · ${escapeHtml(String(request.paragraph))}</p>
              </div>
              <button class="dismiss-help" type="button" data-id="${escapeHtml(request.id)}">확인</button>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderFastFinishers(state) {
  if (state.fastFinishers.length === 0) {
    return `<p class="empty-note">전체 활동을 마치면 “오늘의 국어 코치” 후보로 표시됩니다.</p>`;
  }

  return state.fastFinishers
    .map(
      (student) => `
        <article class="badge-item">
          <strong>${escapeHtml(student.nickname)}</strong>
          <span>${escapeHtml(student.badge)}</span>
        </article>
      `,
    )
    .join("");
}

function renderCoachingLog(state) {
  if (state.coachingLog.length === 0) {
    return `<p class="empty-note">아직 반복 코칭 기록이 없습니다.</p>`;
  }

  return state.coachingLog
    .slice(-5)
    .reverse()
    .map(
      (log) => `
        <article class="coach-log-item">
          <strong>${escapeHtml(log.nickname || "익명")}</strong>
          <p>${escapeHtml(log.label)} · ${escapeHtml(log.message)}</p>
        </article>
      `,
    )
    .join("");
}

function renderModeTools(state) {
  return `
    <div class="app-tools">
      <div class="student-meta">
        <span>수업 코드 ${escapeHtml(state.classroom.classCode || "-")}</span>
        <strong>${escapeHtml(state.classroom.nickname || "익명 학생")}</strong>
      </div>
      <div class="view-switcher" role="tablist" aria-label="화면 전환">
        <button class="view-button" type="button" data-view="student" aria-selected="${
          state.ui.view === "student"
        }">학생 활동</button>
        <button class="view-button" type="button" data-view="teacher" aria-selected="${
          state.ui.view === "teacher"
        }">교사용 화면</button>
      </div>
      <div class="reset-actions" aria-label="초기화">
        <button class="restart-button" type="button">처음부터</button>
        <button class="entry-reset-button" type="button">입장 다시하기</button>
      </div>
    </div>
    <div class="sync-banner" data-online="${state.sync.isOnline}">
      ${escapeHtml(state.sync.message)}
    </div>
  `;
}

function wireCommonHandlers(container, handlers) {
  container.querySelectorAll(".view-button").forEach((button) => {
    button.addEventListener("click", () => handlers.onView(button.dataset.view));
  });
  container.querySelector(".restart-button")?.addEventListener("click", handlers.onRestart);
  container.querySelector(".entry-reset-button")?.addEventListener("click", handlers.onResetEntry);
}

function wireCardSorting(container, handlers) {
  let draggingIndex = null;

  container.querySelectorAll(".summary-card").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      draggingIndex = Number(card.dataset.index);
      event.dataTransfer?.setData("text/plain", card.dataset.index);
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      const fromIndex = Number(event.dataTransfer?.getData("text/plain") ?? draggingIndex);
      handlers.onMoveCard(fromIndex, Number(card.dataset.index));
      draggingIndex = null;
    });
  });

  container.querySelectorAll(".move-card").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".summary-card");
      const index = Number(card.dataset.index);
      const direction = button.dataset.direction === "up" ? -1 : 1;
      handlers.onMoveCard(index, index + direction);
    });
  });
}

function wireOverallSummaryDrop(container) {
  const summaryInput = container.querySelector("#student-summary");

  if (!summaryInput) {
    return;
  }

  container.querySelectorAll(".center-chip").forEach((chip) => {
    chip.addEventListener("dragstart", (event) => {
      const summaryText = chip.dataset.summaryText ?? "";

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", summaryText);
        event.dataTransfer.setData("application/x-summary-text", summaryText);
      }
    });

    chip.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      insertDraggedSummaryText(summaryInput, chip.dataset.summaryText);
    });
  });

  summaryInput.addEventListener("dragover", (event) => {
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }

    summaryInput.classList.add("is-drop-target");
  });

  summaryInput.addEventListener("dragleave", () => {
    summaryInput.classList.remove("is-drop-target");
  });

  summaryInput.addEventListener("drop", (event) => {
    event.preventDefault();
    summaryInput.classList.remove("is-drop-target");

    const summaryText =
      event.dataTransfer?.getData("application/x-summary-text") ||
      event.dataTransfer?.getData("text/plain") ||
      "";

    insertDraggedSummaryText(summaryInput, summaryText);
  });
}

function insertDraggedSummaryText(input, text) {
  const summaryText = String(text ?? "").trim();

  if (!summaryText) {
    return;
  }

  const start = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
  const end = typeof input.selectionEnd === "number" ? input.selectionEnd : start;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const prefix = before && !/\s$/.test(before) ? " " : "";
  const suffix = after && !/^\s/.test(after) ? " " : "";
  const nextCursor = before.length + prefix.length + summaryText.length;

  input.value = `${before}${prefix}${summaryText}${suffix}${after}`;
  input.focus();
  input.setSelectionRange?.(nextCursor, nextCursor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
