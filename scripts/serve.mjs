// Static, path-scoped development server. No private files or dot directories.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
export async function startServer({ port = 8766, host = "127.0.0.1" } = {}) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/x-icon",
  };
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end();
        return;
      }
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (path.split("/").some((part) => part.startsWith("."))) {
        res.writeHead(404);
        res.end();
        return;
      }
      let file = resolve(root, "." + path);
      if (
        file !== resolve(root) &&
        !file.startsWith(root.endsWith(sep) ? root : root + sep)
      ) {
        res.writeHead(404);
        res.end();
        return;
      }
      if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, host, ok);
  });
  return { server, url: `http://${host}:${server.address().port}` };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await startServer({ port: Number(process.env.PORT || 8766) });
  console.log(`Nutrak: ${url}`);
}
