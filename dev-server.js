import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";

const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const host = "127.0.0.1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function resolvePath(urlPath) {
  const sanitized = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(root, sanitized === "/" ? "index.html" : sanitized.slice(1));

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  return join(root, "index.html");
}

createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const filePath = resolvePath(url.pathname);
  const extension = extname(filePath);

  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": "no-store"
  });

  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Snake game available at http://${host}:${port}`);
});
