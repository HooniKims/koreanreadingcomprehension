const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";
const DEFAULT_UPSTAGE_MODEL = "solar-pro3";
const UPSTAGE_CHAT_URL = "https://api.upstage.ai/v1/chat/completions";
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_MESSAGE_LENGTH = 1000;

const NATURAL_KOREAN_RULES =
  "자연스러운 한국어 규칙: 실제 선생님이 옆에서 말하듯 자연스러운 구어체 존댓말로 쓴다. 번역투를 쓰지 않는다. '~에 대해', '~를 통해', '~에 있어', '가지고 있다', '~되어진다' 대신 '~를', '~로', '~가 있다', '~된다'처럼 쓴다. '결론적으로', '본질적으로', '주목할 만하다' 같은 상투적 표현과 과장된 수식어를 쓰지 않는다. 이모지, 불릿, 번호 목록, 굵은 글씨, 따옴표 강조 같은 장식을 쓰지 않는다. 읽기 쉽게 문장이 끝날 때마다 줄을 바꿔서 한 줄에 한 문장씩 쓴다. " +
  "난이도 규칙: 실제 수업은 중학교 1학년이지만, 설명은 초등학교 4~5학년 학생이 한 번 읽고 바로 이해할 수 있는 수준으로 한다. 어려운 한자어, 교과서 용어, 추상적인 말은 그대로 쓰지 않는다. 쉬운 말로 바꾸거나, 꼭 써야 하면 바로 뒤에 아주 쉬운 풀이를 덧붙인다. 한 문장은 15어절을 넘지 않게 짧게 쓴다. 설명이 어려워지면 학생이 일상에서 겪는 일에 빗대어 다시 말해 준다.";

const BASE_INSTRUCTIONS =
  "너는 중학교 국어 수업의 읽기 코치지만, 설명은 초등학교 4~5학년 학생도 이해할 수 있을 만큼 쉽게 한다. 현재 보이는 문장 목록에 있는 내용만 근거로 답한다. 문단 밖 내용, 일반 지식, 문장 목록에 없는 정보는 답하지 않는다. 학생이 어려운 내용, 어휘, 문장의 의미를 물으면 현재 보이는 문장 안에서만 아주 쉬운 말로 풀이한다. 말투는 항상 친절한 존댓말로 통일하고 반말을 쓰지 않는다. 학생이 '중심문장이라고 생각한 이유'를 직접 쓰도록 돕는 힌트를 준다. 고른 문장이 문단 전체 내용과 어떻게 이어지는지 살피게 한다. 정답 문장 번호나 모범 이유를 바로 말하지 않는다. 학생을 비난하지 않는다. 쉬운 낱말과 짧은 문장으로 두세 문장 안의 힌트만 준다. 어려운 말은 쉬운 말로 바꿔 쓴다. 한 문장에는 생각을 하나만 담는다. 문장을 중간에서 끊지 않는다. 마지막 문장은 반드시 완성된 문장으로 끝낸다. " +
  NATURAL_KOREAN_RULES;

const SUMMARY_SOCRATIC_INSTRUCTIONS =
  "너는 중학교 국어 수업의 읽기 코치지만, 설명은 초등학교 4~5학년 학생도 이해할 수 있을 만큼 쉽게 한다. 학생이 문단별 요약을 이어서 글 전체 요약을 스스로 쓰도록 질문으로 이끈다. 요약문을 대신 써 주지 않는다. 모범 요약의 문장이나 표현을 그대로 말하지 않는다. '정답이에요', '틀렸어요' 같은 직접 판정도 하지 않는다. 한 번에 유도 질문 하나만 한다. 처음에는 글 전체가 무엇을 말하는지 묻고, 다음에는 문단 요약들이 어떤 순서와 흐름으로 이어지는지 묻고, 그다음에는 학생의 요약 초안에서 빠진 문단이나 어색하게 이어지는 부분을 스스로 찾게 묻는다. 같은 질문을 반복하지 않는다. 이미 학생이 답한 내용은 다시 묻지 않고 그다음 단계로 넘어간다. 학생의 요약 초안이 글의 큰 흐름(유전 공학의 편리함과 걱정, 그리고 신중함)을 이미 담고 있으면, 더 캐묻지 말고 무엇을 잘했는지 짚어 따뜻하게 칭찬한 뒤 그대로 다듬어 제출하라고 안내한다. 문단 요약 목록과 학생의 초안에 있는 내용만 근거로 답한다. 말투는 항상 친절한 존댓말로 통일하고 반말을 쓰지 않는다. 학생을 비난하지 않는다. 쉬운 낱말과 짧은 문장으로 세 문장 이내로 답한다. 마지막 문장은 반드시 완성된 문장으로 끝낸다. " +
  NATURAL_KOREAN_RULES;

const SOCRATIC_INSTRUCTIONS =
  "너는 중학교 국어 수업의 읽기 코치지만, 설명은 초등학교 4~5학년 학생도 이해할 수 있을 만큼 쉽게 한다. 학생이 문단의 중심문장을 스스로 찾도록 질문으로 이끈다. 답을 알려 주는 대신 생각을 좁혀 주는 유도 질문을 한다. 정답 문장 번호, 모범 이유, '정답이에요', '틀렸어요' 같은 직접 판정은 절대 말하지 않는다. 한 번에 유도 질문 하나만 한다. 대화가 이어질수록 질문을 점점 구체적으로 한다. 처음에는 문단 전체가 무엇을 말하는지 묻고, 다음에는 반복해서 나오는 낱말이나 문장들 사이의 관계를 묻고, 그다음에는 고른 문장과 다른 문장을 비교하거나 그 문장을 빼면 문단이 어떻게 되는지 묻는다. 다음 문단 미리 보기가 주어지면 현재 문단의 어떤 문장을 다음 문단이 이어받아 설명하는지 살피게 하는 질문도 할 수 있다. 학생이 정답 중심문장을 골랐고 이유도 타당하면 따뜻하게 칭찬하고, 그 생각을 '중심문장이라고 생각한 이유' 칸에 정리해 적도록 안내한다. 현재 보이는 문장 목록에 있는 내용만 근거로 답한다. 말투는 항상 친절한 존댓말로 통일하고 반말을 쓰지 않는다. 학생을 비난하지 않는다. 쉬운 낱말과 짧은 문장으로 세 문장 이내로 답한다. 마지막 문장은 반드시 완성된 문장으로 끝낸다. " +
  NATURAL_KOREAN_RULES;

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const upstageApiKey = process.env.UPSTAGE_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (!upstageApiKey && !openAiApiKey) {
    return jsonResponse(501, {
      error: "UPSTAGE_API_KEY or OPENAI_API_KEY is not configured.",
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const instructions =
    payload.intent === "socratic"
      ? SOCRATIC_INSTRUCTIONS
      : payload.intent === "summary-socratic"
        ? SUMMARY_SOCRATIC_INSTRUCTIONS
        : BASE_INSTRUCTIONS;
  const isDialogue = payload.intent === "socratic" || payload.intent === "summary-socratic";
  const input = buildCoachInput(payload);
  const history = isDialogue ? sanitizeHistory(payload.history) : [];

  if (upstageApiKey) {
    const upstageResult = await requestUpstage({
      apiKey: upstageApiKey,
      instructions,
      input,
      history,
    });

    if (upstageResult) {
      return jsonResponse(200, upstageResult);
    }
  }

  if (openAiApiKey) {
    const openAiResult = await requestOpenAi({
      apiKey: openAiApiKey,
      instructions,
      input: appendHistoryText(input, history),
    });

    if (openAiResult) {
      return jsonResponse(200, openAiResult);
    }
  }

  return jsonResponse(502, {
    error: "AI coaching request failed.",
  });
}

async function requestUpstage({ apiKey, instructions, input, history }) {
  const model = process.env.UPSTAGE_MODEL || DEFAULT_UPSTAGE_MODEL;
  const messages = [
    { role: "system", content: instructions },
    { role: "user", content: input },
    ...history,
  ];

  try {
    const response = await fetch(UPSTAGE_CHAT_URL, {
      method: "POST",
      signal: AbortSignal.timeout(9000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = stripThinking(data.choices?.[0]?.message?.content ?? "").trim();

    if (!content) {
      return null;
    }

    return { message: formatSentencesPerLine(content), model };
  } catch {
    return null;
  }
}

async function requestOpenAi({ apiKey, instructions, input }) {
  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

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
        instructions,
        input,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const message = extractOutputText(data);

    return {
      message: formatSentencesPerLine(
        message || "다시 생각해 볼까요?\n이 문장이 문단 전체 내용을 가장 잘 담고 있는지 확인해 봅시다.",
      ),
      model,
    };
  } catch {
    return null;
  }
}

function buildCoachInput(payload) {
  const paragraph = payload.paragraph ?? {};
  const sentences = Array.isArray(paragraph.sentences) ? paragraph.sentences : [];
  const selectedIndex = Number(payload.selectedIndex);
  const centerIndex = Number(paragraph.centerIndex);

  if (payload.intent === "summary-socratic") {
    const summary = payload.summary ?? {};
    const paragraphSummaries = Array.isArray(summary.paragraphSummaries)
      ? summary.paragraphSummaries
      : [];

    return [
      "요청 목적: 학생이 문단 요약을 이어 전체 요약을 스스로 쓰도록 돕는 유도 질문 만들기",
      "답변 범위: 아래 문단 요약 목록과 학생의 초안만 참고한다.",
      "문단 요약 목록(글의 순서대로):",
      ...paragraphSummaries.map(
        (item, index) => `${index + 1}. ${item?.label ?? `${index + 1}문단`}: ${item?.text ?? ""}`,
      ),
      `모범 전체 요약(코치만 아는 비공개 정보이며 문장이나 표현을 학생에게 그대로 말하지 않는다): ${
        summary.modelOverallSummary ?? "없음"
      }`,
      `학생이 지금까지 쓴 요약 초안: ${summary.studentDraft?.trim() ? summary.studentDraft.trim() : "아직 쓰지 않음"}`,
      `지금까지 학생이 답한 횟수: ${Number.isFinite(Number(payload.turn)) ? Number(payload.turn) : 0}`,
      "응답 조건: 이어지는 대화를 읽고 학생의 마지막 답을 짚어 준 뒤, 요약을 발전시키는 유도 질문 하나로 끝낸다. 답한 횟수가 많을수록 더 구체적인 질문을 한다. 요약문을 대신 써 주지 않고 모범 요약도 말하지 않는다. 초등학교 4~5학년 학생도 이해할 수 있게 쉬운 말로 쓴다.",
    ].join("\n");
  }

  if (payload.intent === "socratic") {
    return [
      "요청 목적: 학생이 중심문장을 스스로 찾도록 돕는 유도 질문 만들기",
      "답변 범위: 현재 보이는 문장만 참고한다.",
      `문단: ${paragraph.label ?? "현재 문단"}`,
      "문장 목록:",
      ...sentences.map((sentence, index) => `${index + 1}. ${sentence}`),
      ...(typeof payload.nextParagraph?.text === "string" && payload.nextParagraph.text.trim()
        ? [
            `다음 문단 미리 보기(학생 화면에도 참고용으로 보인다. 현재 문단과 어떻게 이어지는지 살피게 할 때 활용한다): ${payload.nextParagraph.label ?? "다음 문단"} - ${payload.nextParagraph.text.trim()}`,
          ]
        : []),
      `중심문장 번호(코치만 아는 비공개 정보이며 학생에게 절대 직접 말하지 않는다): ${
        Number.isFinite(centerIndex) ? centerIndex + 1 : "없음"
      }`,
      `학생이 지금 고른 문장 번호: ${Number.isFinite(selectedIndex) ? selectedIndex + 1 : "없음"}`,
      `지금까지 학생이 답한 횟수: ${Number.isFinite(Number(payload.turn)) ? Number(payload.turn) : 0}`,
      "응답 조건: 이어지는 대화를 읽고 학생의 마지막 답을 짚어 준 뒤, 생각을 좁혀 주는 유도 질문 하나로 끝낸다. 답한 횟수가 많을수록 더 구체적인 질문을 한다. 정답 번호와 모범 이유는 직접 말하지 않는다. 초등학교 4~5학년 학생도 이해할 수 있게 쉬운 말로 쓴다.",
    ].join("\n");
  }

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
    "응답 조건: 정답 번호와 모범 이유를 말하지 말고, 이유 칸에 무엇을 생각해 보면 좋을지 초등학교 4~5학년 학생도 이해할 수 있게 힌트 하나를 제시한다. 문장 목록 밖 질문이면 지금 보이는 문장 안에서 확인할 수 있는 내용으로만 안내한다.",
  ].join("\n");
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((entry) => entry && typeof entry.content === "string" && entry.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((entry) => ({
      role: entry.role === "user" ? "user" : "assistant",
      content: entry.content.trim().slice(0, MAX_HISTORY_MESSAGE_LENGTH),
    }));
}

function appendHistoryText(input, history) {
  if (history.length === 0) {
    return input;
  }

  return [
    input,
    "지금까지의 대화:",
    ...history.map(
      (entry) => `${entry.role === "user" ? "학생" : "코치"}: ${entry.content}`,
    ),
  ].join("\n");
}

function stripThinking(text) {
  return String(text ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
}

// 모델이 줄바꿈 지시를 지키지 않아도 문장 단위 줄바꿈을 보장한다.
// 공백이 뒤따르는 문장 끝(닫는 따옴표·괄호 포함)에서만 줄을 나눠
// 소수점(4.5)이나 줄임말 안의 마침표는 건드리지 않는다.
function formatSentencesPerLine(text) {
  return String(text ?? "")
    .split("\n")
    .map((line) => line.replace(/([.!?…])(['"’”」』)\]]*)[ \t]+/g, "$1$2\n"))
    .join("\n");
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
