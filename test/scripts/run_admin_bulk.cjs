/**
 * 审计导出上限专项测试：仅启动管理端(8190) → 等就绪 → 跑 11_audit 套件 → 杀服务
 * 用法: node test/scripts/run_admin_bulk.cjs   （前置：先执行 seed_audit_bulk.sql）
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const LOG = ROOT + '/test/测试结果/logs';
const JC = 'C:/Users/LENOVO/.m2/repository/com/fasterxml/jackson/core';
const CP = `${JC}/jackson-databind/2.15.4/jackson-databind-2.15.4.jar;${JC}/jackson-core/2.15.4/jackson-core-2.15.4.jar;${JC}/jackson-annotations/2.15.4/jackson-annotations-2.15.4.jar`;
const procs = [];

fs.mkdirSync(LOG, { recursive: true });

function spawnSvc(name, cmd, args, opts) {
  const log = fs.openSync(`${LOG}/${name}.log`, 'w');
  const p = spawn(cmd, args, { ...opts, stdio: ['ignore', log, log] });
  procs.push({ name, p });
  p.on('exit', (code) => console.log(`[exit] ${name} code=${code}`));
  console.log(`[spawn] ${name} pid=${p.pid}`);
  return p;
}

function killAll() {
  for (const { name, p } of procs) {
    try { execSync(`taskkill /F /T /PID ${p.pid}`, { shell: 'cmd.exe' }); console.log(`[kill] ${name}`); }
    catch (e) { /* already exited */ }
  }
}

process.on('exit', killAll);
process.on('SIGINT', () => { killAll(); process.exit(130); });

(async () => {
try {
  console.log('=== 1. 启动管理端 (8190) ===');
  spawnSvc('backend-admin', 'java', ['-jar', 'hwc-app-admin-1.0.0.jar'],
    { cwd: ROOT + '/code/backend/hwc-app-admin/target', env: { ...process.env, MYSQL_ROOT_PASSWORD: 'root', SERVER_PORT_ADMIN: '8190', AI_SERVICE_BASE_URL: 'http://localhost:8101' } });

  console.log('=== 2. 等待就绪（最长 240s）===');
  execSync(`java -cp "test/scripts/classes" WaitReady "http://127.0.0.1:8190/health" 240000`,
    { cwd: ROOT, stdio: 'inherit', timeout: 250000 });

  console.log('=== 3. 执行审计导出上限专项测试 ===');
  // _11_audit_bulk_cases.json 以下划线开头避免全量回归误执行；专项执行时复制为不带下划线的副本
  const srcCase = ROOT + '/test/scripts/testcases/_11_audit_bulk_cases.json';
  const dstCase = ROOT + '/test/scripts/testcases/11_audit_bulk_cases.json';
  fs.copyFileSync(srcCase, dstCase);
  let testExit = 0;
  try {
    const testCmd = `java -cp "test/scripts/classes;${CP}" RunApiTests "${ROOT}/test" 11_audit`;
    execSync(testCmd, { cwd: ROOT, stdio: 'inherit', timeout: 30 * 60 * 1000 });
  } catch (e) {
    testExit = e.status !== undefined ? e.status : 1;
    process.exitCode = 1;
  } finally {
    try { fs.unlinkSync(dstCase); } catch (e) { /* ignore */ }
  }

  console.log('=== 测试完成 ===');
} catch (e) {
  console.error('[FAILED]', e.status !== undefined ? `exit=${e.status}` : e.message);
  process.exitCode = 1;
} finally {
  killAll();
}
})();