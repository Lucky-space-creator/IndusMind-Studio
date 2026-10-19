import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.File;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 统一接口测试执行器：读取 testcases/*.json 用例，逐条执行并输出 Markdown 报告。
 * 用法: java -cp "<classes>;<jackson三件套>" RunApiTests <测试根目录> [套件过滤]
 */
public class RunApiTests {

    static final ObjectMapper MAPPER = new ObjectMapper();
    static final HttpClient HTTP = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    static final Map<String, String> VARS = new HashMap<>();
    static final List<String[]> PERF_SUMMARY = new ArrayList<>();

    static {
        VARS.put("TS", String.valueOf(System.currentTimeMillis()));
    }

    public static void main(String[] args) throws Exception {
        String baseDir = args.length > 0 ? args[0] : "E:/JavaPro/HuaWeiCompetition/test";
        String suiteFilter = args.length > 1 ? args[1] : "";

        File caseDir = new File(baseDir, "scripts/testcases");
        File[] files = caseDir.listFiles((d, n) -> n.endsWith(".json"));
        if (files == null || files.length == 0) { System.out.println("NO_CASE_FILES at " + caseDir); return; }
        java.util.Arrays.sort(files);

        StringBuilder report = new StringBuilder();
        report.append("# 接口测试报告\n\n")
              .append("- 执行时间：").append(java.time.LocalDateTime.now()).append("\n")
              .append("- 执行环境：本机（hwc-app-user:8080 / hwc-app-admin:8090 / ai-service:8100）\n\n");

        int totalPass = 0, totalFail = 0, totalSkip = 0;
        List<String> failLines = new ArrayList<>();

        for (File f : files) {
            String fname = f.getName();
            if (fname.startsWith("_")) continue;
            JsonNode root = MAPPER.readTree(f);
            String suiteName = root.path("suite").asText(fname);
            if (!suiteFilter.isEmpty() && !fname.contains(suiteFilter)) continue;
            String baseUrl = root.path("baseUrl").asText("http://127.0.0.1:8080");

            report.append("## ").append(suiteName).append("\n\n");
            report.append("| 用例 | 类别 | 结果 | 耗时 | 说明 |\n|---|---|---|---|---|\n");

            int pass = 0, fail = 0, skip = 0;
            for (JsonNode c : root.path("cases")) {
                if (c.path("skip").asBoolean(false)) {
                    skip++;
                    report.append("| ").append(c.path("id").asText()).append(" | ")
                          .append(c.path("category").asText()).append(" | ⏭跳过 | - | ")
                          .append(c.path("name").asText()).append(" |\n");
                    continue;
                }
                Result r = runCase(baseUrl, c);
                if (r.pass) pass++; else fail++;
                if (!r.pass) failLines.add(fname.replace(".json","") + " | " + c.path("id").asText() + " | " + r.detail);
                report.append("| ").append(c.path("id").asText()).append(" | ")
                      .append(c.path("category").asText()).append(" | ")
                      .append(r.pass ? "✅通过" : "❌失败").append(" | ")
                      .append(r.ms).append("ms | ")
                      .append(escapeCell(r.pass ? c.path("name").asText() : r.detail)).append(" |\n");
            }
            totalPass += pass; totalFail += fail; totalSkip += skip;
            report.append("\n小计：通过 ").append(pass).append("，失败 ").append(fail)
                  .append("，跳过 ").append(skip).append("\n\n");
            System.out.println("[SUITE] " + suiteName + " => pass=" + pass + " fail=" + fail + " skip=" + skip);
        }

        report.append("## 性能测试汇总\n\n| 用例 | 请求次数 | 并发 | 平均(ms) | P95(ms) | 最大(ms) | 阈值断言 |\n|---|---|---|---|---|---|---|\n");
        for (String[] p : PERF_SUMMARY) {
            report.append("| ").append(p[0]).append(" | ").append(p[1]).append(" | ").append(p[2])
                  .append(" | ").append(p[3]).append(" | ").append(p[4]).append(" | ")
                  .append(p[5]).append(" | ").append(p[6]).append(" |\n");
        }
        report.append("\n## 总计\n\n- 通过：").append(totalPass)
              .append("\n- 失败：").append(totalFail)
              .append("\n- 跳过：").append(totalSkip)
              .append("\n- 通过率：").append(totalPass + totalFail == 0 ? "N/A"
                    : String.format("%.1f%%", 100.0 * totalPass / (totalPass + totalFail))).append("\n");
        if (!failLines.isEmpty()) {
            report.append("\n## 失败明细\n\n");
            for (String l : failLines) report.append("- ").append(l).append("\n");
        }

        File out = new File(baseDir, "测试结果/接口测试报告.md");
        Files.createDirectories(out.getParentFile().toPath());
        Files.writeString(out.toPath(), report.toString(), StandardCharsets.UTF_8);
        System.out.println("TOTAL pass=" + totalPass + " fail=" + totalFail + " skip=" + totalSkip);
        System.out.println("REPORT => " + out.getAbsolutePath());
        System.out.println(totalFail == 0 ? "ALL_PASS" : "HAS_FAILURES");
    }

    static class Result { boolean pass; long ms; String detail = ""; }

    static Result runCase(String baseUrl, JsonNode c) {
        Result r = new Result();
        long t0 = System.currentTimeMillis();
        try {
            JsonNode perf = c.path("perf");
            if (!perf.isMissingNode() && !perf.isNull()) {
                return runPerfCase(baseUrl, c, perf);
            }
            Resp resp = send(baseUrl, c);
            r.ms = System.currentTimeMillis() - t0;
            r.detail = verify(c, resp);
            r.pass = r.detail.isEmpty();
            if (!r.pass) r.detail = r.detail + " [HTTP=" + resp.status + " body=" + trunc(resp.body) + "]";
            return r;
        } catch (Exception e) {
            r.ms = System.currentTimeMillis() - t0;
            r.pass = false;
            r.detail = "执行异常: " + e.getClass().getSimpleName() + ": " + trunc(String.valueOf(e.getMessage()));
            return r;
        }
    }

    static Result runPerfCase(String baseUrl, JsonNode c, JsonNode perf) {
        Result r = new Result();
        int repeat = perf.path("repeat").asInt(20);
        int concurrency = perf.path("concurrency").asInt(5);
        double p95Threshold = perf.path("p95Ms").asDouble(1000);
        double avgThreshold = perf.path("avgMs").asDouble(-1);
        ExecutorService pool = Executors.newFixedThreadPool(concurrency);
        List<Future<Long>> futures = new ArrayList<>();
        long t0 = System.currentTimeMillis();
        for (int i = 0; i < repeat; i++) {
            futures.add(pool.submit(() -> {
                Resp resp = send(baseUrl, c);
                if (!verify(c, resp).isEmpty()) throw new IllegalStateException("perf 请求失败: HTTP=" + resp.status);
                return resp.costMs;
            }));
        }
        List<Long> costs = new ArrayList<>();
        String firstErr = null;
        for (Future<Long> fu : futures) {
            try { costs.add(fu.get(120, TimeUnit.SECONDS)); }
            catch (Exception e) { firstErr = e.getCause() != null ? e.getCause().getMessage() : e.getMessage(); }
        }
        pool.shutdown();
        r.ms = System.currentTimeMillis() - t0;
        if (firstErr != null) { r.pass = false; r.detail = "性能用例请求失败: " + trunc(firstErr); return r; }
        costs.sort(Long::compareTo);
        double avg = costs.stream().mapToLong(Long::longValue).average().orElse(0);
        long p95 = costs.get((int) Math.min(costs.size() - 1, Math.ceil(costs.size() * 0.95) - 1));
        long max = costs.get(costs.size() - 1);
        boolean ok = p95 <= p95Threshold && (avgThreshold < 0 || avg <= avgThreshold);
        r.pass = ok;
        r.detail = ok ? c.path("name").asText()
                : String.format("P95=%dms 超阈值%.0fms 或 AVG=%.0fms 超阈值%.0fms", p95, p95Threshold, avg, avgThreshold);
        PERF_SUMMARY.add(new String[]{ c.path("id").asText() + " " + c.path("name").asText(),
                String.valueOf(repeat), String.valueOf(concurrency),
                String.format("%.0f", avg), String.valueOf(p95), String.valueOf(max),
                ok ? "✅" : "❌" });
        return r;
    }

    static class Resp { int status; String body; long costMs; }

    static Resp send(String baseUrl, JsonNode c) throws Exception {
        String path = subst(c.path("path").asText());
        StringBuilder url = new StringBuilder(baseUrl).append(path);
        JsonNode q = c.path("query");
        if (q.isObject() && q.size() > 0) {
            StringBuilder qs = new StringBuilder();
            var it = q.fields();
            while (it.hasNext()) {
                var e = it.next();
                String v = subst(e.getValue().isValueNode() ? e.getValue().asText() : e.getValue().toString());
                if (v.isEmpty() || v.equals("null")) continue;
                if (qs.length() > 0) qs.append("&");
                qs.append(URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8))
                   .append("=").append(URLEncoder.encode(v, StandardCharsets.UTF_8));
            }
            if (qs.length() > 0) url.append(path.contains("?") ? "&" : "?").append(qs);
        }
        HttpRequest.Builder hb = HttpRequest.newBuilder().uri(URI.create(url.toString()))
                .timeout(Duration.ofSeconds(180));
        JsonNode headers = c.path("headers");
        boolean hasCT = false;
        if (headers.isObject()) {
            var it = headers.fields();
            while (it.hasNext()) {
                var e = it.next();
                if (e.getKey().equalsIgnoreCase("Content-Type")) hasCT = true;
                hb.header(e.getKey(), subst(e.getValue().asText()));
            }
        }
        String method = c.path("method").asText("GET").toUpperCase();
        JsonNode body = c.path("json");
        String rawBody = c.has("rawBody") ? subst(c.get("rawBody").asText()) : null;
        HttpRequest.BodyPublisher pub = rawBody != null
                ? HttpRequest.BodyPublishers.ofString(rawBody, StandardCharsets.UTF_8)
                : (body.isObject() || body.isArray()
                    ? HttpRequest.BodyPublishers.ofString(substJson(body), StandardCharsets.UTF_8)
                    : HttpRequest.BodyPublishers.noBody());
        if (!hasCT && (rawBody != null || body.isObject() || body.isArray())) hb.header("Content-Type", "application/json");
        switch (method) {
            case "POST" -> hb.POST(pub);
            case "PUT" -> hb.PUT(pub);
            case "DELETE" -> hb.DELETE();
            case "PATCH" -> hb.method("PATCH", pub);
            default -> { if (pub != HttpRequest.BodyPublishers.noBody()) hb.method("GET", pub); }
        }
        long t0 = System.currentTimeMillis();
        HttpResponse<String> resp = HTTP.send(hb.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        Resp r = new Resp();
        r.status = resp.statusCode();
        r.body = resp.body();
        r.costMs = System.currentTimeMillis() - t0;
        return r;
    }

    static String verify(JsonNode c, Resp resp) {
        int expHttp = c.path("expectHttp").asInt(200);
        if (expHttp != -1 && resp.status != expHttp) return "HTTP 状态不符: 期望 " + expHttp + " 实际 " + resp.status;
        if (c.has("expectCode") && (resp.body == null || resp.body.isEmpty())) return "响应体为空但期望 code=" + c.path("expectCode").asInt();
        String detail = "";
        if (c.has("expectCode") && resp.body != null && resp.body.trim().startsWith("{")) {
            try {
                JsonNode body = MAPPER.readTree(resp.body);
                String fail = checkBody(c, body);
                extractVars(body, c.path("extract"));
                if (fail != null) return fail;
            } catch (Exception e) {
                return "响应解析失败: " + e.getMessage();
            }
        }
        if (c.has("expectBodyContains")) {
            if (resp.body == null || !resp.body.contains(c.path("expectBodyContains").asText()))
                return "响应体不包含: " + c.path("expectBodyContains").asText();
        }
        return detail;
    }

    static String checkAssert(String p, String op, JsonNode a, JsonNode node) {
        switch (op) {
            case "exists": return (node.isMissingNode() || node.isNull()) ? p + " 不存在/为null" : null;
            case "notExists": return (!node.isMissingNode() && !node.isNull()) ? p + " 应不存在" : null;
            case "isNull": return (!node.isMissingNode() && !node.isNull()) ? p + " 应为null" : null;
            case "notNull": return (node.isMissingNode() || node.isNull()) ? p + " 不应为null" : null;
            case "eq": return nodeEquals(node, a.path("value")) ? null : p + " 不等: 期望 " + a.path("value") + " 实际 " + node;
            case "ne": return !nodeEquals(node, a.path("value")) ? null : p + " 相等: " + node;
            case "contains": return node.toString().contains(a.path("value").asText()) ? null
                    : p + " 不包含 " + a.path("value").asText();
            case "sizeEq": return node.isArray() && node.size() == a.path("value").asInt() ? null
                    : p + " 数组长度 != " + a.path("value").asInt() + " 实际 " + (node.isArray() ? node.size() : "非数组");
            case "sizeGte": return node.isArray() && node.size() >= a.path("value").asInt() ? null
                    : p + " 数组长度 < " + a.path("value").asInt();
            case "sizeLte": return node.isArray() && node.size() <= a.path("value").asInt() ? null
                    : p + " 数组长度 > " + a.path("value").asInt();
            case "gte": return node.asDouble(-1e18) >= a.path("value").asDouble() ? null
                    : p + " 数值 < " + a.path("value").asDouble();
            case "lte": return node.asDouble(1e18) <= a.path("value").asDouble() ? null
                    : p + " 数值 > " + a.path("value").asDouble();
            case "regex": return node.asText("").matches(a.path("value").asText()) ? null
                    : p + " 不匹配正则 " + a.path("value").asText() + " 实际 " + trunc(node.asText(""));
            default: return "未知断言 op: " + op;
        }
    }

    static String checkBody(JsonNode c, JsonNode body) {
        int actCode = body.path("code").asInt(-999);
        int expCode = c.path("expectCode").asInt();
        if (expCode != -999 && actCode != expCode)
            return "code 不符: 期望 " + expCode + " 实际 " + actCode + " msg=" + body.path("message").asText();
        String expEc = c.path("expectErrorCode").asText("");
        if (!expEc.isEmpty()) {
            String actEc = body.path("errorCode").asText("");
            if (!expEc.equals(actEc)) return "errorCode 不符: 期望 " + expEc + " 实际 " + actEc;
        }
        if (c.has("expectMessageContains")) {
            String msg = body.path("message").asText("");
            if (!msg.contains(c.path("expectMessageContains").asText()))
                return "message 不包含: " + c.path("expectMessageContains").asText() + " 实际 " + msg;
        }
        JsonNode asserts = c.path("asserts");
        if (asserts.isArray()) {
            for (JsonNode a : asserts) {
                if (a instanceof ObjectNode && a.path("value").isTextual()) {
                    ((ObjectNode) a).put("value", subst(a.path("value").asText()));
                }
                String p = a.path("path").asText();
                String op = a.path("op").asText("exists");
                JsonNode node = resolve(body, p);
                String err = checkAssert(p, op, a, node);
                if (err != null) return err;
            }
        }
        return null;
    }

    static boolean nodeEquals(JsonNode n, JsonNode exp) {
        if (exp.isNumber() && n.isNumber()) return n.decimalValue().compareTo(exp.decimalValue()) == 0;
        if (exp.isBoolean() || n.isBoolean()) return n.asBoolean() == exp.asBoolean();
        return n.asText().equals(exp.asText());
    }

    static JsonNode resolve(JsonNode root, String path) {
        if (path.equals("$") || path.isEmpty()) return root;
        JsonNode cur = root;
        for (String seg : path.replaceFirst("^\\$\\.?", "").split("\\.")) {
            if (seg.matches("\\w+\\[\\d+\\]")) {
                String field = seg.substring(0, seg.indexOf('['));
                int idx = Integer.parseInt(seg.substring(seg.indexOf('[') + 1, seg.length() - 1));
                cur = cur.path(field).path(idx);
            } else if (seg.matches("\\d+") && cur.isArray()) {
                cur = cur.path(Integer.parseInt(seg));
            } else {
                cur = cur.path(seg);
            }
            if (cur.isMissingNode()) break;
        }
        return cur;
    }

    static String extractVars(JsonNode body, JsonNode extract) {
        if (!extract.isObject()) return "";
        var it = extract.fields();
        while (it.hasNext()) {
            var e = it.next();
            JsonNode v = resolve(body, e.getValue().asText());
            if (!v.isMissingNode() && !v.isNull()) VARS.put(e.getKey(), v.isValueNode() ? v.asText() : v.toString());
            else VARS.put(e.getKey(), "");
        }
        return "";
    }

    static String subst(String s) {
        String out = s;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\$\\{b64\\(([^)]*)\\)\\}").matcher(out);
        if (m.find()) {
            StringBuilder sb = new StringBuilder();
            do {
                String inner = substVars(m.group(1));
                String encoded = java.util.Base64.getEncoder()
                        .encodeToString(inner.getBytes(StandardCharsets.UTF_8));
                m.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(encoded));
            } while (m.find());
            m.appendTail(sb);
            out = sb.toString();
        }
        return substVars(out);
    }

    static String substVars(String s) {
        String out = s;
        for (var e : VARS.entrySet()) {
            if (out.contains("${" + e.getKey() + "}")) out = out.replace("${" + e.getKey() + "}", e.getValue());
        }
        return out;
    }

    static String substJson(JsonNode n) {
        String s = n.toString();
        for (var e : VARS.entrySet()) {
            String ph = "\"${" + e.getKey() + "}\"";
            String raw = "${" + e.getKey() + "}";
            if (s.contains(ph)) {
                String v = e.getValue();
                boolean asNumber = v.matches("-?\\d+(\\.\\d+)?") || v.matches("^(true|false|null)$");
                s = s.replace(ph, asNumber ? v : "\"" + v.replace("\"", "\\\"") + "\"");
            } else if (s.contains(raw)) {
                s = s.replace(raw, e.getValue().replace("\\", "\\\\").replace("\"", "\\\""));
            }
        }
        return s;
    }

    static String trunc(String s) {
        if (s == null) return "";
        return s.length() > 220 ? s.substring(0, 220) + "..." : s;
    }

    static String escapeCell(String s) {
        return s == null ? "" : s.replace("|", "\\|").replace("\n", " ");
    }
}