import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("global footer shows legal links and contact in the middle area", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(html, /<footer class="site-footer"/);
  assert.match(html, /<nav class="footer-middle"/);
  assert.match(html, /href="\.\/terms\.html"/);
  assert.match(html, /href="\.\/privacy\.html"/);
  assert.match(html, /김형훈/);
  assert.match(html, /02-6380-8387\(교무실\)/);
  assert.match(styles, /\.site-footer\s*{/);
  assert.match(styles, /\.footer-middle\s*{/);
});

test("terms and privacy pages exist with the shared footer", () => {
  const termsUrl = new URL("../terms.html", import.meta.url);
  const privacyUrl = new URL("../privacy.html", import.meta.url);

  assert.equal(existsSync(termsUrl), true);
  assert.equal(existsSync(privacyUrl), true);

  const terms = readFileSync(termsUrl, "utf8");
  const privacy = readFileSync(privacyUrl, "utf8");

  assert.match(terms, /이용약관/);
  assert.match(terms, /학습 목적/);
  assert.match(terms, /김형훈/);
  assert.match(terms, /02-6380-8387\(교무실\)/);
  assert.match(privacy, /개인정보처리방침/);
  assert.match(privacy, /임시 닉네임/);
  assert.match(privacy, /OPENAI_API_KEY/);
  assert.match(privacy, /김형훈/);
  assert.match(privacy, /02-6380-8387\(교무실\)/);
});

test("static build copies legal pages for Netlify deployment", () => {
  const buildScript = readFileSync(new URL("../scripts/build-static.mjs", import.meta.url), "utf8");

  assert.match(buildScript, /terms\.html/);
  assert.match(buildScript, /privacy\.html/);
});
