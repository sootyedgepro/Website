// LOCAL-ONLY dev plugin. Runs the Vercel-style api/ handlers INSIDE the Vite
// dev server so the /dex chat box can reach /api/dex/chat without Vercel.
//
// Dev only: `apply: "serve"` + configureServer means this NEVER executes during
// `vite build`, so nothing here ships to production. Not used by the deploy.
//
// It loads .env.local into process.env and, for convenience, pulls the *current*
// Claude Code OAuth token straight from ~/.claude/.credentials.json at startup —
// so you don't re-paste the token as it rotates; just restart `npm run dev`.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function loadEnvLocal() {
  try {
    const txt = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if (/^(".*"|'.*')$/.test(val)) val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  } catch {
    /* no .env.local — that's fine */
  }
}

function loadFreshOAuthToken() {
  try {
    const p = join(homedir(), ".claude", ".credentials.json");
    const tok = JSON.parse(readFileSync(p, "utf8"))?.claudeAiOauth?.accessToken;
    if (tok) {
      process.env.ANTHROPIC_OAUTH_TOKEN = tok;
      return tok.slice(0, 14);
    }
  } catch {
    /* fall back to whatever .env.local provided */
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => resolve(d));
    req.on("error", () => resolve(d));
  });
}

export default function devApi() {
  return {
    name: "sootydex-dev-api",
    apply: "serve",
    configureServer(server) {
      loadEnvLocal();
      const prefix = loadFreshOAuthToken();
      server.config.logger.info(
        `  [dev-api] /api handlers mounted locally · OAuth token ${prefix ? prefix + "…" : "(from .env.local)"}`
      );

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/api/")) return next();
        const path = url.split("?")[0].replace(/\/+$/, "");
        if (!/^\/api\/[A-Za-z0-9/_-]+$/.test(path)) return next();

        // Resolve /api/dex/chat -> ./api/dex/chat.js (or .../index.js)
        let handler = null;
        for (const cand of [`.${path}.js`, `.${path}/index.js`]) {
          try {
            handler = require(cand);
            break;
          } catch (e) {
            if (e.code !== "MODULE_NOT_FOUND") {
              handler = e;
              break;
            }
          }
        }
        if (!handler) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ error: `No local handler for ${path}` }));
        }
        if (handler instanceof Error) {
          console.error(`[dev-api] failed to load ${path}:`, handler);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ error: "handler load error: " + handler.message }));
        }
        if (handler.default) handler = handler.default;

        // Vercel-style req/res shim
        const raw = await readBody(req);
        try {
          req.body = raw ? JSON.parse(raw) : {};
        } catch {
          req.body = {};
        }
        try {
          req.query = Object.fromEntries(new URL(url, "http://localhost").searchParams);
        } catch {
          req.query = {};
        }
        res.status = (c) => {
          res.statusCode = c;
          return res;
        };
        res.json = (o) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(o));
          return res;
        };
        res.send = (d) => {
          res.end(typeof d === "string" ? d : JSON.stringify(d));
          return res;
        };

        try {
          await handler(req, res);
        } catch (err) {
          console.error(`[dev-api] ${path} threw:`, err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "dev-api: " + (err?.message || "handler error") }));
          }
        }
      });
    },
  };
}
