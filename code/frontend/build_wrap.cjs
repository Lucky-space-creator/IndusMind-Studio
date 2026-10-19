// 临时构建包装脚本：用 execSync + cmd.exe 执行 pnpm 构建（避免 esbuild 在 git-bash 下假挂起）
const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname);
const target = process.argv[2] || 'admin';
const map = {
  admin: 'pnpm --filter @hwc/admin-web build',
  user: 'pnpm --filter @hwc/user-web build',
};
const cmd = map[target];
if (!cmd) {
  console.error('usage: node build_wrap.cjs admin|user');
  process.exit(1);
}
console.log('BUILD:', target, '=>', cmd);
try {
  const out = execSync(cmd, {
    encoding: 'utf8',
    timeout: 15 * 60 * 1000,
    shell: 'cmd.exe',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (out && out.trim()) console.log(out.trim());
  console.log('[OK]', target);
} catch (e) {
  console.log(e.stdout || '');
  console.log(e.stderr || e.message);
  process.exit(1);
}