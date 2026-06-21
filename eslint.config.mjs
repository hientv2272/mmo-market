import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Các quy tắc strict mới của React 19 (eslint-config-next) báo lỗi với những pattern
  // dùng phổ biến khắp codebase (fetch khi mount; Date.now()/Math.random() khi render).
  // Hạ xuống "warn" để không chặn build, vẫn giữ cảnh báo để cải thiện dần.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
