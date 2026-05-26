import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 既存のNon-module scripts（require() を使う）
    "scripts/run-migration.js",
    "tailwind.config.ts",
  ]),
  {
    // Hydration mismatch 回避のため意図的に effect 内で setState する箇所がある。
    // SSR-CSR の差分検出に必要なパターンのためグローバルに off にする
    // （react-hooks/set-state-in-effect は eslint-plugin-react-hooks v5.x の新ルール）
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
