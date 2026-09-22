// Netlify build step: append the commit hash to our own CSS/JS URLs so a deploy
// can never be paired with a stale cached stylesheet or script (the custom
// domain sits behind Cloudflare, which caches static assets for 4 hours).
import { readFileSync, writeFileSync } from "node:fs";
const version = (process.env.COMMIT_REF || process.env.DEPLOY_ID || String(Date.now())).slice(0, 10);
const file = new URL("../public/index.html", import.meta.url);
const html = readFileSync(file, "utf8");
const stamped = html.replace(/((?:href|src)=")(styles\.css|app\.js)(?:\?v=[^"]*)?(")/g, `$1$2?v=${version}$3`);
writeFileSync(file, stamped);
console.log(`stamped index.html assets with v=${version}`);
