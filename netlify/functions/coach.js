const DEFAULT_MODEL = "gpt-5.4-nano";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return jsonResponse(501, {
      error: "OPENAI_API_KEY is not configured.",
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const input = buildCoachInput(payload);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 240,
        instructions:
          "너는 중학교 국어 수업의 읽기 코치지만, 설명은 초등학생도 이해할 수 있을 만큼 쉽게 한다. 현재 보이는 문장 목록에 있는 내용만 근거로 답한다. 문단 밖 내용, 일반 지식, 문장 목록에 없는 정보는 답하지 않는다. 학생이 어려운 내용, 어휘, 문장의 의미를 물으면 현재 보이는 문장 안에서만 아주 쉬운 말로 풀이한다. 말투는 항상 친절한 존댓말로 통일하고 반말을 쓰지 않는다. 학생이 '중심문장이라고 생각한 이유'를 직접 쓰도록 돕는 힌트를 준다. 고른 문장이 문단 전체 내용과 어떻게 이어지는지 살피게 한다. 정답 문장 번호나 모범 이유를 바로 말하지 않는다. 학생을 비난하지 않는다. 쉬운 낱말과 짧은 문장으로 두세 문장 안의 힌트만 준다. 어려운 말은 쉬운 말로 바꿔 쓴다. 한 문장에는 생각을 하나만 담는다. 문장을 중간에서 끊지 않는다. 마지막 문장은 반드시 완성된 문장으로 끝낸다.",
        input,
      }),
    });

    if (!response.ok) {
      return jsonResponse(response.status, {
        error: "OpenAI request failed.",
      });
    }

    const data = await response.json();
    const message = extractOutputText(data);

    return jsonResponse(200, {
      message: message || "다시 생각해 볼까요? 이 문장이 문단 전체 내용을 가장 잘 담고 있는지 확인해 봅시다.",
      model,
    });
  } catch {
    return jsonResponse(502, {
      error: "AI coaching request failed.",
    });
  }
}

function buildCoachInput(payload) {
  const paragraph = payload.paragraph ?? {};
  const sentences = Array.isArray(paragraph.sentences) ? paragraph.sentences : [];
  const selectedIndex = Number(payload.selectedIndex);
  const purpose =
    payload.intent === "chat-question"
      ? "학생 질문에 대한 쉬운 코칭 답변"
      : "중심문장이라고 생각한 이유 쓰기 힌트";

  return [
    `요청 목적: ${purpose}`,
    "답변 범위: 현재 보이는 문장만 참고한다.",
    `문단: ${paragraph.label ?? "현재 문단"}`,
    "문장 목록:",
    ...sentences.map((sentence, index) => `${index + 1}. ${sentence}`),
    `학생이 고른 문장 번호: ${Number.isFinite(selectedIndex) ? selectedIndex + 1 : "없음"}`,
    `학생의 이유: ${payload.reason ?? ""}`,
    `학생 질문: ${payload.question ?? ""}`,
    "응답 조건: 정답 번호와 모범 이유를 말하지 말고, 이유 칸에 무엇을 생각해 보면 좋을지 초등학생도 이해할 수 있게 힌트 하나를 제시한다. 문장 목록 밖 질문이면 지금 보이는 문장 안에서 확인할 수 있는 내용으로만 안내한다.",
  ].join("\n");
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") {
    return data.output_text.trim();
  }

  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}
