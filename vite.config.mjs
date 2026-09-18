import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { cpSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { minify } from "terser";
// Keep the shared classic-script scope, but ship one request in production.
const classicPattern = /<script src="(js\/[^"]+)"><\/script>/g;
const classicSource = [
  ...readFileSync("index.html", "utf8").matchAll(classicPattern),
]
  .map(([, file]) => readFileSync(file, "utf8"))
  .join("\n;\n");
const classicFilename = `study-core-${createHash("sha256").update(classicSource).digest("hex").slice(0, 12)}.js`;
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "study-assets",
      apply: "build",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          let first = true;
          return html.replace(classicPattern, () => {
            if (!first) return "";
            first = false;
            return `<script src="./${classicFilename}"></script>`;
          });
        },
      },
      async generateBundle() {
        // Shared global names are part of the editor bridge; preserve them.
        const result = await minify(classicSource, {
          compress: false,
          mangle: false,
          format: { comments: false },
        });
        this.emitFile({
          type: "asset",
          fileName: classicFilename,
          source: result.code,
        });
      },
      closeBundle() {
        cpSync("library", "dist/library", { recursive: true });
      },
    },
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
