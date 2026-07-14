// 학습 웹앱의 초기화와 사용자 상호작용을 연결하는 모듈
import { requestAiCoach } from "./ai.js";
import { lesson } from "./data.js";
import {
  appendAiChatMessage,
  appendDialogueMessage,
  appendSummaryDialogueMessage,
  clearAiChatMessages,
  closeAiChat,
  createInitialState,
  dismissHelpRequest,
  enterClassroom,
  getDialogue,
  getModelOverallSummary,
  getSummaryDialogue,
  hydrateState,
  moveNext,
  moveSummaryCard,
  openAiChat,
  prepareLastPageDemoState,
  requestHelp,
  requestParagraphCoach,
  resetEntry,
  resetLesson,
  selectSentence,
  serializeState,
  setAiChatLoading,
  setDialogueLoading,
  setSummaryDialogueLoading,
  setConnectionState,
  setView,
  showOverallModelAnswer,
  submitOverallSummary,
  submitParagraphSummaries,
  submitParagraphWork,
  submitSummaryOrder,
} from "./state.js";
import {
  renderParagraph,
  renderProgress,
  renderStaticHeader,
  renderSummary,
  renderTeacherDashboard,
  setParagraphSubmitPending,
  updateParagraphCoachPanel,
} from "./render.js";

const STORAGE_KEY = "korean-reading-comprehension:v1";
const PRESENTATION_CLASS_CODE = "KOR-01";

let state = loadState();
let aiChatRequestVersion = 0;
let paragraphCoachRequestVersion = 0;
let socraticRequestVersion = 0;
let summaryDialogueRequestVersion = 0;
const startPageEl = document.querySelector("#start-page");
const mainAppEl = document.querySelector("#main-app");
const entryFormEl = document.querySelector("#entry-form");
const classCodeInputEl = document.querySelector("#class-code");
const nicknameInputEl = document.querySelector("#nickname");
const startButtonEl = document.querySelector("#start-lesson");

function paint(options = {}) {
  renderProgress(lesson, state);

  // 교사용 화면은 /teacher 전용 경로에서만 열리고 입장 절차 없이 바로 보인다.
  if (state.ui.view === "teacher") {
    startPageEl.hidden = true;
    mainAppEl.hidden = false;
    renderTeacherDashboard(lesson, state, handlers);
    return;
  }

  if (!state.classroom.isEntered) {
    startPageEl.hidden = false;
    mainAppEl.hidden = true;
    return;
  }

  startPageEl.hidden = true;
  mainAppEl.hidden = false;

  if (state.phase === "paragraphs") {
    renderParagraph(lesson, state, handlers);
    if (options.scrollTop) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }

  renderSummary(lesson, state, handlers);
  if (options.scrollTop) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

const handlers = {
  onSelect(sentenceIndex) {
    paragraphCoachRequestVersion += 1;
    selectSentence(state, lesson, sentenceIndex);
    persist();
    paint();
  },
  async onParagraphSubmit(payload) {
    const paragraph = lesson.paragraphs[state.currentIndex];
    const selectedIndex = state.selectedIndex;
    const previousIndex = state.currentIndex;
    const result = submitParagraphWork(state, lesson, payload);

    if (result.status !== "coaching") {
      persist();
      paint({ scrollTop: result.status === "complete" || state.currentIndex !== previousIndex });
      return;
    }

    const requestVersion = ++paragraphCoachRequestVersion;
    let streamedMessage = "";

    persist();
    setParagraphSubmitPending(true);
    updateParagraphCoachPanel(
      {
        ...result,
        message: "잠시만 기다려주세요!",
      },
      { isStreaming: true },
    );

    const aiMessage = await requestAiCoach({
      paragraph,
      selectedIndex,
      reason: payload.reason,
      intent: "reason-hint",
      onChunk(chunk) {
        if (requestVersion !== paragraphCoachRequestVersion || lesson.paragraphs[state.currentIndex]?.id !== paragraph.id) {
          return;
        }

        streamedMessage += chunk;
        updateParagraphCoachPanel(
          {
            ...result,
            message: streamedMessage,
          },
          { isStreaming: true },
        );
      },
    });

    if (requestVersion !== paragraphCoachRequestVersion || lesson.paragraphs[state.currentIndex]?.id !== paragraph.id) {
      setParagraphSubmitPending(false);
      return;
    }

    result.message = aiMessage || result.message;
    state.feedback = result;
    if (state.paragraphResponses[paragraph.id]?.feedback) {
      state.paragraphResponses[paragraph.id].feedback.message = result.message;
    }
    updateParagraphCoachPanel(result);
    setParagraphSubmitPending(false);
    persist();
  },
  async onAiCoach(payload) {
    const paragraph = lesson.paragraphs[state.currentIndex];
    const selectedIndex = state.selectedIndex;
    const result = requestParagraphCoach(state, lesson, payload);
    persist();
    paint();

    const aiMessage = await requestAiCoach({
      paragraph,
      selectedIndex,
      reason: payload.reason,
      intent: "reason-hint",
    });

    if (!aiMessage || lesson.paragraphs[state.currentIndex]?.id !== paragraph.id) {
      return;
    }

    result.message = aiMessage;
    state.feedback = result;
    if (state.paragraphResponses[paragraph.id]?.feedback) {
      state.paragraphResponses[paragraph.id].feedback.message = aiMessage;
    }
    persist();
    paint();
  },
  onOpenAiChat() {
    openAiChat(state);
    persist();
    paint();
  },
  onCloseAiChat() {
    closeAiChat(state);
    persist();
    paint();
  },
  async onAiChatSubmit(payload) {
    const question = String(payload.question ?? "").trim();

    if (!question) {
      return;
    }

    const requestVersion = ++aiChatRequestVersion;
    const paragraph = lesson.paragraphs[state.currentIndex];
    const selectedIndex = state.selectedIndex;
    appendAiChatMessage(state, "user", question);
    setAiChatLoading(state, true);
    persist();
    paint();

    const aiMessage = await requestAiCoach({
      paragraph,
      selectedIndex,
      reason: payload.reason,
      question,
      intent: "chat-question",
    });

    if (requestVersion !== aiChatRequestVersion || lesson.paragraphs[state.currentIndex]?.id !== paragraph.id) {
      setAiChatLoading(state, false);
      persist();
      paint();
      return;
    }

    setAiChatLoading(state, false);
    appendAiChatMessage(
      state,
      "assistant",
      aiMessage || "이 문장이 문단 전체와 어떻게 이어지는지 먼저 살펴볼까요?",
    );
    persist();
    paint();
  },
  onClearAiChat() {
    aiChatRequestVersion += 1;
    clearAiChatMessages(state);
    persist();
    paint();
  },
  async onDialogueSubmit(payload) {
    const answer = String(payload.answer ?? "").trim();

    if (!answer) {
      return;
    }

    const requestVersion = ++socraticRequestVersion;
    const paragraph = lesson.paragraphs[state.currentIndex];
    const selectedIndex = state.selectedIndex;
    appendDialogueMessage(state, lesson, "user", answer);
    setDialogueLoading(state, lesson, true);
    persist();
    paint();

    const dialogue = getDialogue(state, paragraph.id);
    const history = (dialogue?.messages ?? []).map((entry) => ({
      role: entry.role,
      content: entry.message,
    }));

    const nextParagraph = lesson.paragraphs[state.currentIndex + 1];
    const aiMessage = await requestAiCoach({
      paragraph,
      selectedIndex,
      intent: "socratic",
      history,
      turn: dialogue?.turn ?? 0,
      ...(nextParagraph
        ? {
            nextParagraph: {
              label: nextParagraph.label,
              text: nextParagraph.sentences.map((sentence) => sentence.text).join(" "),
            },
          }
        : {}),
    });

    if (requestVersion !== socraticRequestVersion || lesson.paragraphs[state.currentIndex]?.id !== paragraph.id) {
      const staleDialogue = getDialogue(state, paragraph.id);
      if (staleDialogue) {
        staleDialogue.isLoading = false;
      }
      persist();
      paint();
      return;
    }

    setDialogueLoading(state, lesson, false);
    appendDialogueMessage(
      state,
      lesson,
      "assistant",
      aiMessage || "좋은 생각이에요.\n고른 문장이 문단 전체 내용을 담고 있는지 한 번 더 살펴볼까요?",
    );
    persist();
    paint();
  },
  async onSummaryDialogueSubmit(payload) {
    const answer = String(payload.answer ?? "").trim();

    if (!answer) {
      return;
    }

    const requestVersion = ++summaryDialogueRequestVersion;
    state.overallSummary.text = String(payload.draft ?? "");
    appendSummaryDialogueMessage(state, "user", answer);
    setSummaryDialogueLoading(state, true);
    persist();
    paint();

    const dialogue = getSummaryDialogue(state);
    const history = (dialogue?.messages ?? []).map((entry) => ({
      role: entry.role,
      content: entry.message,
    }));

    const aiMessage = await requestAiCoach({
      intent: "summary-socratic",
      history,
      turn: dialogue?.turn ?? 0,
      summary: {
        paragraphSummaries: state.paragraphSummaries.map(({ label, text }) => ({ label, text })),
        modelOverallSummary: getModelOverallSummary(lesson),
        studentDraft: String(payload.draft ?? ""),
      },
    });

    if (requestVersion !== summaryDialogueRequestVersion || state.phase !== "overall") {
      const staleDialogue = getSummaryDialogue(state);
      if (staleDialogue) {
        staleDialogue.isLoading = false;
      }
      persist();
      paint();
      return;
    }

    setSummaryDialogueLoading(state, false);
    appendSummaryDialogueMessage(
      state,
      "assistant",
      aiMessage || "좋은 생각이에요.\n문단 요약들을 글의 순서대로 이으면 전체 요약이 됩니다.\n첫 문단 요약부터 한 문장씩 붙여 볼까요?",
    );
    persist();
    paint();
  },
  onParagraphContinue() {
    moveNext(state, lesson);
    persist();
    paint({ scrollTop: true });
  },
  onHelp(stage) {
    requestHelp(state, stage);
    persist();
    paint();
  },
  onMoveCard(fromIndex, toIndex) {
    moveSummaryCard(state, fromIndex, toIndex);
    persist();
    paint();
  },
  onParagraphSummariesSubmit(summaries) {
    submitParagraphSummaries(state, lesson, summaries);
    persist();
    paint({ scrollTop: true });
  },
  onOrderSubmit(correctOrder) {
    submitSummaryOrder(state, correctOrder);
    persist();
    paint({ scrollTop: true });
  },
  onOverallSubmit(summaryText) {
    submitOverallSummary(state, summaryText);
    persist();
    paint({ scrollTop: true });
  },
  onShowOverallModelAnswer() {
    showOverallModelAnswer(state);
    persist();
    paint();
  },
  onDismissHelp(requestId) {
    dismissHelpRequest(state, requestId);
    persist();
    paint();
  },
  onRestart() {
    resetLesson(state);
    persist();
    paint({ scrollTop: true });
  },
  onTeacherReset() {
    resetLesson(state);
    setView(state, "teacher");
    persist();
    paint({ scrollTop: true });
  },
  onResetEntry() {
    resetEntry(state);
    persist();
    entryFormEl.reset();
    paint({ scrollTop: true });
  },
};

function handleEntry() {
  if (!entryFormEl.reportValidity()) {
    return;
  }

  const form = new FormData(entryFormEl);
  enterClassroom(state, {
    classCode: PRESENTATION_CLASS_CODE,
    nickname: form.get("nickname"),
  });
  persist();
  paint({ scrollTop: true });
}

function handleEntryFieldKeydown(event) {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  if (event.currentTarget === classCodeInputEl) {
    nicknameInputEl.focus();
    nicknameInputEl.select();
    return;
  }

  handleEntry();
}

entryFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
  handleEntry();
});
classCodeInputEl.addEventListener("keydown", handleEntryFieldKeydown);
nicknameInputEl.addEventListener("keydown", handleEntryFieldKeydown);
startButtonEl.addEventListener("click", handleEntry);

window.addEventListener("online", () => {
  setConnectionState(state, true);
  persist();
  paint();
});

window.addEventListener("offline", () => {
  setConnectionState(state, false);
  persist();
  paint();
});

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState(state)));
  } catch {
    state.sync.message = "브라우저 저장 공간을 사용할 수 없습니다. 현재 화면에서 답변을 확인하세요.";
  }
}

function loadState() {
  const isDemoLastPage = isLastPageDemoPath();

  try {
    if (isDemoLastPage) {
      const demoState = prepareLastPageDemoState(createInitialState(), lesson);
      setConnectionState(demoState, navigator.onLine);
      return applyViewFromPath(demoState);
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);
    const nextState = saved ? hydrateState(JSON.parse(saved)) : createInitialState();
    setConnectionState(nextState, navigator.onLine);
    return applyViewFromPath(nextState);
  } catch {
    const fallbackState = isDemoLastPage
      ? prepareLastPageDemoState(createInitialState(), lesson)
      : createInitialState();
    setConnectionState(fallbackState, navigator.onLine);
    return applyViewFromPath(fallbackState);
  }
}

// 화면 종류는 저장값이 아니라 접속 경로가 결정한다. /teacher에서만 교사용 화면이 열린다.
function applyViewFromPath(nextState) {
  setView(nextState, isTeacherPath() ? "teacher" : "student");
  return nextState;
}

function isLastPageDemoPath() {
  return window.location.pathname.replace(/\/+$/, "") === "/lastpage";
}

function isTeacherPath() {
  return window.location.pathname.replace(/\/+$/, "") === "/teacher";
}

renderStaticHeader(lesson);
paint();
