/* Keep startup payload growth visible in local checks and CI. Sizes are gzip
 * equivalents for comparison; the static server controls HTTP compression. */
const fs = require("node:fs");
const path = require("node:path");
const { gzipSync } = require("node:zlib");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../dist");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const references = [
  ...html.matchAll(/<(script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/g),
].filter(
  ([, tag, ref]) =>
    !ref.startsWith("data:") &&
    !/^https?:/.test(ref) &&
    /\.js$|\.css$/.test(ref),
);
let jsBytes = 0,
  cssBytes = 0,
  jsGzip = 0,
  cssGzip = 0;
for (const [markup, tag, ref] of references) {
  const file = path.resolve(root, ref.replace(/^\.\//, ""));
  if (!file.startsWith(root + path.sep))
    throw new Error(`Asset escapes dist: ${ref}`);
  const content = fs.readFileSync(file);
  const compressed = gzipSync(content).length;
  if (tag === "script") {
    jsBytes += content.length;
    jsGzip += compressed;
    if (!markup.includes('type="module"'))
      new vm.Script(content.toString(), { filename: ref });
  } else {
    cssBytes += content.length;
    cssGzip += compressed;
  }
}
if (!jsBytes || !cssBytes)
  throw new Error("Production entry point is missing script or CSS assets.");
const budgets = {
  js: 2 * 1024 * 1024,
  jsGzip: 600 * 1024,
  css: 220 * 1024,
  cssGzip: 50 * 1024,
};
for (const [label, actual, max] of [
  ["JavaScript", jsBytes, budgets.js],
  ["JavaScript gzip equivalent", jsGzip, budgets.jsGzip],
  ["CSS", cssBytes, budgets.css],
  ["CSS gzip equivalent", cssGzip, budgets.cssGzip],
]) {
  if (actual > max)
    throw new Error(
      `${label} budget exceeded: ${actual} > ${max} bytes. Investigate startup payload growth.`,
    );
  console.log(
    `${label}: ${(actual / 1024).toFixed(1)} KiB / ${(max / 1024).toFixed(0)} KiB budget`,
  );
}
