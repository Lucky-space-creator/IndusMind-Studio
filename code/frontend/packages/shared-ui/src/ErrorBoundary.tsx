import { Component, type ErrorInfo, type ReactNode } from "react";
import { tokens } from "./tokens";

interface Props {
  children: ReactNode;
  /** 自定义兜底内容（不传则用内置样式） */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
  /** 自动恢复计数，用于在兜底页展示与限制重试次数 */
  rescued: number;
}

/**
 * DOM 被 React 之外的力量改写时浏览器抛出的典型错误。
 * 成因：第三方库（ECharts 等）与 React 共用同一容器、浏览器翻译改写文本节点、扩展注入/删除节点。
 * 这类错误卸载重建子树即可恢复，不必让用户看到兜底页。
 */
const DOM_MUTATION_ERROR =
  /removeChild|insertBefore|replaceChild|The node to be removed|The node before which|NotFoundError/i;

function isDomMutationError(error: Error | null): boolean {
  return DOM_MUTATION_ERROR.test(error?.message ?? "");
}

/**
 * 全局错误边界：避免渲染异常导致整页空白（React 18 未捕获错误会卸载整棵树）。
 *
 * 对 DOM 篡改类错误做一次静默自愈（重新挂载子树），最多自动恢复 2 次；
 * 仍然失败才展示兜底页，避免「一次性抖动」被放大成整页报错。
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, rescued: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 保留控制台堆栈，便于排查；不影响用户看到的兜底页
    console.error("[AppErrorBoundary]", error, info.componentStack);

    if (isDomMutationError(error) && this.state.rescued < 2) {
      const next = this.state.rescued + 1;
      console.warn(`[AppErrorBoundary] 检测到 DOM 结构冲突，自动重挂子树（第 ${next} 次）`);
      // 不在 commit 阶段同步 setState，交给下一轮事件循环
      window.setTimeout(() => this.setState({ error: null, rescued: next }), 0);
    }
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;
    if (!error) return children;
    if (fallback) return fallback(error, this.reset);

    const domConflict = isDomMutationError(error);
    const hint = domConflict
      ? "页面元素被外部改写了，常见于开启了浏览器「网页翻译」或安装了改写页面的扩展。关闭后点重试即可恢复。"
      : "当前操作已被中断。可先重试；若持续出现，请把下方信息反馈给管理员。";

    return (
      // translate="no" 防止兜底页本身再被翻译引擎改写
      <div
        translate="no"
        className="notranslate"
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "inherit",
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: "100%",
            padding: "24px 28px",
            borderRadius: 8,
            border: `1px solid ${tokens.border}`,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(15,36,55,0.08)",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text, marginBottom: 8 }}>页面渲染出现异常</div>
          <div style={{ fontSize: 13, color: tokens.textSecondary, lineHeight: "22px", marginBottom: 12 }}>{hint}</div>
          <pre
            style={{
              margin: "0 0 16px",
              padding: "10px 12px",
              background: tokens.bg,
              border: `1px solid ${tokens.border}`,
              borderRadius: 6,
              fontSize: 12,
              lineHeight: "18px",
              color: tokens.danger,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 160,
              overflow: "auto",
            }}
          >
            {error.message || String(error)}
          </pre>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={this.reset}
              style={{
                padding: "7px 16px",
                borderRadius: 6,
                border: "none",
                background: tokens.primary,
                color: "#fff",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              重试
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "7px 16px",
                borderRadius: 6,
                border: `1px solid ${tokens.borderStrong}`,
                background: "#fff",
                color: tokens.text,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}
