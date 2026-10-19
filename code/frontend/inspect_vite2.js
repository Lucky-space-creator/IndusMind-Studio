const fs = require("node:fs");
const src = fs.readFileSync(
  "E:\\JavaPro\\HuaWeiCompetition\\code\\frontend\\node_modules\\.pnpm\\vite@5.4.21\\node_modules\\vite\\dist\\node\\chunks\\dep-BK3b2jBa.js",
  "utf8"
);
const needle = "esbuildPlugin(config)";
let idx = -1;
while ((idx = src.indexOf(needle, idx + 1)) >= 0) {
  console.log("=== at", idx);
  console.log(src.slice(Math.max(0, idx - 260), idx + 120));
  console.log();
}