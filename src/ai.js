// Netlify Function을 통해 서버 쪽 AI 코칭(Upstage 우선, OpenAI 폴백)을 요청하는 클라이언트 모듈
export async function requestAiCoach({
  paragraph,
  selectedIndex,
  reason,
  question,
  intent,
  history,
  turn,
  summary,
  nextParagraph,
  onChunk,
  streamDelayMs = 14,
}) {
  try {
    const response = await fetch("/.netlify/functions/coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(paragraph
          ? {
              paragraph: {
                label: paragraph.label,
                centerIndex: paragraph.centerIndex,
                sentences: paragraph.sentences.map((sentence) => sentence.text),
              },
            }
          : {}),
        selectedIndex,
        reason,
        question,
        intent,
        ...(Array.isArray(history) ? { history } : {}),
        ...(Number.isFinite(turn) ? { turn } : {}),
        ...(summary && typeof summary === "object" ? { summary } : {}),
        ...(nextParagraph && typeof nextParagraph === "object" ? { nextParagraph } : {}),
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const message = typeof data.message === "string" && data.message.trim() ? data.message.trim() : null;

    if (message) {
      await streamText(message, onChunk, streamDelayMs);
    }

    return message;
  } catch {
    return null;
  }
}

async function streamText(text, onChunk, delayMs) {
  if (typeof onChunk !== "function") {
    return;
  }

  for (const chunk of chunkText(text)) {
    onChunk(chunk);

    if (delayMs > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }
}

function chunkText(text) {
  const chars = Array.from(text);
  const chunks = [];

  for (let index = 0; index < chars.length; index += 5) {
    chunks.push(chars.slice(index, index + 5).join(""));
  }

  return chunks;
}
