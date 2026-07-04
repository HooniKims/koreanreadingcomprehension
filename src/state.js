// 학습 진행, 코칭, 저장 가능한 활동 상태를 관리하는 모듈
const OFF_TASK_PATTERN = /(모른다|몰라|하기 싫|하기싫|포기|정답|알려줘|귀찮|싫다|몰?루|ㅋㅋ|ㅎㅎ)/i;
const MIN_REASON_LENGTH = 8;
const MIN_PARAGRAPH_SUMMARY_LENGTH = 10;
const MIN_OVERALL_SUMMARY_LENGTH = 28;

export function createInitialState() {
  return {
    classroom: {
      classCode: "",
      nickname: "",
      isEntered: false,
    },
    ui: {
      view: "student",
      helpMessage: "",
    },
    aiChat: {
      isOpen: false,
      isLoading: false,
      messages: [],
    },
    phase: "paragraphs",
    currentIndex: 0,
    selectedIndex: null,
    feedback: null,
    solvedParagraphs: new Set(),
    paragraphResponses: {},
    paragraphSummaries: [],
    paragraphSummaryFeedback: null,
    collectedCenters: [],
    cardOrder: null,
    orderFeedback: null,
    overallSummary: {
      text: "",
      feedback: null,
      isComplete: false,
      modelVisible: false,
    },
    sync: {
      isOnline: true,
      hasPendingChanges: false,
      message: "저장되었습니다.",
    },
    helpRequests: [],
    coachingLog: [],
    fastFinishers: [],

    // 이전 버전 렌더러와의 호환 필드
    reviewTargetIndex: null,
    reviewStarted: false,
    reviewAnswerIndex: null,
    reviewFeedback: null,
    shuffledSummaryCenters: null,
    studentSummary: "",
    isModelSummaryVisible: false,
    isComplete: false,
  };
}

export function enterClassroom(state, { classCode, nickname }) {
  const normalizedCode = String(classCode ?? "").trim().toUpperCase();
  const normalizedNickname = String(nickname ?? "").trim();

  state.classroom = {
    classCode: normalizedCode,
    nickname: normalizedNickname,
    isEntered: Boolean(normalizedCode && normalizedNickname),
  };
  markPendingSave(state);
  return state.classroom;
}

export function setView(state, view) {
  state.ui.view = view === "teacher" ? "teacher" : "student";
  return state.ui.view;
}

export function openAiChat(state) {
  state.aiChat ??= { isOpen: false, isLoading: false, messages: [] };
  state.aiChat.isOpen = true;
  markPendingSave(state);
  return state.aiChat;
}

export function closeAiChat(state) {
  state.aiChat ??= { isOpen: false, isLoading: false, messages: [] };
  state.aiChat.isOpen = false;
  state.aiChat.isLoading = false;
  markPendingSave(state);
  return state.aiChat;
}

export function setAiChatLoading(state, isLoading) {
  state.aiChat ??= { isOpen: false, isLoading: false, messages: [] };
  state.aiChat.isOpen = true;
  state.aiChat.isLoading = Boolean(isLoading);
  markPendingSave(state);
  return state.aiChat;
}

export function appendAiChatMessage(state, role, message) {
  const normalizedMessage = normalizeText(message);

  if (!normalizedMessage) {
    return null;
  }

  state.aiChat ??= { isOpen: true, isLoading: false, messages: [] };
  state.aiChat.isOpen = true;

  const entry = {
    id: createId("chat"),
    role: role === "user" ? "user" : "assistant",
    message: normalizedMessage,
    createdAt: new Date().toISOString(),
  };

  state.aiChat.messages = [...(state.aiChat.messages ?? []), entry].slice(-12);
  markPendingSave(state);
  return entry;
}

export function clearAiChatMessages(state) {
  state.aiChat ??= { isOpen: true, isLoading: false, messages: [] };
  state.aiChat.isOpen = true;
  state.aiChat.isLoading = false;
  state.aiChat.messages = [];
  markPendingSave(state);
  return state.aiChat;
}

export function setConnectionState(state, isOnline) {
  state.sync.isOnline = Boolean(isOnline);

  if (!state.sync.isOnline) {
    state.sync.hasPendingChanges = true;
    state.sync.message = "인터넷 연결이 불안정합니다. 답변은 임시 저장됩니다.";
    return state.sync;
  }

  state.sync.message = state.sync.hasPendingChanges
    ? "저장되었습니다."
    : "온라인 상태입니다.";
  state.sync.hasPendingChanges = false;
  return state.sync;
}

export function markPendingSave(state) {
  if (!state.sync.isOnline) {
    state.sync.hasPendingChanges = true;
    state.sync.message = "인터넷 연결이 불안정합니다. 답변은 임시 저장됩니다.";
  } else {
    state.sync.message = "저장되었습니다.";
  }
}

export function selectSentence(state, lesson, sentenceIndex) {
  const paragraph = lesson.paragraphs[state.currentIndex];

  if (!paragraph?.sentences[sentenceIndex]) {
    return null;
  }

  state.selectedIndex = sentenceIndex;
  state.feedback = {
    status: "selected",
    isCorrect: sentenceIndex === paragraph.centerIndex,
    revealsAnswer: false,
    message: `${sentenceIndex + 1}문장을 선택했습니다. 왜 중심문장인지 짧게 적어 보세요.`,
  };
  markPendingSave(state);
  return state.feedback;
}

export function submitParagraphWork(state, lesson, { reason }) {
  const paragraph = lesson.paragraphs[state.currentIndex];
  const paragraphId = paragraph.id;
  const normalizedReason = normalizeText(reason);
  const response = ensureParagraphResponse(state, paragraph);

  response.selectedIndex = state.selectedIndex;
  response.reason = normalizedReason;

  if (state.selectedIndex === null || state.selectedIndex === undefined) {
    return setParagraphFeedback(state, response, {
      status: "coaching",
      revealsAnswer: false,
      message: "먼저 문단에서 중심문장이라고 생각하는 문장을 하나 골라 주세요.",
    });
  }

  if (isOffTask(normalizedReason)) {
    return coachParagraph(state, paragraph, response, "이 문장이 문단 전체와 어떻게 이어지는지 한 번만 더 볼까요?");
  }

  if (normalizedReason.length < MIN_REASON_LENGTH) {
    return coachParagraph(state, paragraph, response, "왜 그렇게 골랐는지 한 문장으로 조금만 더 써 볼까요?");
  }

  if (state.selectedIndex !== paragraph.centerIndex) {
    return coachParagraph(state, paragraph, response, getSelectionHint(response.coachingCount));
  }

  response.isComplete = true;
  response.completedAt = new Date().toISOString();
  response.modelCenterSentence = paragraph.sentences[paragraph.centerIndex].text;
  response.modelReason = getCenterReason(paragraph);
  response.modelSummary = getModelSummary(paragraph);

  state.solvedParagraphs.add(paragraphId);
  upsertCollectedCenter(state, paragraph);

  const result = setParagraphFeedback(state, response, {
    status: "complete",
    isCorrect: true,
    revealsAnswer: true,
    message: "좋습니다. 중심문장과 이유를 저장했습니다. 문단 요약은 모든 문단을 본 뒤에 합니다.",
    modelCenterSentence: response.modelCenterSentence,
    modelReason: response.modelReason,
    modelSummary: response.modelSummary,
  });

  markPendingSave(state);
  return result;
}

export function requestParagraphCoach(state, lesson, { reason }) {
  const paragraph = lesson.paragraphs[state.currentIndex];
  const response = ensureParagraphResponse(state, paragraph);

  response.selectedIndex = state.selectedIndex;
  response.reason = normalizeText(reason);

  if (state.selectedIndex === null || state.selectedIndex === undefined) {
    return coachParagraph(state, paragraph, response, "먼저 중심문장이라고 생각하는 문장을 하나 눌러 볼까요?");
  }

  if (isOffTask(response.reason)) {
    return coachParagraph(state, paragraph, response, "정답을 바로 보기보다, 고른 문장이 문단 전체와 어떻게 이어지는지 먼저 생각해 볼까요?");
  }

  return coachParagraph(state, paragraph, response, "다른 문장들이 고른 문장을 더 자세히 설명하는지 살펴보세요.");
}

function coachParagraph(state, paragraph, response, message) {
  response.isComplete = false;
  response.coachingCount += 1;

  const result = setParagraphFeedback(state, response, {
    status: "coaching",
    isCorrect: false,
    revealsAnswer: false,
    message,
  });

  state.coachingLog.push({
    id: createId("coach"),
    paragraphId: paragraph.id,
    label: paragraph.label,
    nickname: state.classroom.nickname,
    message,
    createdAt: new Date().toISOString(),
  });
  markPendingSave(state);
  return result;
}

function setParagraphFeedback(state, response, feedback) {
  response.feedback = feedback;
  state.feedback = feedback;
  markPendingSave(state);
  return feedback;
}

export function moveSummaryCard(state, fromIndex, toIndex) {
  if (!Array.isArray(state.cardOrder)) {
    return state.cardOrder;
  }

  const nextIndex = Math.max(0, Math.min(state.cardOrder.length - 1, toIndex));
  const [item] = state.cardOrder.splice(fromIndex, 1);

  if (!item) {
    return state.cardOrder;
  }

  state.cardOrder.splice(nextIndex, 0, item);
  state.orderFeedback = null;
  markPendingSave(state);
  return state.cardOrder;
}

export function submitSummaryOrder(state, correctOrder) {
  const currentOrder = state.cardOrder ?? [];
  const isCorrect =
    currentOrder.length === correctOrder.length &&
    currentOrder.every((paragraphId, index) => paragraphId === correctOrder[index]);

  state.orderFeedback = isCorrect
    ? {
        isCorrect: true,
        revealsAnswer: false,
        message: "맞습니다. 글의 흐름에 맞게 문단 요약 카드를 배열했습니다.",
      }
    : {
        isCorrect: false,
        revealsAnswer: false,
        message: "처음에는 개념 소개와 장점이 나오고, 뒤로 갈수록 걱정과 결론이 이어지는 흐름인지 다시 살펴보세요.",
      };

  if (isCorrect) {
    state.phase = "overall";
  }

  markPendingSave(state);
  return state.orderFeedback;
}

export function submitParagraphSummaries(state, lesson, summaries = {}) {
  const entries = lesson.paragraphs.map((paragraph) => ({
    paragraph,
    text: normalizeText(summaries[paragraph.id]),
  }));
  const incomplete = entries.find(({ text }) => text.length < MIN_PARAGRAPH_SUMMARY_LENGTH || isOffTask(text));

  if (incomplete) {
    state.paragraphSummaryFeedback = {
      status: "coaching",
      revealsAnswer: false,
      paragraphId: incomplete.paragraph.id,
      message: `${incomplete.paragraph.label} 요약을 조금 더 써 볼까요? 누가, 무엇을, 어떻게 말하는지 한 문장으로 적으면 됩니다.`,
    };
    markPendingSave(state);
    return state.paragraphSummaryFeedback;
  }

  state.paragraphSummaries = [];
  entries.forEach(({ paragraph, text }) => {
    upsertParagraphSummary(state, paragraph, text);
    ensureParagraphResponse(state, paragraph).paragraphSummary = text;
  });

  state.paragraphSummaryFeedback = {
    status: "complete",
    revealsAnswer: false,
    message: "문단별 요약을 저장했습니다. 이제 글의 흐름에 맞게 요약 카드를 배열해 봅시다.",
  };
  state.phase = "order";
  state.orderFeedback = null;
  state.cardOrder = buildInitialCardOrder(state, lesson);
  markPendingSave(state);
  return state.paragraphSummaryFeedback;
}

export function submitOverallSummary(state, summaryText) {
  const text = normalizeText(summaryText);
  state.overallSummary.text = text;

  if (text.length < MIN_OVERALL_SUMMARY_LENGTH || isOffTask(text)) {
    state.overallSummary.feedback = {
      status: "coaching",
      revealsAnswer: false,
      message: "문단별 요약을 보며 글에서 말하려는 생각을 한 문장 이상으로 써 볼까요?",
    };
    markPendingSave(state);
    return state.overallSummary.feedback;
  }

  state.overallSummary.feedback = {
    status: "complete",
    revealsAnswer: true,
    message: "전체 글의 흐름이 잘 드러나게 정리했습니다.",
  };
  state.overallSummary.isComplete = true;
  state.overallSummary.modelVisible = false;
  state.phase = "done";
  state.isComplete = true;
  registerFastFinisher(state);
  markPendingSave(state);
  return state.overallSummary.feedback;
}

export function showOverallModelAnswer(state) {
  state.overallSummary.modelVisible = true;
  markPendingSave(state);
}

export function requestHelp(state, stage) {
  const paragraph = state.phase === "paragraphs" ? state.currentIndex + 1 : state.phase;
  const request = {
    id: createId("help"),
    classCode: state.classroom.classCode,
    nickname: state.classroom.nickname || "익명 학생",
    paragraph,
    stage,
    createdAt: new Date().toISOString(),
  };

  state.helpRequests.push(request);
  state.ui.helpMessage = "도움을 요청했어요!";
  markPendingSave(state);
  return request;
}

export function dismissHelpRequest(state, requestId) {
  state.helpRequests = state.helpRequests.filter((request) => request.id !== requestId);
  markPendingSave(state);
}

export function prepareSummaryCards(state, lesson) {
  if (!state.cardOrder) {
    state.cardOrder = buildInitialCardOrder(state, lesson);
  }
  return state.cardOrder;
}

export function getParagraphSummary(state, paragraphId) {
  return state.paragraphSummaries.find((summary) => summary.paragraphId === paragraphId);
}

export function getParagraphResponse(state, paragraphId) {
  return state.paragraphResponses[paragraphId] ?? null;
}

export function getCorrectSummaryOrder(lesson) {
  return lesson.paragraphs.map((paragraph) => paragraph.id);
}

export function getModelOverallSummary(lesson) {
  if (lesson.modelOverallSummary) {
    return lesson.modelOverallSummary;
  }

  return lesson.paragraphs
    .map((paragraph) => getModelSummary(paragraph))
    .join(" ");
}

export function prepareLastPageDemoState(state, lesson) {
  state.classroom = {
    classCode: "DEMO",
    nickname: "시연 학생",
    isEntered: true,
  };
  state.ui = { view: "student" };
  state.aiChat = { isOpen: false, isLoading: false, messages: [] };
  state.phase = "overall";
  state.currentIndex = Math.max(0, lesson.paragraphs.length - 1);
  state.selectedIndex = null;
  state.feedback = null;
  state.solvedParagraphs = new Set();
  state.paragraphResponses = {};
  state.paragraphSummaries = [];
  state.collectedCenters = [];

  lesson.paragraphs.forEach((paragraph) => {
    const response = ensureParagraphResponse(state, paragraph);
    response.selectedIndex = paragraph.centerIndex;
    response.reason = getCenterReason(paragraph);
    response.paragraphSummary = getModelSummary(paragraph);
    response.coachingCount = 0;
    response.isComplete = true;
    response.completedAt = new Date().toISOString();
    response.modelCenterSentence = paragraph.sentences[paragraph.centerIndex].text;
    response.modelReason = getCenterReason(paragraph);
    response.modelSummary = getModelSummary(paragraph);
    response.feedback = {
      status: "complete",
      isCorrect: true,
      revealsAnswer: true,
      message: "시연용으로 완료된 문단입니다.",
      modelCenterSentence: response.modelCenterSentence,
      modelReason: response.modelReason,
      modelSummary: response.modelSummary,
    };

    state.solvedParagraphs.add(paragraph.id);
    upsertParagraphSummary(state, paragraph, getModelSummary(paragraph));
    upsertCollectedCenter(state, paragraph);
  });

  state.cardOrder = lesson.paragraphs.map((paragraph) => paragraph.id);
  state.orderFeedback = {
    isCorrect: true,
    revealsAnswer: false,
    message: "시연용으로 문단 요약 카드 순서를 완료했습니다.",
  };
  state.paragraphSummaryFeedback = {
    status: "complete",
    revealsAnswer: false,
    message: "시연용으로 문단별 요약을 준비했습니다.",
  };
  state.overallSummary = {
    text: "",
    feedback: null,
    isComplete: false,
    modelVisible: false,
  };
  state.helpRequests = [];
  state.coachingLog = [];
  state.fastFinishers = [];
  state.isComplete = false;
  state.studentSummary = "";
  state.isModelSummaryVisible = false;
  markPendingSave(state);
  return state;
}

export function serializeState(state) {
  return {
    ...state,
    solvedParagraphs: [...state.solvedParagraphs],
  };
}

export function hydrateState(savedState) {
  const state = createInitialState();

  if (!savedState || typeof savedState !== "object") {
    return state;
  }

  Object.assign(state, savedState);
  state.classroom = { ...createInitialState().classroom, ...savedState.classroom };
  state.ui = { ...createInitialState().ui, ...savedState.ui };
  state.aiChat = {
    ...createInitialState().aiChat,
    ...savedState.aiChat,
    messages: savedState.aiChat?.messages ?? [],
  };
  state.sync = { ...createInitialState().sync, ...savedState.sync };
  state.overallSummary = {
    ...createInitialState().overallSummary,
    ...savedState.overallSummary,
  };
  state.solvedParagraphs = new Set(savedState.solvedParagraphs ?? []);
  state.paragraphResponses = savedState.paragraphResponses ?? {};
  state.paragraphSummaries = savedState.paragraphSummaries ?? [];
  state.paragraphSummaryFeedback = savedState.paragraphSummaryFeedback ?? null;
  state.collectedCenters = savedState.collectedCenters ?? [];
  state.helpRequests = savedState.helpRequests ?? [];
  state.coachingLog = savedState.coachingLog ?? [];
  state.fastFinishers = savedState.fastFinishers ?? [];
  return state;
}

export function resetLesson(state) {
  const nextState = createInitialState();
  nextState.classroom = { ...state.classroom };
  nextState.sync = { ...state.sync };
  Object.keys(state).forEach((key) => {
    delete state[key];
  });
  Object.assign(state, nextState);
  markPendingSave(state);
}

export function resetEntry(state) {
  const nextState = createInitialState();
  nextState.sync = { ...state.sync };
  Object.keys(state).forEach((key) => {
    delete state[key];
  });
  Object.assign(state, nextState);
  markPendingSave(state);
}

function ensureParagraphResponse(state, paragraph) {
  state.paragraphResponses[paragraph.id] ??= {
    paragraphId: paragraph.id,
    label: paragraph.label,
    selectedIndex: null,
    reason: "",
    paragraphSummary: "",
    coachingCount: 0,
    isComplete: false,
    feedback: null,
  };

  return state.paragraphResponses[paragraph.id];
}

function upsertParagraphSummary(state, paragraph, summaryText) {
  const summary = {
    paragraphId: paragraph.id,
    label: paragraph.label,
    text: summaryText,
    modelText: getModelSummary(paragraph),
  };
  const existingIndex = state.paragraphSummaries.findIndex(
    (item) => item.paragraphId === paragraph.id,
  );

  if (existingIndex >= 0) {
    state.paragraphSummaries[existingIndex] = summary;
  } else {
    state.paragraphSummaries.push(summary);
  }
}

function upsertCollectedCenter(state, paragraph) {
  const center = {
    paragraphId: paragraph.id,
    label: paragraph.label,
    text: paragraph.sentences[paragraph.centerIndex].text,
  };
  const existingIndex = state.collectedCenters.findIndex(
    (item) => item.paragraphId === paragraph.id,
  );

  if (existingIndex >= 0) {
    state.collectedCenters[existingIndex] = center;
  } else {
    state.collectedCenters.push(center);
  }
}

function buildInitialCardOrder(state, lesson) {
  const sourceIds =
    state.paragraphSummaries.length > 0
      ? state.paragraphSummaries.map((summary) => summary.paragraphId)
      : lesson.paragraphs.map((paragraph) => paragraph.id);

  const cards = [...sourceIds];

  if (cards.length > 1) {
    [cards[0], cards[1]] = [cards[1], cards[0]];
  }

  return cards;
}

function registerFastFinisher(state) {
  if (!state.classroom.nickname) {
    return;
  }

  if (state.fastFinishers.some((student) => student.nickname === state.classroom.nickname)) {
    return;
  }

  state.fastFinishers.push({
    nickname: state.classroom.nickname,
    badge: "오늘의 국어 코치",
    completedAt: new Date().toISOString(),
  });
}

function getSelectionHint(coachingCount) {
  const hints = [
    "이 문장을 빼면 문단의 핵심 내용이 사라질까요?",
    "중심문장은 이 문단이 무엇을 말하는지 가장 잘 보여주는 문장입니다.",
    "고른 문장보다 문단 전체를 더 잘 말해 주는 문장이 있는지 다시 살펴보세요.",
  ];
  return hints[Math.min(coachingCount, hints.length - 1)];
}

function getCenterReason(paragraph) {
  return paragraph.centerReason ?? paragraph.sentences[paragraph.centerIndex].relation;
}

function getModelSummary(paragraph) {
  return paragraph.modelSummary ?? paragraph.sentences[paragraph.centerIndex].text;
}

function isOffTask(text) {
  return OFF_TASK_PATTERN.test(text);
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// 이전 버전 API 호환
export function startReviewQuestion(state) {
  state.reviewStarted = true;
  return true;
}

export function selectReviewAnswer(state) {
  state.reviewFeedback = {
    isCorrect: true,
    message: "확인했습니다.",
  };
  return state.reviewFeedback;
}

export function canMoveNext(state) {
  return state.phase !== "paragraphs" || Boolean(state.feedback?.status === "complete");
}

export function moveNext(state, lesson) {
  if (state.currentIndex >= lesson.paragraphs.length - 1) {
    state.phase = "summaries";
    state.selectedIndex = null;
    state.feedback = null;
    return true;
  }

  state.currentIndex += 1;
  state.selectedIndex = null;
  state.feedback = null;
  return true;
}

export function restartLesson(state) {
  resetLesson(state);
}

export function updateStudentSummary(state, summaryText) {
  return submitOverallSummary(state, summaryText);
}

export function hideModelSummary(state) {
  state.overallSummary.modelVisible = false;
  state.isModelSummaryVisible = false;
}
