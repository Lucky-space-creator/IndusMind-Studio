import { Button, Result } from "antd";
import { Link } from "react-router-dom";

/** 403 页面：无权限访问（路由守卫重定向至此） */
export default function ForbiddenPage() {
  return (
    <Result
      status="403"
      title="403"
      subTitle="抱歉，您没有访问该页面的权限。请联系管理员分配相应权限。"
      extra={
        <Link to="/">
          <Button type="primary">返回首页</Button>
        </Link>
      }
    />
  );
}