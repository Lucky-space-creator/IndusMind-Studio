import { Button, Result } from "antd";
import { useLocation, useNavigate } from "react-router-dom";

/** 管理端 404：路由未命中时兜底，避免出现整页空白 */
export default function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="404"
      subTitle={`未找到页面：${location.pathname}（可能已调整或当前账号无对应入口）`}
      extra={[
        <Button key="home" type="primary" onClick={() => navigate("/")}>
          回到首页
        </Button>,
        <Button key="back" onClick={() => navigate(-1)}>
          返回上一页
        </Button>,
      ]}
    />
  );
}
