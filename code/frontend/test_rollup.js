const { execFile } = require("node:child_process");
const fs = require("node:fs");
const dir = "E:\\JavaPro\\HuaWeiCompetition\\code\\frontend\\node_modules\\.pnpm\\@rollup+rollup-win32-x64-msvc@4.64.7\\node_modules\\@rollup\\rollup-win32-x64-msvc";
console.log(fs.readdirSync(dir));
try {
  const rollup = require(dir + "\\rollup.win32-x64-msvc.node");
  console.log("rollup native loaded:", typeof rollup);
} catch (e) {
  console.log("rollup native load failed:", e.message);
}