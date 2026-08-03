import http from "node:http";

const port = Number(process.env.ARCHIVE_E2E_FIXTURE_PORT ?? 3101);
http.createServer((request, response) => {
  if (request.url === "/failed") {
    response.setHeader("content-type", "application/json");
    response.end("{}");
    return;
  }
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end('<html><head><title>Fixture saved title</title><meta name="description" content="Fixture description"></head><body>saved fixture</body></html>');
}).listen(port, "127.0.0.1", () => process.stdout.write(`fixture listening on ${port}\n`));
