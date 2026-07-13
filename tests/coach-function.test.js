import test from "node:test";
import assert from "node:assert/strict";
import { handler } from "../netlify/functions/coach.js";

test("coach function calls OpenAI Responses API with GPT-5.4 nano from env", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalUpstageKey = process.env.UPSTAGE_API_KEY;
  let requestBody = null;

  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-5.4-nano";
  process.env.UPSTAGE_API_KEY = "";
  globalThis.fetch = async (url, options) => {
    requestBody = JSON.parse(options.body);
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    return Response.json({ output_text: "다시 생각해 볼까요?" });
  };

  try {
    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({
        paragraph: {
          label: "1문단",
          sentences: ["첫 문장", "둘째 문장"],
          centerIndex: 1,
        },
        selectedIndex: 0,
        reason: "정답 알려줘",
        question: "중심문장을 쉽게 찾는 방법이 뭐야?",
      }),
    });
    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(payload.message, "다시 생각해 볼까요?");
    assert.equal(requestBody.model, "gpt-5.4-nano");
    assert.equal(requestBody.store, false);
    assert.ok(requestBody.max_output_tokens >= 220);
    assert.doesNotMatch(requestBody.input, /수업 코드|실명|학번/);
    assert.doesNotMatch(requestBody.input, /학생의 문단 요약/);
    assert.match(requestBody.input, /학생 질문: 중심문장을 쉽게 찾는 방법이 뭐야\?/);
    assert.match(requestBody.input, /요청 목적: 중심문장이라고 생각한 이유 쓰기 힌트/);
    assert.match(requestBody.input, /현재 보이는 문장만 참고/);
    assert.match(requestBody.instructions, /초등학교 4~5학년 학생도 이해할 수/);
    assert.doesNotMatch(requestBody.instructions, /중하 수준/);
    assert.match(requestBody.instructions, /쉬운 낱말/);
    assert.match(requestBody.instructions, /짧은 문장/);
    assert.match(requestBody.instructions, /어려운 말은 쉬운 말로/);
    assert.match(requestBody.instructions, /현재 보이는 문장/);
    assert.match(requestBody.instructions, /문단 밖/);
    assert.match(requestBody.instructions, /친절한 존댓말/);
    assert.match(requestBody.instructions, /반말을 쓰지 않는다/);
    assert.match(requestBody.instructions, /중심문장이라고 생각한 이유/);
    assert.match(requestBody.instructions, /문장을 중간에서 끊지 않는다/);
    assert.match(requestBody.input, /초등학교 4~5학년 학생도 이해할 수 있게/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_MODEL = originalModel;
    process.env.UPSTAGE_API_KEY = originalUpstageKey;
  }
});

test("coach function does not run without an API key", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalUpstageKey = process.env.UPSTAGE_API_KEY;
  process.env.OPENAI_API_KEY = "";
  process.env.UPSTAGE_API_KEY = "";

  try {
    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({}),
    });

    assert.equal(response.statusCode, 501);
  } finally {
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.UPSTAGE_API_KEY = originalUpstageKey;
  }
});

test("coach function prefers Upstage and keeps socratic questioning without revealing the answer", async () => {
  const originalFetch = globalThis.fetch;
  const originalUpstageKey = process.env.UPSTAGE_API_KEY;
  const originalUpstageModel = process.env.UPSTAGE_MODEL;
  let requestUrl = null;
  let requestBody = null;

  process.env.UPSTAGE_API_KEY = "upstage-test-key";
  process.env.UPSTAGE_MODEL = "solar-pro3";
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestBody = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, "Bearer upstage-test-key");
    return Response.json({
      choices: [
        {
          message: {
            content: "<think>정답은 2번이다.</think>문단이 무엇에 대해 말하고 있나요?",
          },
        },
      ],
    });
  };

  try {
    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({
        intent: "socratic",
        paragraph: {
          label: "1문단",
          sentences: ["첫 문장", "둘째 문장"],
          centerIndex: 1,
        },
        selectedIndex: 0,
        turn: 2,
        history: [
          { role: "assistant", content: "어떤 점 때문에 골랐나요?" },
          { role: "user", content: "그냥요" },
          { role: "banana", content: "  이상한 역할  " },
          { role: "user", content: "" },
        ],
      }),
    });
    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(requestUrl, "https://api.upstage.ai/v1/chat/completions");
    assert.equal(requestBody.model, "solar-pro3");
    assert.equal(payload.model, "solar-pro3");
    assert.equal(payload.message, "문단이 무엇에 대해 말하고 있나요?");

    const systemMessage = requestBody.messages[0];
    assert.equal(systemMessage.role, "system");
    assert.match(systemMessage.content, /유도 질문/);
    assert.match(systemMessage.content, /직접 판정은 절대 말하지 않는다/);
    assert.match(systemMessage.content, /친절한 존댓말/);
    assert.match(systemMessage.content, /번역투를 쓰지 않는다/);
    assert.match(systemMessage.content, /상투적 표현/);
    assert.match(systemMessage.content, /한 줄에 한 문장씩/);
    assert.match(systemMessage.content, /이모지, 불릿, 번호 목록/);
    assert.match(systemMessage.content, /난이도 규칙/);
    assert.match(systemMessage.content, /초등학교 4~5학년/);
    assert.match(systemMessage.content, /쉬운 풀이를 덧붙인다/);

    const inputMessage = requestBody.messages[1];
    assert.equal(inputMessage.role, "user");
    assert.match(inputMessage.content, /중심문장 번호.*비공개 정보/);
    assert.match(inputMessage.content, /학생이 지금 고른 문장 번호: 1/);
    assert.match(inputMessage.content, /지금까지 학생이 답한 횟수: 2/);

    const history = requestBody.messages.slice(2);
    assert.equal(history.length, 3);
    assert.deepEqual(
      history.map((entry) => entry.role),
      ["assistant", "user", "assistant"],
    );
    assert.equal(history[2].content, "이상한 역할");
  } finally {
    globalThis.fetch = originalFetch;
    process.env.UPSTAGE_API_KEY = originalUpstageKey;
    process.env.UPSTAGE_MODEL = originalUpstageModel;
  }
});

test("coach function falls back to OpenAI when Upstage fails", async () => {
  const originalFetch = globalThis.fetch;
  const originalUpstageKey = process.env.UPSTAGE_API_KEY;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const calledUrls = [];

  process.env.UPSTAGE_API_KEY = "upstage-test-key";
  process.env.OPENAI_API_KEY = "openai-test-key";
  globalThis.fetch = async (url) => {
    calledUrls.push(url);

    if (url.includes("upstage")) {
      return new Response("upstream error", { status: 500 });
    }

    return Response.json({ output_text: "이 문단은 무엇을 말하고 있나요?" });
  };

  try {
    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({
        paragraph: {
          label: "1문단",
          sentences: ["첫 문장", "둘째 문장"],
          centerIndex: 1,
        },
        selectedIndex: 0,
        reason: "중심 내용 같아서",
      }),
    });
    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calledUrls, [
      "https://api.upstage.ai/v1/chat/completions",
      "https://api.openai.com/v1/responses",
    ]);
    assert.equal(payload.message, "이 문단은 무엇을 말하고 있나요?");
  } finally {
    globalThis.fetch = originalFetch;
    process.env.UPSTAGE_API_KEY = originalUpstageKey;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});
