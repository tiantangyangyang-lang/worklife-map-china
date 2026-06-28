import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 纯逻辑测试无需 CSS; 内联空 PostCSS 配置, 避免加载项目根 Tailwind v4
  // PostCSS 配置导致的 "Invalid PostCSS Plugin" 报错。
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
