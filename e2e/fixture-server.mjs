import http from "node:http";

const port = Number(process.env.ARCHIVE_E2E_FIXTURE_PORT ?? 3101);
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
const text = Buffer.from("Archived fixture attachment.\n");
const font = Buffer.from("wOF2\0\0\0\0fixture-font", "binary");
const assetHosts = new Set(["assets.fixture.test", "redirect.fixture.test"]);

let unexpectedRequests = [];
let sourceOffline = false;

function send(response, type, body, headers = {}) {
  response.writeHead(200, { "content-type": type, "content-length": Buffer.byteLength(body), ...headers });
  response.end(body);
}

function successPage() {
  return `<!doctype html>
    <html>
      <head>
        <title>Fixture saved title</title>
        <meta name="description" content="Fixture description">
          <base href="http://assets.fixture.test:${port}/assets/">
          <link rel="stylesheet" href="http://assets.fixture.test:${port}/assets/style.css">
          <link rel="preload" href="http://assets.fixture.test:${port}/assets/font.woff2" as="font" type="font/woff2" crossorigin>
          <link rel="stylesheet" href="http://external.fixture.test:${port}/unexpected-style">
          <style>@import url("http://assets.fixture.test:${port}/assets/import.css"); .inline-card { background-image: url("http://assets.fixture.test:${port}/assets/image.png"); }</style>
      </head>
      <body onload="window.__archiveScriptRan = true">
        <main><article>
          <h1>Fixture reading heading</h1>
          <p>Deterministic article body with <strong>preserved structure</strong>.</p>
          <img alt="preserved fixture image" src="image.png">
          <img alt="duplicate fixture image" src="http://assets.fixture.test:${port}/assets/image.png">
          <img alt="redirected fixture image" src="http://redirect.fixture.test:${port}/asset-redirect">
          <img alt="partially preserved srcset" srcset="image.png 1x, unsupported.svg 2x, missing.png 3x">
          <img alt="rejected unsupported image" src="unsupported.svg">
          <img alt="rejected spoofed image" src="spoofed.png">
          <img alt="rejected oversized image" src="oversized.png">
          <img alt="rejected chunked image" src="chunked.png">
          <img alt="rejected timeout image" src="timeout.png">
          <img alt="rejected private redirect image" src="private-redirect.png">
          <img alt="missing image" src="missing.png">
          <a href="document.pdf">fixture PDF</a>
          <a href="notes.txt">fixture text</a>
          <a href="javascript:window.__archiveScriptRan=true">javascript link</a>
          <a href="data:text/html,bad">data link</a>
        </article></main>
        <form action="http://external.fixture.test:${port}/unexpected-form"><input name="secret"><button>send</button></form>
        <iframe src="http://external.fixture.test:${port}/unexpected-frame"></iframe>
        <script>
          window.__archiveScriptRan = true;
          fetch("http://external.fixture.test:${port}/unexpected-fetch");
          const hydrated = document.createElement("p");
          hydrated.className = "hydrated-card";
          hydrated.setAttribute("style", "background-image: url('http://assets.fixture.test:${port}/assets/image.png');");
          hydrated.textContent = "CSR hydrated content";
          document.querySelector("article").append(hydrated);
        </script>
      </body>
    </html>`;
}

function requestStormPage() {
  const images = Array.from({ length: 140 }, (_, index) => `<img alt="storm-${index}" src="http://assets.fixture.test:${port}/assets/image.png?request=${index}">`).join("");
  return `<!doctype html><html><head><title>Request storm</title></head><body>${images}</body></html>`;
}

http.createServer((request, response) => {
  const host = request.headers.host?.split(":", 1)[0] ?? "";
  const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;

  if (pathname === "/requests") return send(response, "application/json", JSON.stringify(unexpectedRequests));
  if (pathname === "/reset-requests") {
    unexpectedRequests = [];
    sourceOffline = false;
    response.writeHead(204).end();
    return;
  }
  if (pathname === "/source-offline") {
    unexpectedRequests = [];
    sourceOffline = true;
    response.writeHead(204).end();
    return;
  }

  if (sourceOffline && (host.endsWith(".fixture.test") || assetHosts.has(host))) {
    unexpectedRequests.push(`${host}${pathname}`);
    response.writeHead(503, { "content-type": "text/plain" }).end("source offline");
    return;
  }

  if (pathname === "/failed") return send(response, "application/json", "{}");
  if (pathname === "/request-storm") return send(response, "text/html; charset=utf-8", requestStormPage());
  if (pathname.startsWith("/unexpected")) {
    unexpectedRequests.push(`${host}${pathname}`);
    response.writeHead(204).end();
    return;
  }
  if (pathname === "/asset-redirect") {
    response.writeHead(302, { location: `http://assets.fixture.test:${port}/assets/image.png` }).end();
    return;
  }
  if (pathname === "/assets/private-redirect.png") {
    response.writeHead(302, { location: `http://127.0.0.1:${port}/assets/image.png` }).end();
    return;
  }
  if (pathname === "/assets/image.png") return send(response, "image/png", onePixelPng);
  if (pathname === "/assets/style.css") return send(response, "text/css", `@import url("/assets/import.css"); .hydrated-card { font-family: Fixture; background-image: url("/assets/image.png"); } @font-face { font-family: Fixture; src: url("/assets/font.woff2") format("woff2"); }`);
  if (pathname === "/assets/import.css") return send(response, "text/css", ".imported-card { border: 3px solid rgb(1, 2, 3); }");
  if (pathname === "/assets/font.woff2") return send(response, "font/woff2", font, { "access-control-allow-origin": "*" });
  if (pathname === "/assets/document.pdf") return send(response, "application/pdf", pdf);
  if (pathname === "/assets/notes.txt") return send(response, "text/plain", text);
  if (pathname === "/assets/unsupported.svg") return send(response, "image/svg+xml", "<svg/>");
  if (pathname === "/assets/spoofed.png") return send(response, "text/html", "<script>alert(1)</script>");
  if (pathname === "/assets/oversized.png") {
    response.writeHead(200, { "content-type": "image/png", "content-length": "4096" });
    response.end(Buffer.alloc(4096, 1));
    return;
  }
  if (pathname === "/assets/chunked.png") {
    response.writeHead(200, { "content-type": "image/png", "transfer-encoding": "chunked" });
    for (let index = 0; index < 9; index += 1) response.write(Buffer.alloc(512, index));
    response.end();
    return;
  }
  if (pathname === "/assets/timeout.png") {
    setTimeout(() => response.writeHead(504).end(), 2_000);
    return;
  }
  if (pathname === "/assets/missing.png") {
    response.writeHead(404, { "content-type": "text/html" }).end("missing");
    return;
  }

  send(response, "text/html; charset=utf-8", successPage());
}).listen(port, "127.0.0.1", () => process.stdout.write(`fixture listening on ${port}\n`));
