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
    // Handoff de design: entregável de terceiros, não é código do projeto.
    "design_handoff/**",
    // Área de trabalho do desenvolvimento: scripts descartáveis de verificação
    // contra o banco, fora do git (ver .gitignore). Os avisos deles escondiam
    // os do código do produto, que é o que o lint precisa mostrar.
    ".superpowers/**",
  ]),
]);

export default eslintConfig;
