import { api } from "@hwc/shared-api";
import type { ChatMessage, ChatResult, ChatSession, PageResult } from "@hwc/shared-types";

/** 我的会话列表 */
export function fetchSessions(current = 1, size = 20) {
  return api.get<PageResult<ChatSession>>("/api/user/chat/sessions", { current, size });
}

/** 发起问答 */
export function sendChat(body: { sessionId?: number | null; question: string; kbIds?: number[]; matchStrictness?: string }) {
  return api.post<ChatResult>("/api/user/chat", body);
}

/** 会话消息历史 */
export function fetchMessages(sessionId: number) {
  return api.get<ChatMessage[]>(`/api/user/chat/sessions/${sessionId}/messages`);
}