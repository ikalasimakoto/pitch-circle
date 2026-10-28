import { defineConfig, type Plugin } from "vite";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { DEFAULT_SCALES } from "./src/presets.ts";

// Dev-server API that persists pitch sets as JSON files in ./library.
// Each file is a record: { id, createdAt, savedAt, set }. This keeps the library on
// disk (durable, git-friendly, readable/writable by an AI) rather than trapped
// in browser storage.
function libraryApi(): Plugin {
  const dir = join(process.cwd(), "library");
  const idRe = /^\/api\/library\/([A-Za-z0-9_-]+)$/;

  return {
    name: "pitch-circle-library-api",
    configureServer(server) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0];
        if (!pathname.startsWith("/api/library")) return next();

        const send = (code: number, body?: unknown) => {
          res.statusCode = code;
          if (body === undefined) return res.end();
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };

        try {
          const idMatch = pathname.match(idRe);

          if (req.method === "GET" && /^\/api\/library\/?$/.test(pathname)) {
            const items = readdirSync(dir)
              .filter((f) => f.endsWith(".json"))
              .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
              .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
            return send(200, items);
          }

          if (req.method === "PUT" && idMatch) {
            let body = "";
            for await (const chunk of req) body += chunk;
            const set = JSON.parse(body);
            const path = join(dir, `${idMatch[1]}.json`);
            const now = new Date().toISOString();
            // Preserve the original creation time across updates. For records
            // saved before createdAt existed, fall back to their previous
            // savedAt (then the file's birth time) — never bump it to now, or
            // an update would make the set look freshly created.
            let createdAt = now;
            if (existsSync(path)) {
              try {
                const prev = JSON.parse(readFileSync(path, "utf8"));
                createdAt =
                  prev.createdAt ?? prev.savedAt ?? statSync(path).birthtime.toISOString();
              } catch {
                createdAt = statSync(path).birthtime.toISOString();
              }
            }
            const record = { id: idMatch[1], createdAt, savedAt: now, set };
            writeFileSync(path, JSON.stringify(record, null, 2));
            return send(200, record);
          }

          if (req.method === "DELETE" && idMatch) {
            const p = join(dir, `${idMatch[1]}.json`);
            if (existsSync(p)) unlinkSync(p);
            return send(204);
          }

          return send(404, { error: "not found" });
        } catch (err) {
          return send(500, { error: String(err) });
        }
      });
    },
  };
}

// Dev-server API for scale presets, stored as one JSON file
// (./config/scales.json): an array of { name, intervals }. Seeded with
// DEFAULT_SCALES (src/presets.ts) the first time it is read; after that the file is the truth,
// so presets can be added and removed freely.

function scalesApi(): Plugin {
  const dir = join(process.cwd(), "config");
  const file = join(dir, "scales.json");

  return {
    name: "pitch-circle-scales-api",
    configureServer(server) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0];
        if (pathname !== "/api/scales") return next();

        const send = (code: number, body?: unknown) => {
          res.statusCode = code;
          if (body === undefined) return res.end();
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };

        try {
          if (req.method === "GET") {
            if (!existsSync(file)) writeFileSync(file, JSON.stringify(DEFAULT_SCALES, null, 2));
            return send(200, JSON.parse(readFileSync(file, "utf8")));
          }
          if (req.method === "PUT") {
            let body = "";
            for await (const chunk of req) body += chunk;
            const list = JSON.parse(body);
            writeFileSync(file, JSON.stringify(list, null, 2));
            return send(200, list);
          }
          return send(405, { error: "method not allowed" });
        } catch (err) {
          return send(500, { error: String(err) });
        }
      });
    },
  };
}

export default defineConfig({
  // Relative asset paths, so the static build works under any sub-path
  // (e.g. GitHub Pages' /pitch-circle/).
  base: "./",
  plugins: [libraryApi(), scalesApi()],
});
