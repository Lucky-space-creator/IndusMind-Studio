const { execSync } = require('child_process');
const path = require('path');

const target = process.argv[2] || 'RunApiTests';
const root = 'E:/JavaPro/HuaWeiCompetition';
const file = path.join(root, 'test/scripts', target + '.java');

const needsJackson = ['RunApiTests', 'RunApiTests$Resp'].some((n) => target.startsWith(n.replace('$Resp', '')));
const JC = 'C:/Users/LENOVO/.m2/repository/com/fasterxml/jackson/core';
const jacksonCp = [
  `${JC}/jackson-databind/2.15.4/jackson-databind-2.15.4.jar`,
  `${JC}/jackson-core/2.15.4/jackson-core-2.15.4.jar`,
  `${JC}/jackson-annotations/2.15.4/jackson-annotations-2.15.4.jar`,
].join(';');

const cp = needsJackson ? `"${jacksonCp}"` : '';
const cmd = `javac -encoding UTF-8 ${cp ? '-cp ' + cp + ' ' : ''}"${file}" -d "${path.join(root, 'test/scripts/classes')}"`;
console.log('COMPILE:', target);
try {
  const out = execSync(cmd + ' 2>&1', { encoding: 'utf8', timeout: 15 * 60 * 1000, shell: 'cmd.exe' });
  if (out && out.trim()) console.log(out.trim());
  console.log('[OK]', target);
} catch (e) {
  console.log(e.stdout || '');
  console.log(e.stderr || e.message);
  process.exit(1);
}