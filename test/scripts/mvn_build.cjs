/**
 * Maven 打包包装（git-bash 直接执行 mvn 存在假挂起风险，统一经本脚本调用）。
 * 用法: node test/scripts/mvn_build.cjs [附加 mvn 参数，如 "-pl hwc-security -am"]
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOG_DIR = path.join(ROOT, 'test', '测试结果', 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
const logPath = path.join(LOG_DIR, 'mvn-build.log');

const extra = process.argv.slice(2).join(' ');
const cmd = `mvn -B -DskipTests package ${extra}`.trim();

const fd = fs.openSync(logPath, 'w');
console.log(`[mvn] ${cmd}`);
console.log(`[mvn] log => ${logPath}`);

let code = 0;
try {
  execSync(cmd, {
    cwd: path.join(ROOT, 'code', 'backend'),
    stdio: ['ignore', fd, fd],
    shell: 'cmd.exe',
    timeout: 30 * 60 * 1000,
  });
} catch (e) {
  code = e.status === undefined ? 1 : e.status;
}
fs.closeSync(fd);

const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
const summary = lines.filter(l => /BUILD|ERROR|SUCCESS|FAILURE|Reactor Summary|Total time/.test(l)).slice(-30).join('\n');
console.log(summary);
console.log(code === 0 ? 'BUILD_OK' : `BUILD_FAILED exit=${code}`);
process.exit(code);