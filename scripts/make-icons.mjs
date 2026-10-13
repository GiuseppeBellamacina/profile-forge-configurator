// Renders public/favicon.svg to the PNG sizes browsers and phones ask for (needs profile-forge's optional @resvg/resvg-js).
//   CORE_DIR=../profile-forge node scripts/make-icons.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const core = resolve(process.env.CORE_DIR ?? "../profile-forge");
const { Resvg } = createRequire(core + "/package.json")("@resvg/resvg-js");
const svg = readFileSync("public/favicon.svg");
for (const [file, size] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-512.png", 512]]) {
  writeFileSync(`public/${file}`, new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
  console.log("wrote", file);
}
