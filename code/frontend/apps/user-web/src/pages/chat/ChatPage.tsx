import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Auth, usePermission } from "@hwc/shared-auth";
import { CitationList, EmptyState, SkeletonPanel, parseCitations } from "@hwc/shared-ui";
import { USER_PERM, type ChatMessage, type ChatResult, type Citation } from "@hwc/shared-types";
import { fetchMessages, fetchSessions, sendChat } from "../../api/chat";
import { fetchSegments } from "../../api/knowledge";
import { Drawer } from "../../components/Drawer";
import { showToast } from "../../components/Toast";

const SUGGESTED_QUESTIONS = ["主轴过热的常见原因有哪些？", "如何判断振动异常是否需要停机检修？", "轴承磨损的预防性维护措施"];

interface Bubble {
  role: string;
  content: string;
  citations?: Citation[];
  pending?: boolean;
}

/** 智能问答：会话侧栏 + 对话气泡 + 引用角标 → 原文抽屉 */
export default function ChatPage() {
  const { has } = usePermission();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [citeDrawer, setCiteDrawer] = useState<{ open: boolean; citation?: Citation }>({ open: false });
  const listRef = useRef<HTMLDivElement>(null);
  const canWrite = has(USER_PERM.CHAT_WRITE);

  const sessions = useQuery({ queryKey: ["chat-sessions"], queryFn: () => fetchSessions(1, 50) });
  const messages = useQuery({
    queryKey: ["chat-messages", sessionId],
    queryFn: () => fetchMessages(sessionId!),
    enabled: sessionId != null,
  });

  useEffect(() => {
    if (messages.data) {
      setBubbles(
        messages.data.map((m: ChatMessage) => ({
          role: m.role,
          content: m.content,
          citations: parseCitations(m.citations),
        })),
      );
    }
  }, [messages.data]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles]);

  const send = useMutation({
    mutationFn: (question: string) => sendChat({ sessionId, question }),
    onSuccess: (result: ChatResult) => {
      setSessionId(result.sessionId);
      setBubbles((prev) => [
        ...prev.map((b) => ({ ...b, pending: false })),
        { role: "assistant", content: result.answer, citations: result.citations },
      ]);
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      if (!result.hit) {
        showToast("现有知识库未覆盖该问题，回答可能有限", "warning");
      }
    },
    onError: (e: Error) => {
      setBubbles((prev) => prev.filter((b) => !b.pending));
      showToast(e.message || "问答失败，请稍后重试", "error");
    },
  });

  const sessionList = useMemo(() => sessions.data?.records ?? [], [sessions.data]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || send.isPending) return;
    setInput("");
    setBubbles((prev) => [...prev, { role: "user", content: question }, { role: "assistant", content: "正在检索知识库…", pending: true }]);
    send.mutate(question);
  };

  return (
    <div className="grid h-[calc(100vh-190px)] min-h-[480px] grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
      {/* 会话列表 */}
      <aside className="hidden flex-col overflow-hidden rounded-lg border border-slate-200 bg-white md:flex">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">会话</span>
          <button
            type="button"
            onClick={() => {
              setSessionId(null);
              setBubbles([]);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            新建会话
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {sessions.isLoading ? (
            <div className="p-4">
              <SkeletonPanel rows={4} />
            </div>
          ) : sessionList.length === 0 ? (
            <div className="p-4">
              <EmptyState title="暂无历史会话" />
            </div>
          ) : (
            sessionList.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSessionId(s.id)}
                className={`block w-full truncate border-b border-slate-100 px-4 py-3 text-left text-sm ${
                  sessionId === s.id ? "bg-[#0E6E8C]/8 font-medium text-[#0E6E8C]" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="block truncate">{s.title || `会话 #${s.id}`}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{s.lastMessageTime ?? ""}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* 对话区 */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {bubbles.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <EmptyState title="向知识库提问，回答将附带可溯源引用" />
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={!canWrite}
                    onClick={() => send.mutate(q)}
                    className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm text-slate-600 hover:border-[#0E6E8C] hover:text-[#0E6E8C] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {bubbles.map((b, i) => (
            <div key={i} className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  b.role === "user" ? "bg-[#0E6E8C] text-white" : "bg-slate-100 text-slate-800"
                } ${b.pending ? "animate-pulse text-slate-500" : ""}`}
              >
                <div className="whitespace-pre-wrap">{b.content}</div>
                {b.citations && b.citations.length > 0 && (
                  <div className="mt-2.5 border-t border-slate-200 pt-2.5">
                    <div className="mb-1.5 text-xs text-slate-500">引用来源（点击查看原文）：</div>
                    <CitationList citations={b.citations} onClick={(c) => setCiteDrawer({ open: true, citation: c })} columns={1} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 输入区 */}
        <form onSubmit={onSubmit} className="flex items-end gap-3 border-t border-slate-200 px-4 py-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            rows={2}
            disabled={!canWrite}
            placeholder={canWrite ? "输入问题，Enter 发送，Shift+Enter 换行" : "当前账号为只读，无法发起问答"}
            className="max-h-32 min-h-[44px] flex-1 resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0E6E8C] focus:ring-2 focus:ring-[#0E6E8C]/20 disabled:bg-slate-50"
          />
          <Auth code={[USER_PERM.CHAT_WRITE]}>
            <button
              type="submit"
              disabled={send.isPending || !input.trim()}
              className="h-11 rounded-md bg-[#0E6E8C] px-5 text-sm font-medium text-white hover:bg-[#0B5871] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {send.isPending ? "回答中…" : "发送"}
            </button>
          </Auth>
        </form>
      </section>

      {/* 引用原文抽屉 */}
      <Drawer open={citeDrawer.open} title={citeDrawer.citation?.docName ?? "引用详情"} onClose={() => setCiteDrawer({ open: false })}>
        {citeDrawer.citation && <CitationDetail citation={citeDrawer.citation} />}
      </Drawer>
    </div>
  );
}

/** 引用详情：拉取文档片段定位原文 */
function CitationDetail({ citation }: { citation: Citation }) {
  const segments = useQuery({
    queryKey: ["doc-segments", citation.docId],
    queryFn: () => fetchSegments(citation.docId),
  });
  const segment = (segments.data ?? []).find((s) => s.id === citation.segmentId);
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-md bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
        {[citation.chapter, citation.pageNo != null ? `第 ${citation.pageNo} 页` : null, `片段 #${citation.segmentId}`]
          .filter(Boolean)
          .join(" · ")}
        {citation.score != null && <span className="ml-2 text-[#0E6E8C]">相关度 {(citation.score * 100).toFixed(0)}%</span>}
      </div>
      {segments.isLoading ? (
        <SkeletonPanel rows={5} />
      ) : segment ? (
        <div className="whitespace-pre-wrap leading-relaxed text-slate-700">{segment.content}</div>
      ) : (
        <EmptyState title="片段内容不可用（文档可能已更新或停用）" />
      )}
    </div>
  );
}