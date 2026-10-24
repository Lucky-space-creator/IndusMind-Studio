import { Button, Result, Space } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@hwc/shared-auth";

/** 403 页面：无权限访问（路由守卫重定向至此） */
export default function ForbiddenPage() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return (
    <Result
      status="403"
      title="403"
      subTitle="抱歉，您没有访问该页面的权限。若管理员刚刚调整了权限，切换窗口或返回首页即可自动生效；也可以联系管理员分配相应角色。"
      extra={
        <Space>
          <Link to="/">
            <Button type="primary">返回首页</Button>
          </Link>
          {/* 权限被全部收回时会停留在本页，提供退出入口避免卡死 */}
          <Button
            onClick={() => {
              clearAuth();
              navigate("/login", { replace: true });
            }}
          >
            退出并重新登录
          </Button>
        </Space>
      }
    />
  );
}
