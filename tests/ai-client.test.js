import test from "node:test";
import assert from "node:assert/strict";
import { requestAiCoach } from "../src/ai.js";

test("requestAiCoach posts coaching context and returns model message", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = null;

  globalThis.fetch = async (url, options) => {
    requestBody = JSON.parse(options.body);
    assert.equal(url, "/.netlify/functions/coach");
    return Response.json({ message: "문단 전체와 어떻게 이어지는지 생각해 볼까요?" });
  };

  try {
    const message = await requestAiCoach({
      paragraph: {
        label: "1문단",
        centerIndex: 1,
        sentences: [{ text: "첫 문장" }, { text: "둘째 문장" }],
      },
      selectedIndex: 0,
      reason: "모른다",
      question: "중심문장은 어떻게 찾나요?",
    });

    assert.equal(message, "문단 전체와 어떻게 이어지는지 생각해 볼까요?");
    assert.deepEqual(requestBody.paragraph.sentences, ["첫 문장", "둘째 문장"]);
    assert.equal("paragraphSummary" in requestBody, false);
    assert.equal(requestBody.question, "중심문장은 어떻게 찾나요?");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requestAiCoach can stream the returned coaching message in chunks", async () => {
  const originalFetch = globalThis.fetch;
  const chunks = [];

  globalThis.fetch = async () =>
    Response.json({ message: "고른 문장이 문단 전체의 내용을 넓게 말하는지 살펴보세요." });

  try {
    const message = await requestAiCoach({
      paragraph: {
        label: "1문단",
        centerIndex: 1,
        sentences: [{ text: "첫 문장" }, { text: "둘째 문장" }],
      },
      selectedIndex: 0,
      reason: "잘 모르겠어요",
      onChunk: (chunk) => chunks.push(chunk),
      streamDelayMs: 0,
    });

    assert.equal(message, "고른 문장이 문단 전체의 내용을 넓게 말하는지 살펴보세요.");
    assert.ok(chunks.length > 1);
    assert.equal(chunks.join(""), message);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requestAiCoach falls back silently when function is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Not found", { status: 404 });

  try {
    const message = await requestAiCoach({
      paragraph: { sentences: [] },
      selectedIndex: null,
      reason: "",
    });

    assert.equal(message, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
