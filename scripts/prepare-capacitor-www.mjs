/**
 * Capacitor needs webDir/index.html. TanStack Start + Nitro builds SSR into
 * .output/public (no SPA index.html), so we stage a small www shell and load
 * the live HTTPS app via capacitor.config server.url.
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const www = join(root, "www");
const publicDir = join(root, "public");

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const name of ["icons", "images", "favicon.ico", "manifest.webmanifest", "sw.js"]) {
  const from = join(publicDir, name);
  if (existsSync(from)) {
    cpSync(from, join(www, name), { recursive: true });
  }
}

writeFileSync(
  join(www, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0F766E" />
    <title>ParcelOS</title>
    <style>
      html, body { height: 100%; margin: 0; background: #0F766E; color: #fff;
        font-family: system-ui, sans-serif; display: grid; place-items: center; }
    </style>
  </head>
  <body>
    <p>Opening ParcelOS…</p>
  </body>
</html>
`,
  "utf8",
);

console.log("[prepare-capacitor] wrote www/index.html for Capacitor sync");
