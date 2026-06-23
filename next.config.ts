import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 不再忽略 TS 构建错误, 让类型问题在构建期暴露
  typescript: {
    ignoreBuildErrors: false,
  },
  // 开启 React 严格模式, 帮助发现潜在副作用问题
  reactStrictMode: true,
};

export default nextConfig;
