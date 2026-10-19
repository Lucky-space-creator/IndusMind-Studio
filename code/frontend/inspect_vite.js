const fs = require("node:fs");
const src = fs.readFileSync(
  "E:\\JavaPro\\HuaWeiCompetition\\code\\frontend\\node_modules\\.pnpm\\vite@5.4.21\\node_modules\\vite\\dist\\node\\chunks\\dep-BK3b2jBa.js",
  "utf8"
);
for (const needle of ["esbuildPlugin(config)", "function esbuildPlugin", "config.esbuild === false", "esbuild === false"]) {
  const i = src.indexOf(needle);
  console.log("=== needle:", needle, "at", i);
  if (i >= 0) console.log(src.slice(Math.max(0, i - 300), i + 500));
}