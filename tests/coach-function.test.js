import test from "node:test";
import assert from "node:assert/strict";
import { handler } from "../netlify/functions/coach.js";

test("coach function calls OpenAI Responses API with GPT-5.4 nano from env", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  let requestBody = null;

  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-5.4-nano";
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
    assert.match(requestBody.instructions, /중학교 1학년/);
    assert.match(requestBody.instructions, /중하 수준/);
    assert.match(requestBody.instructions, /쉬운 낱말/);
    assert.match(requestBody.instructions, /짧은 문장/);
    assert.match(requestBody.instructions, /현재 보이는 문장/);
    assert.match(requestBody.instructions, /문단 밖/);
    assert.match(requestBody.instructions, /친절한 존댓말/);
    assert.match(requestBody.instructions, /반말을 쓰지 않는다/);
    assert.match(requestBody.instructions, /중심문장이라고 생각한 이유/);
    assert.match(requestBody.instructions, /문장을 중간에서 끊지 않는다/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_MODEL = originalModel;
  }
});

test("coach function does not run without an API key", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";

  try {
    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({}),
    });

    assert.equal(response.statusCode, 501);
  } finally {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});
