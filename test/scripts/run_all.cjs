/**
 * 一键接口测试：启动三端服务 → 等待就绪 → 执行测试 → 杀服务
 * 用法: node test/scripts/run_all.cjs [套件过滤词(如 10_admin / 20_user / 30_ai / 空=全部)]
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');

const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const LOG = ROOT + '/test/测试结果/logs';
const JC = 'C:/Users/LENOVO/.m2/repository/com/fasterxml/jackson/core';
const CP = `${JC}/jackson-databind/2.15.4/jackson-databind-2.15.4.jar;${JC}/jackson-core/2.15.4/jackson-core-2.15.4.jar;${JC}/jackson-annotations/2.15.4/jackson-annotations-2.15.4.jar`;
const suiteFilter = process.argv[2] || '';
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

const net = require('net');

function assertPortFree(port, label) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => {
      console.error(`[ERROR] 端口 ${port} 已被占用（${label}）。请先释放该端口再运行测试。`);
      process.exit(2);
    });
    srv.once('listening', () => srv.close(() => resolve()));
    srv.listen(port, '0.0.0.0');
  });
}

(async () => {
try {
  await assertPortFree(8101, 'AI 测试服务');
  await assertPortFree(8180, '用户端测试服务');
  await assertPortFree(8190, '管理端测试服务');
  console.log('=== 1. 启动 AI 服务 (8101, 独立测试端口, 沙箱 socketpair 补丁) ===');
  spawnSvc('ai-service', 'python', [ROOT + '/test/scripts/ai_launcher.py'],
    { cwd: ROOT + '/test/scripts', env: { ...process.env, SERVICE_PORT: '8101' } });

  console.log('=== 2. 启动管理端 (8190, 独立测试端口) ===');
  spawnSvc('backend-admin', 'java', ['-jar', 'hwc-app-admin-1.0.0.jar'],
    { cwd: ROOT + '/code/backend/hwc-app-admin/target', env: { ...process.env, MYSQL_ROOT_PASSWORD: 'root', SERVER_PORT_ADMIN: '8190', AI_SERVICE_BASE_URL: 'http://localhost:8101' } });

  console.log('=== 3. 启动用户端 (8180, 独立测试端口) ===');
  spawnSvc('backend-user', 'java', ['-jar', 'hwc-app-user-1.0.0.jar'],
    { cwd: ROOT + '/code/backend/hwc-app-user/target', env: { ...process.env, MYSQL_ROOT_PASSWORD: 'root', SERVER_PORT_USER: '8180', AI_SERVICE_BASE_URL: 'http://localhost:8101' } });

  console.log('=== 4. 等待三端就绪（最长 240s）===');
  execSync(`java -cp "test/scripts/classes" WaitReady "http://127.0.0.1:8101/health,http://127.0.0.1:8190/health,http://127.0.0.1:8180/health" 240000`,
    { cwd: ROOT, stdio: 'inherit', timeout: 250000 });

  console.log('=== 5. 执行接口测试 ===');
  const testCmd = `java -cp "test/scripts/classes;${CP}" RunApiTests "${ROOT}/test" ${suiteFilter}`.trim();
  execSync(testCmd, { cwd: ROOT, stdio: 'inherit', timeout: 30 * 60 * 1000 });

  console.log('=== 测试完成 ===');
} catch (e) {
  console.error('[FAILED]', e.status !== undefined ? `exit=${e.status}` : e.message);
  process.exitCode = 1;
} finally {
  killAll();
}
})();