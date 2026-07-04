import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("paragraph sentences render as inline text spans instead of separate button blocks", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(renderSource, /<span\s+class="sentence-card"/);
  assert.match(renderSource, /role="button"/);
  assert.doesNotMatch(renderSource, /<button\s+class="sentence-card"/);
  assert.match(styles, /\.sentence-card\s*{[^}]*display:\s*inline;/s);
  assert.match(styles, /\.sentence-card\s*{[^}]*appearance:\s*none;/s);
  assert.match(styles, /\.sentence-card\s*{[^}]*border:\s*0;/s);
});

test("human help button is labeled broadly as help, not teacher-only help", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(renderSource, />도움!</);
  assert.match(renderSource, />도움 요청</);
  assert.match(
    renderSource,
    /<div class="help-action-wrap">[\s\S]*<button class="help-action" type="button">도움!<\/button>[\s\S]*class="help-confirmation"/,
  );
  assert.match(renderSource, /도움을 요청했어요!/);
  assert.match(styles, /\.help-confirmation\s*{/);
  assert.match(styles, /\.help-confirmation\s*{[^}]*padding:\s*0;/s);
  assert.match(styles, /\.help-confirmation\s*{[^}]*background:\s*transparent;/s);
  assert.match(styles, /\.help-confirmation\s*{[^}]*color:\s*var\(--green-accent\);/s);
  assert.doesNotMatch(renderSource, /선생님 도움/);
});

test("top tools include a restart button for clearing saved progress", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");

  assert.match(renderSource, /class="restart-button"/);
  assert.match(renderSource, />처음부터</);
  assert.match(renderSource, /handlers\.onRestart/);
  assert.match(renderSource, /class="entry-reset-button"/);
  assert.match(renderSource, />입장 다시하기</);
  assert.match(renderSource, /handlers\.onResetEntry/);
});

test("paragraph screen does not ask for paragraph summary before all paragraphs are done", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");

  assert.doesNotMatch(renderSource, /name="paragraphSummary"/);
  assert.match(renderSource, /renderParagraphSummaries/);
  assert.match(renderSource, /handlers\.onParagraphSummariesSubmit/);
});

test("paragraph form relies on the top help button and has no bottom help request", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");

  assert.match(renderSource, /<button class="help-action" type="button">도움!<\/button>/);
  assert.doesNotMatch(renderSource, /handlers\.onHelp\("중심문장 이유 쓰기"\)/);
});

test("AI coach action uses the generated image button asset", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const assetUrl = new URL("../assets/ai-coach-button.png", import.meta.url);

  assert.equal(existsSync(assetUrl), true);
  assert.match(renderSource, /src="\.\/assets\/ai-coach-button\.png"/);
  assert.match(renderSource, /class="ai-coach-avatar"/);
  assert.match(styles, /\.ai-coach-avatar\s*{/);
});

test("AI coach image button opens a popup chat", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(renderSource, /renderAiCoachChat/);
  assert.match(renderSource, /class="ai-chat-modal"/);
  assert.match(renderSource, /도와드릴게요/);
  assert.match(renderSource, /아주 쉬운 말/);
  assert.doesNotMatch(renderSource, /도와줄게요/);
  assert.match(renderSource, /handlers\.onOpenAiChat/);
  assert.match(renderSource, /handlers\.onAiChatSubmit/);
  assert.match(styles, /\.ai-chat-modal\s*{/);
});

test("AI coach chat shows a wait message while the response is loading", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(renderSource, /잠시만 기다려주세요!/);
  assert.match(renderSource, /state\.aiChat\?\.isLoading/);
  assert.match(renderSource, /class="ai-chat-message is-assistant is-loading"/);
  assert.match(renderSource, /state\.aiChat\?\.isLoading \? "disabled" : ""/);
  assert.match(renderSource, /state\.aiChat\?\.isLoading \? "기다리는 중" : "묻기"/);
  assert.match(appSource, /setAiChatLoading\(state, true\)/);
  assert.match(appSource, /setAiChatLoading\(state, false\)/);
  assert.match(styles, /\.ai-chat-message\.is-loading\s*{/);
});

test("AI coach chat submits on Enter and keeps Shift Enter for line breaks", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");

  assert.match(renderSource, /event\.key === "Enter"/);
  assert.match(renderSource, /!event\.shiftKey/);
  assert.match(renderSource, /event\.preventDefault\(\)/);
  assert.match(renderSource, /requestSubmit\(\)/);
});

test("AI coach chat keeps previous messages available through scrolling", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(renderSource, /scrollAiChatToLatest/);
  assert.match(renderSource, /scrollHeight/);
  assert.match(styles, /\.ai-chat-modal\s*{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;/s);
  assert.match(styles, /\.ai-chat-messages\s*{[^}]*min-height:\s*0;/s);
  assert.match(styles, /\.ai-chat-messages\s*{[^}]*overflow-y:\s*auto;/s);
});

test("AI coach chat scrolls to the newest message after layout settles", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");

  assert.match(renderSource, /requestAnimationFrame/);
  assert.match(renderSource, /scrollAiChatToLatest\(\);\s*requestAnimationFrame/s);
});

test("AI coach chat can clear the current conversation", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(renderSource, /class="ai-chat-clear"/);
  assert.match(renderSource, />질문 초기화</);
  assert.match(renderSource, /handlers\.onClearAiChat/);
  assert.match(appSource, /clearAiChatMessages/);
  assert.match(appSource, /onClearAiChat/);
  assert.match(styles, /\.ai-chat-clear\s*{/);
});

test("paragraph coaching updates the existing coach panel without repainting the page", () => {
  const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const coachingStart = appSource.indexOf("const requestVersion = ++paragraphCoachRequestVersion");
  const coachingEnd = appSource.indexOf("},\n  async onAiCoach");
  const coachingBlock = appSource.slice(coachingStart, coachingEnd);

  assert.notEqual(coachingStart, -1);
  assert.notEqual(coachingEnd, -1);
  assert.match(appSource, /updateParagraphCoachPanel/);
  assert.match(appSource, /setParagraphSubmitPending/);
  assert.match(coachingBlock, /onChunk/);
  assert.doesNotMatch(coachingBlock, /paint\(/);
  assert.match(renderSource, /export function updateParagraphCoachPanel/);
  assert.match(renderSource, /export function setParagraphSubmitPending/);
  assert.match(renderSource, /이유 쓰기 힌트/);
  assert.match(styles, /\.coach-panel\.is-streaming\s*{/);
});

test("feedback panel appears at the top of the paragraph response column", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const feedbackIndex = renderSource.indexOf("${renderFeedback(state, response)}");
  const reasonIndex = renderSource.indexOf('<form class="activity-form">');
  const coachIndex = renderSource.indexOf('<section class="ai-coach-box"');

  assert.notEqual(feedbackIndex, -1);
  assert.notEqual(reasonIndex, -1);
  assert.notEqual(coachIndex, -1);
  assert.ok(feedbackIndex < reasonIndex);
  assert.ok(feedbackIndex < coachIndex);
  assert.match(styles, /\.response-column\s*>\s*\.coach-panel\s*{[^}]*order:\s*1;/s);
  assert.match(styles, /\.response-column\s*>\s*\.activity-form\s*{[^}]*order:\s*2;/s);
  assert.match(styles, /\.response-column\s*>\s*\.ai-coach-box\s*{[^}]*order:\s*3;/s);
});

test("reason input appears before AI coach in the paragraph response column", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const reasonIndex = renderSource.indexOf("${renderParagraphActions(lesson, state, response)}");
  const coachIndex = renderSource.indexOf('<section class="ai-coach-box"');

  assert.notEqual(reasonIndex, -1);
  assert.notEqual(coachIndex, -1);
  assert.ok(reasonIndex < coachIndex);
  assert.match(renderSource, /<form class="activity-form">/);
});

test("completed paragraph renders a continue button after answer feedback", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");

  assert.match(renderSource, /renderParagraphActions/);
  assert.match(renderSource, /handlers\.onParagraphContinue/);
  assert.match(renderSource, /다음 문단으로/);
  assert.match(renderSource, /문단 요약으로/);
});

test("overall summary accepts dragged paragraph boxes into the summary textarea", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(renderSource, /class="center-chip"[\s\S]*draggable="true"/);
  assert.match(renderSource, /data-summary-text=/);
  assert.match(renderSource, /wireOverallSummaryDrop\(summaryEl\)/);
  assert.match(renderSource, /dataTransfer\?\.setData\("text\/plain"/);
  assert.match(renderSource, /insertDraggedSummaryText/);
  assert.match(renderSource, /querySelector\("#student-summary"\)/);
  assert.match(styles, /\.center-chip\[draggable="true"\]\s*{/);
  assert.match(styles, /\.student-summary-form textarea\.is-drop-target\s*{/);
});

test("overall summary guides students and reveals the model answer through a button", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(renderSource, /드래그 해서 문장을 넣고, 자연스럽게 이어질 수 있도록 다듬어주세요\./);
  assert.match(renderSource, /class="summary-instruction"/);
  assert.match(renderSource, /class="model-answer-button"/);
  assert.match(renderSource, />모범 답안 보기</);
  assert.match(renderSource, /handlers\.onShowOverallModelAnswer/);
  assert.match(appSource, /showOverallModelAnswer/);
  assert.match(appSource, /onShowOverallModelAnswer/);
  assert.match(styles, /\.summary-instruction\s*{/);
  assert.match(styles, /\.model-answer-button\s*{/);
});

test("teacher dashboard has an explicit demo reset control", () => {
  const renderSource = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(renderSource, /class="teacher-reset-button"/);
  assert.match(renderSource, />시연 초기화</);
  assert.match(renderSource, /handlers\.onTeacherReset/);
  assert.match(appSource, /onTeacherReset/);
  assert.match(styles, /\.teacher-reset-button\s*{/);
});
