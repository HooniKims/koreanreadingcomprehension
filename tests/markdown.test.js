import test from "node:test";
import assert from "node:assert/strict";
import { renderCoachMarkdown } from "../src/markdown.js";

test("coach markdown renders bold text and bullet lists", () => {
  const html = renderCoachMarkdown("**생각해 볼 점**\n- 문단 전체 내용과 연결해 보세요.\n- 다른 문장이 설명하는지 보세요.");

  assert.match(html, /<strong>생각해 볼 점<\/strong>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<li>문단 전체 내용과 연결해 보세요\.<\/li>/);
  assert.doesNotMatch(html, /\*\*/);
  assert.doesNotMatch(html, /^-/m);
});

test("coach markdown escapes raw html before rendering", () => {
  const html = renderCoachMarkdown("**힌트** <script>alert('x')</script>");

  assert.match(html, /<strong>힌트<\/strong>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
