import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(root, "dist");
const apiBaseUrl = process.env.YOMI_API_BASE_URL?.trim().replace(/\/+$/, "");

if (!apiBaseUrl || !apiBaseUrl.startsWith("https://") || !apiBaseUrl.endsWith("/api/v1")) {
  throw new Error("YOMI_API_BASE_URL must be an HTTPS URL ending in /api/v1");
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const file of ["index.html", "app.js", "styles.css"]) {
  fs.copyFileSync(path.join(root, file), path.join(outputDir, file));
}
fs.cpSync(path.join(root, "assets"), path.join(outputDir, "assets"), { recursive: true });

const config = {
  apiBaseUrl
};
fs.writeFileSync(
  path.join(outputDir, "config.js"),
  `window.YOMI_CONFIG = Object.freeze(${JSON.stringify(config)});\n`,
  "utf8"
);

console.log(`Built Yomi Studio OS for ${apiBaseUrl}`);
