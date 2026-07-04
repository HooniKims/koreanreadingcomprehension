import { cp, mkdir, rm } from "node:fs/promises";

const outputDirectory = "dist";
const staticEntries = [
  "index.html",
  "terms.html",
  "privacy.html",
  "styles.css",
  "assets",
  "Paperlogy",
  "src",
];

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all(
  staticEntries.map((entry) =>
    cp(entry, `${outputDirectory}/${entry}`, {
      force: true,
      recursive: true,
    }),
  ),
);

await mkdir(`${outputDirectory}/lastpage`, { recursive: true });
await cp("index.html", `${outputDirectory}/lastpage/index.html`, { force: true });
