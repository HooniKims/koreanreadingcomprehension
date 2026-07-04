import test from "node:test";
import assert from "node:assert/strict";
import { lesson } from "../src/data.js";
import {
  createInitialState,
  appendAiChatMessage,
  closeAiChat,
  enterClassroom,
  moveNext,
  moveSummaryCard,
  openAiChat,
  prepareLastPageDemoState,
  resetEntry,
  requestHelp,
  requestParagraphCoach,
  setAiChatLoading,
  submitParagraphSummaries,
  submitOverallSummary,
  submitParagraphWork,
  submitSummaryOrder,
} from "../src/state.js";

test("student enters with class code and nickname without real personal data", () => {
  const state = createInitialState();

  enterClassroom(state, { classCode: "KOR-101", nickname: "7번 독서가" });

  assert.equal(state.classroom.classCode, "KOR-101");
  assert.equal(state.classroom.nickname, "7번 독서가");
  assert.equal(state.classroom.isEntered, true);
});

test("student can reset entry information and return to the entry screen", () => {
  const state = createInitialState();
  enterClassroom(state, { classCode: "KOR-101", nickname: "7번 독서가" });
  state.selectedIndex = lesson.paragraphs[0].centerIndex;
  submitParagraphWork(state, lesson, {
    reason: "중심 내용을 말하기 때문이다.",
  });

  resetEntry(state);

  assert.equal(state.classroom.classCode, "");
  assert.equal(state.classroom.nickname, "");
  assert.equal(state.classroom.isEntered, false);
  assert.equal(state.currentIndex, 0);
  assert.equal(state.paragraphSummaries.length, 0);
});

test("unrelated center-sentence reason triggers coaching without revealing answer", () => {
  const state = createInitialState();
  enterClassroom(state, { classCode: "KOR-101", nickname: "연습생" });
  state.selectedIndex = 0;

  const result = submitParagraphWork(state, lesson, {
    reason: "모른다",
  });

  assert.equal(result.status, "coaching");
  assert.equal(result.revealsAnswer, false);
  assert.match(result.message, /핵심 내용|문단 전체/);
  assert.equal(state.paragraphResponses.p1.isComplete, false);
});

test("completed paragraph reveals the answer and reason before moving on", () => {
  const state = createInitialState();
  enterClassroom(state, { classCode: "KOR-101", nickname: "연습생" });
  state.selectedIndex = lesson.paragraphs[0].centerIndex;

  const result = submitParagraphWork(state, lesson, {
    reason: "유전자 조작이 유전 공학을 활용하는 한 방법이라는 중심 내용을 말하기 때문이다.",
  });

  assert.equal(result.status, "complete");
  assert.equal(result.revealsAnswer, true);
  assert.match(result.modelCenterSentence, /유전자 조작/);
  assert.match(result.modelReason, /유전 공학|중심/);
  assert.equal(state.paragraphResponses.p1.isComplete, true);
  assert.equal(state.paragraphResponses.p1.selectedIndex, lesson.paragraphs[0].centerIndex);
  assert.equal(state.currentIndex, 0);
  assert.equal(state.paragraphResponses.p1.paragraphSummary, "");
  assert.equal(state.paragraphSummaries.length, 0);

  moveNext(state, lesson);

  assert.equal(state.currentIndex, 1);
});

test("paragraph summaries are written after all paragraphs are completed", () => {
  const state = createInitialState();
  enterClassroom(state, { classCode: "KOR-101", nickname: "연습생" });

  for (const paragraph of lesson.paragraphs) {
    state.selectedIndex = paragraph.centerIndex;
    submitParagraphWork(state, lesson, {
      reason: `${paragraph.label}의 중심 내용을 가장 넓게 말하고 다른 문장을 설명하기 때문이다.`,
    });
    moveNext(state, lesson);
  }

  assert.equal(state.phase, "summaries");
  assert.equal(state.paragraphSummaries.length, 0);

  const completeSummaries = Object.fromEntries(
    lesson.paragraphs.map((paragraph) => [
      paragraph.id,
      `${paragraph.label}은 유전자 조작에 대해 중요한 내용을 설명한다.`,
    ]),
  );

  const shortResult = submitParagraphSummaries(state, lesson, {
    ...completeSummaries,
    p1: "짧다",
  });

  assert.equal(shortResult.status, "coaching");
  assert.equal(state.phase, "summaries");

  const acceptedResult = submitParagraphSummaries(state, lesson, completeSummaries);

  assert.equal(acceptedResult.status, "complete");
  assert.equal(state.phase, "order");
  assert.deepEqual(
    state.paragraphSummaries.map((summary) => summary.paragraphId),
    lesson.paragraphs.map((paragraph) => paragraph.id),
  );
});

test("summary order gives a hint before revealing the correct order", () => {
  const state = createInitialState();
  state.cardOrder = ["p2", "p1", "p3"];

  const firstResult = submitSummaryOrder(state, ["p1", "p2", "p3"]);

  assert.equal(firstResult.isCorrect, false);
  assert.equal(firstResult.revealsAnswer, false);
  assert.match(firstResult.message, /흐름|처음|순서/);

  moveSummaryCard(state, 0, 1);
  const secondResult = submitSummaryOrder(state, ["p1", "p2", "p3"]);

  assert.equal(secondResult.isCorrect, true);
});

test("help request appears in teacher dashboard state", () => {
  const state = createInitialState();
  enterClassroom(state, { classCode: "KOR-101", nickname: "3번" });

  const request = requestHelp(state, "중심문장 이유 쓰기");

  assert.equal(request.nickname, "3번");
  assert.equal(state.helpRequests.length, 1);
  assert.equal(state.helpRequests[0].stage, "중심문장 이유 쓰기");
  assert.equal(state.ui.helpMessage, "도움을 요청했어요!");
});

test("manual AI coach request gives a hint without completing or revealing the answer", () => {
  const state = createInitialState();
  enterClassroom(state, { classCode: "KOR-101", nickname: "5번" });
  state.selectedIndex = 0;

  const result = requestParagraphCoach(state, lesson, {
    reason: "정답 알려줘",
  });

  assert.equal(result.status, "coaching");
  assert.equal(result.revealsAnswer, false);
  assert.equal(state.paragraphResponses.p1.isComplete, false);
  assert.equal(state.coachingLog.length, 1);
});

test("AI coach chat can open, store messages, and close", () => {
  const state = createInitialState();

  openAiChat(state);
  appendAiChatMessage(state, "user", "중심문장이 뭐예요?");
  appendAiChatMessage(state, "assistant", "문단 전체가 무엇을 말하는지 보여주는 문장을 찾아보세요.");
  closeAiChat(state);

  assert.equal(state.aiChat.isOpen, false);
  assert.equal(state.aiChat.messages.length, 2);
  assert.equal(state.aiChat.messages[0].role, "user");
  assert.match(state.aiChat.messages[1].message, /문단 전체/);
});

test("AI coach chat marks loading while waiting for a model response", () => {
  const state = createInitialState();

  setAiChatLoading(state, true);

  assert.equal(state.aiChat.isOpen, true);
  assert.equal(state.aiChat.isLoading, true);

  setAiChatLoading(state, false);

  assert.equal(state.aiChat.isLoading, false);
});

test("AI coach chat conversation can be cleared while keeping the popup open", async () => {
  const stateModule = await import("../src/state.js");
  const state = createInitialState();

  openAiChat(state);
  appendAiChatMessage(state, "user", "중심문장을 어떻게 찾나요?");
  appendAiChatMessage(state, "assistant", "문단 전체가 무엇을 말하는지 살펴보세요.");
  setAiChatLoading(state, true);

  assert.equal(typeof stateModule.clearAiChatMessages, "function");
  stateModule.clearAiChatMessages(state);

  assert.equal(state.aiChat.isOpen, true);
  assert.equal(state.aiChat.isLoading, false);
  assert.deepEqual(state.aiChat.messages, []);
});

test("lastpage demo state jumps directly to the overall summary task", () => {
  const state = createInitialState();

  prepareLastPageDemoState(state, lesson);

  assert.equal(state.classroom.isEntered, true);
  assert.equal(state.classroom.classCode, "DEMO");
  assert.equal(state.phase, "overall");
  assert.equal(state.currentIndex, lesson.paragraphs.length - 1);
  assert.equal(state.solvedParagraphs.size, lesson.paragraphs.length);
  assert.equal(state.paragraphSummaries.length, lesson.paragraphs.length);
  assert.equal(state.overallSummary.text, "");
  assert.equal(state.overallSummary.isComplete, false);
});

test("overall summary is coached when too short and accepted when it shows topic flow", () => {
  const state = createInitialState();

  const shortResult = submitOverallSummary(state, "조심해야 한다.");
  assert.equal(shortResult.status, "coaching");
  assert.match(shortResult.message, /문단별 요약|흐름|주제/);

  const acceptedResult = submitOverallSummary(
    state,
    "유전자 조작은 생활을 편리하게 하지만 생태계, 생명 윤리, 안전성 문제를 일으킬 수 있으므로 신중하게 확대해야 한다.",
  );
  assert.equal(acceptedResult.status, "complete");
  assert.equal(state.overallSummary.isComplete, true);
});
