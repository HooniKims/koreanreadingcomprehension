// AI 코칭 응답에 필요한 최소 Markdown만 안전하게 HTML로 바꾸는 모듈
export function renderCoachMarkdown(markdownText) {
  const lines = String(markdownText ?? "").replace(/\r\n?/g, "\n").split("\n");
  const parts = [];
  let listType = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeList();
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)/);
    const orderedMatch = line.match(/^\d+[.)]\s+(.+)/);

    if (unorderedMatch) {
      openList("ul");
      parts.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    if (orderedMatch) {
      openList("ol");
      parts.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    closeList();
    parts.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  closeList();
  return parts.join("");

  function openList(nextType) {
    if (listType === nextType) {
      return;
    }

    closeList();
    listType = nextType;
    parts.push(`<${nextType}>`);
  }

  function closeList() {
    if (!listType) {
      return;
    }

    parts.push(`</${listType}>`);
    listType = null;
  }
}

function renderInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
