/**
 * BOM 字节级核验：仅启动管理端(8190) → admin 登录 → 下载导出 CSV → 核验前三字节 EF BB BF → 留档 → 杀服务
 * 用法: node test/scripts/verify_export_bom.cjs
 * 产物: test/测试结果/audit-logs-export.csv + 控制台输出十六进制核验结论
 */
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const LOG = ROOT + '/test/测试结果/logs';
const OUT_CSV = ROOT + '/test/测试结果/audit-logs-export.csv';
const ADMIN = 'http://127.0.0.1:8190';
const procs = [];

fs.mkdirSync(LOG, { recursive: true });
fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });

function spawnSvc(name, cmd, args, opts) {
  const log = fs.openSync(`${LOG}/${name}.log`, 'w');
  const p = spawn(cmd, args, { ...opts, stdio: ['ignore', log, log] });
  procs.push({ name, p });
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

function reqJson(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(url, {
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(headers || {})
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
try {
  console.log('=== 1. 启动管理端 (8190) ===');
  spawnSvc('backend-admin', 'java', ['-jar', 'hwc-app-admin-1.0.0.jar'],
    { cwd: ROOT + '/code/backend/hwc-app-admin/target', env: { ...process.env, MYSQL_ROOT_PASSWORD: 'root', SERVER_PORT_ADMIN: '8190', AI_SERVICE_BASE_URL: 'http://localhost:8101' } });

  console.log('=== 2. 等待健康检查（最长 240s）===');
  for (let i = 0; i < 240; i++) {
    try {
      const r = await reqJson('GET', ADMIN + '/health');
      if (r.status === 200) { console.log(`就绪（${i}s）`); break; }
    } catch (e) { /* not yet */ }
    await sleep(1000);
    if (i === 239) throw new Error('管理端 240s 未就绪');
  }

  console.log('=== 3. admin 登录 ===');
  const login = await reqJson('POST', ADMIN + '/api/admin/auth/login', { username: 'admin', password: 'Admin@123' });
  const token = JSON.parse(login.buf.toString('utf8')).data.token;
  if (!token) throw new Error('登录失败拿不到 token');

  console.log('=== 4. 下载导出 CSV（范围 2026-10-01 ~ 2026-10-05 基础造数）===');
  const t0 = Date.now();
  const exp = await reqJson('GET', ADMIN + '/api/admin/audit/logs/export?beginTime=2026-10-01%2000%3A00%3A00&endTime=2026-10-05%2023%3A59%3A59', null, { Authorization: 'Bearer ' + token });
  const cost = Date.now() - t0;
  if (exp.status !== 200) throw new Error('导出 HTTP=' + exp.status + ' body=' + exp.buf.toString('utf8').slice(0, 200));
  fs.writeFileSync(OUT_CSV, exp.buf);
  console.log(`HTTP 200，耗时 ${cost}ms，文件 ${exp.buf.length} 字节 => ${OUT_CSV}`);
  console.log(`Content-Type: ${exp.headers['content-type']}`);
  console.log(`Content-Disposition: ${exp.headers['content-disposition']}`);

  console.log('=== 5. BOM 十六进制核验（前三字节）===');
  const head = exp.buf.subarray(0, 16);
  const hex = [...head].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  console.log(`前 16 字节 HEX: ${hex}`);
  const bomOk = exp.buf[0] === 0xEF && exp.buf[1] === 0xBB && exp.buf[2] === 0xBF;
  console.log(`BOM 核验: 前三字节 ${bomOk ? 'EF BB BF ✔ PASS' : '非 EF BB BF ✘ FAIL'}`);

  const text = exp.buf.toString('utf8');
  console.log('=== 6. 产物抽样核验 ===');
  console.log(`表头含 15 列: ${text.includes('id,operateTime,operatorId,operatorName,endpoint,module,action,targetType,targetId,result,errorMsg,ip,traceId,beforeValue,afterValue') ? 'PASS' : 'FAIL'}`);
  console.log(`转义字段: ${text.includes('"含,逗号""双引号\n换行内容"') ? 'PASS' : 'FAIL'}`);
  console.log(`首数据行为最新记录(id=22): ${text.includes('afterValue\n22,2026-10-05 23:59:59,') ? 'PASS' : 'FAIL'}`);
  const maxId = Math.max(...text.split('\n').slice(1).filter((l) => l && /^\d+,/.test(l)).map((l) => parseInt(l.split(',')[0], 10)));
  console.log(`产物内最大 id: ${maxId}（运行时 audit/export 记录 id 应大于该值）`);

  if (!bomOk) process.exitCode = 1;
} catch (e) {
  console.error('[FAILED]', e.message);
  process.exitCode = 1;
} finally {
  killAll();
}
})();