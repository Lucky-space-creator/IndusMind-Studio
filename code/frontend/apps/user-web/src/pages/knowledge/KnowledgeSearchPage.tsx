import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, Panel, SkeletonPanel } from "@hwc/shared-ui";
import type { SegmentHit } from "@hwc/shared-types";
import { fetchKbs, searchKnowledge } from "../../api/knowledge";

/** 知识检索（用户端只读）：关键词 + 语义混合检索，命中片段带来源章节页码 */
export default function KnowledgeSearchPage() {
  const [query, setQuery] = useState("");
  const [kbId, setKbId] = useState<number | null>(null);
  const [strictness, setStrictness] = useState("medium");
  const [submitted, setSubmitted] = useState<{ query: string; kbId: number | null; strictness: string } | null>(null);

  const kbs = useQuery({ queryKey: ["kbs"], queryFn: () => fetchKbs() });
  const results = useQuery({
    queryKey: ["kb-search", submitted],
    queryFn: () =>
      searchKnowledge({
        query: submitted!.query,
        kbIds: submitted!.kbId ? [submitted!.kbId] : undefined,
        topK: 10,
        strictness: submitted!.strictness,
      }),
    enabled: submitted != null,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSubmitted({ query: q, kbId, strictness });
  };

  const hits = results.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Panel title="知识检索" subtitle="覆盖设备手册、故障案例、安全规程（只读）">
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[260px] flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">检索内容</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="如：主轴过热 处理步骤"
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0E6E8C] focus:ring-2 focus:ring-[#0E6E8C]/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">知识库</span>
            <select
              value={kbId ?? ""}
              onChange={(e) => setKbId(e.target.value ? Number(e.target.value) : null)}
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">全部知识库</option>
              {(kbs.data ?? []).map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">严格度</span>
            <select
              value={strictness}
              onChange={(e) => setStrictness(e.target.value)}
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="low">宽松（多召回）</option>
              <option value="medium">均衡</option>
              <option value="high">严格（高相关）</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={results.isFetching}
            className="h-11 rounded-md bg-[#0E6E8C] px-6 text-sm font-medium text-white hover:bg-[#0B5871] disabled:opacity-50"
          >
            {results.isFetching ? "检索中…" : "检索"}
          </button>
        </form>
      </Panel>

      <Panel
        title="检索结果"
        subtitle={submitted ? `“${submitted.query}” · 命中 ${hits.length} 条` : undefined}
      >
        {!submitted ? (
          <EmptyState title="输入关键词发起检索，结果片段附来源章节与页码" />
        ) : results.isLoading ? (
          <SkeletonPanel rows={6} />
        ) : hits.length === 0 ? (
          <EmptyState title="未检索到相关内容，可尝试更换关键词或降低严格度" />
        ) : (
          <ol className="space-y-3">
            {hits.map((hit: SegmentHit, i: number) => (
              <li key={hit.segmentId} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium text-slate-800">{hit.docName}</span>
                  <span className="shrink-0 text-xs text-[#0E6E8C]">相关度 {(hit.score * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {[hit.chapter, hit.pageNo != null ? `第 ${hit.pageNo} 页` : null].filter(Boolean).join(" · ") || "未标注来源位置"}
                </div>
                <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-slate-600">{hit.content}</p>
                <div className="mt-2 text-xs text-slate-400">序号 {i + 1} · 片段 #{hit.segmentId}（点击“智能问答”可继续追问）</div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}