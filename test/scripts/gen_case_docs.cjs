const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CASE_DIR = path.join(ROOT, 'scripts', 'testcases');
const OUT_DIR = path.join(ROOT, '测试用例');

const GROUP_NAMES = {
  'A-AUTH': '认证登录', 'A-HEA': '健康检查', 'A-DEV': '设备管理', 'A-TYPE': '设备类型与型号',
  'A-MET': '指标阈值与告警规则', 'A-SPR': '备件管理', 'A-DTC': '停机损失标准', 'A-DS': '数据集管理',
  'A-KB': '知识库管理', 'A-GR': '知识图谱管理', 'A-AG': 'Agent 管理', 'A-PUB': '开放 API 发布',
  'A-RUN': '诊断运行管理', 'A-WO': '工单管理', 'A-PERF': '性能测试',
  'U-AUTH': '认证登录', 'U-DASH': '运维看板', 'U-DEV': '设备查询', 'U-KB': '知识检索',
  'U-GRAPH': '溯源图查询', 'U-CHAT': '智能问答', 'U-DIAG': '智能诊断', 'U-WO': '工单中心', 'U-PERF': '性能测试',
  'A-HEALTH': '健康检查', 'A-RAG': 'RAG 检索', 'A-GRAPH': '图谱接口', 'A-CHAT': '问答接口',
  'A-DIAG': '诊断接口',
};

const CATEGORY_LABEL = {
  NORMAL: '常规', BOUNDARY: '边界', EXCEPTION: '异常', PERF: '性能',
};

const FILES = [
  { json: '10_admin_api_cases.json', out: '管理端接口测试用例.md', title: '管理端接口测试用例', service: 'hwc-app-admin（Spring Boot，测试端口 http://127.0.0.1:8190）' },
  { json: '20_user_api_cases.json', out: '用户端接口测试用例.md', title: '用户端接口测试用例', service: 'hwc-app-user（Spring Boot，测试端口 http://127.0.0.1:8180）' },
  { json: '30_ai_service_cases.json', out: 'AI服务端接口测试用例.md', title: 'AI 服务端接口测试用例', service: 'ai-service（FastAPI，测试端口 http://127.0.0.1:8101）' },
];

function fmtExpect(c) {
  if (!c.expectHttp && !c.expectCode) return '—';
  let s = c.expectHttp === -1 ? 'HTTP任意' : `HTTP ${c.expectHttp}`;
  if (c.expectCode !== undefined && c.expectCode !== -999) s += ` / code=${c.expectCode}`;
  if (c.expectErrorCode) s += ` / ${c.expectErrorCode}`;
  return s;
}

function buildDoc(cfg, data) {
  const cats = { NORMAL: 0, BOUNDARY: 0, EXCEPTION: 0, PERF: 0 };
  data.cases.forEach(c => { if (cats[c.category] !== undefined) cats[c.category]++; });
  const skipCount = data.cases.filter(c => c.skip).length;

  const groups = [];
  const gmap = new Map();
  data.cases.forEach(c => {
    const p = c.id.split('-').slice(0, 2).join('-');
    if (!gmap.has(p)) { gmap.set(p, []); groups.push(p); }
    gmap.get(p).push(c);
  });

  let md = `# ${cfg.title}\n\n`;
  md += `- **被测服务**：${cfg.service}\n`;
  md += `- **用例文件**：\`test/scripts/testcases/${cfg.json}\`\n`;
  md += `- **用例总数**：${data.cases.length} 条（常规 ${cats.NORMAL} / 边界 ${cats.BOUNDARY} / 异常 ${cats.EXCEPTION} / 性能 ${cats.PERF}）\n`;
  if (skipCount) md += `- **跳过用例**：${skipCount} 条（被已知产品缺陷连锁阻塞，执行时自动跳过）\n`;
  md += `\n## 分类覆盖说明\n\n`;
  md += `| 分类 | 说明 | 覆盖策略 |\n|---|---|---|\n`;
  md += `| 常规（NORMAL） | 正常业务路径 | 使用合法参数与有效认证账号，验证核心功能的正确性与响应结构 |\n`;
  md += `| 边界（BOUNDARY） | 边界条件 | 空列表/空表初始态、删除后状态、非法枚举、缺失可选字段、超长/特殊输入等 |\n`;
  md += `| 异常（EXCEPTION） | 异常与否定场景 | 未认证/伪造 Token、越权访问（角色权限矩阵）、资源不存在、参数冲突、重复创建、服务依赖不可用等 |\n`;
  md += `| 性能（PERF） | 性能采样 | 多次请求 + 并发采样，统计平均/P95/最大时延并断言阈值 |\n\n`;
  md += `> 用例名称中标注"缺陷"的条目，其期望值按**当前实际行为**（缺陷表现）设定，缺陷清单详见《接口测试报告》附录 B；标注"环境依赖"的条目为沙箱环境（MinIO 不可用、AI 桩服务）下的实际行为。\n\n`;

  groups.forEach(g => {
    md += `## ${GROUP_NAMES[g] || g}（${g}）\n\n`;
    md += `| 用例 ID | 类别 | 用例名称（含期望说明） | 方法 | 路径 | 期望结果 |\n|---|---|---|---|---|---|\n`;
    gmap.get(g).forEach(c => {
      const name = c.name + (c.skip ? '【跳过：被缺陷阻塞】' : '');
      const api = (c.method || 'GET') + ' `' + c.path + '`';
      md += `| ${c.id} | ${CATEGORY_LABEL[c.category] || c.category} | ${name} | ${c.method || 'GET'} | \`${c.path}\` | ${fmtExpect(c)} |\n`;
    });
    md += `\n`;
  });

  return md.replace(/\n+$/, '\n');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
FILES.forEach(cfg => {
  const data = JSON.parse(fs.readFileSync(path.join(CASE_DIR, cfg.json), 'utf8'));
  fs.writeFileSync(path.join(OUT_DIR, cfg.out), buildDoc(cfg, data), 'utf8');
  console.log(`[gen] ${cfg.out} => ${data.cases.length} 条`);
});
console.log('DONE');