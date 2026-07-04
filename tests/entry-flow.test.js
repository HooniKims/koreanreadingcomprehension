import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("entry button starts the lesson in the same page instead of submitting a new page", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(html, /<form id="entry-form" class="entry-form"[^>]*target="_self"/);
  assert.match(html, /id="start-lesson"[^>]*type="button"/);
  assert.doesNotMatch(html, /id="start-lesson"[^>]*type="submit"/);
  assert.match(appSource, /startButtonEl\.addEventListener\("click", handleEntry\)/);
  assert.match(appSource, /entryFormEl\.addEventListener\("submit"/);
  assert.match(appSource, /event\.preventDefault\(\)/);
});

test("entry screen uses the fixed presentation class code", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(html, /id="class-code"[^>]*value="KOR-01"/);
  assert.match(html, /id="class-code"[^>]*readonly/);
  assert.match(appSource, /const PRESENTATION_CLASS_CODE = "KOR-01"/);
  assert.match(appSource, /classCode: PRESENTATION_CLASS_CODE/);
});

test("lastpage path is wired as a Netlify demo shortcut to the final task", () => {
  const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const netlifyConfig = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
  const buildScript = readFileSync(new URL("../scripts/build-static.mjs", import.meta.url), "utf8");

  assert.match(appSource, /isLastPageDemoPath/);
  assert.match(appSource, /prepareLastPageDemoState/);
  assert.match(appSource, /window\.location\.pathname/);
  assert.match(netlifyConfig, /from = "\/lastpage"/);
  assert.match(netlifyConfig, /to = "\/index\.html"/);
  assert.match(netlifyConfig, /status = 200/);
  assert.match(buildScript, /lastpage/);
});
