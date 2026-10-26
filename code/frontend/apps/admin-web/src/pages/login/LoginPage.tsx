import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, theme } from "antd";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@hwc/shared-auth";
import { adminLogin } from "../../api/auth";

interface LoginForm {
  username: string;
  password: string;
}

/** 管理端登录页 */
export default function LoginPage() {
  const [form] = Form.useForm<LoginForm>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { token } = theme.useToken();

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminLogin(values);
      setAuth(result);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0F2437",
        padding: 16,
      }}
    >
      <div
        style={{
          width: 380,
          background: "#fff",
          borderRadius: 8,
          padding: "36px 32px 28px",
          boxShadow: "0 12px 40px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span
            aria-hidden
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "#0E6E8C",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            HW
          </span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#1E293B" }}>设备运维智能系统</div>
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>管理端 · 配置与治理</div>
          </div>
        </div>
        {error && <Alert type="error" showIcon message={error} style={{ margin: "14px 0" }} />}
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} style={{ marginTop: 18 }}>
          <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入账号" }]}>
            <Input prefix={<UserOutlined />} placeholder="账号" size="large" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading} style={{ marginTop: 4 }}>
            登录
          </Button>
        </Form>
        <div style={{ marginTop: 14, fontSize: 12, color: token.colorTextTertiary, textAlign: "center" }}>
          默认账号 admin / Admin@123，首次登录后建议修改密码
          <div style={{ marginTop: 4, color: token.colorTextQuaternary }}>
            本端仅限管理端账号，工程师等业务账号请从用户端登录
          </div>
        </div>
      </div>
    </div>
  );
}