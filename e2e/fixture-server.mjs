import http from "node:http";

const port = Number(process.env.ARCHIVE_E2E_FIXTURE_PORT ?? 3101);
let unexpectedRequests = [];

http.createServer((request, response) => {
  if (request.url === "/requests") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(unexpectedRequests));
    return;
  }
  if (request.url === "/reset-requests") {
    unexpectedRequests = [];
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.url === "/failed") {
    response.setHeader("content-type", "application/json");
    response.end("{}");
    return;
  }
  if (request.url?.startsWith("/unexpected")) {
    unexpectedRequests.push(request.url);
    response.statusCode = 204;
    response.end();
    return;
  }
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html>
    <html>
      <head>
        <title>Fixture saved title</title>
        <meta name="description" content="Fixture description">
        <base href="http://external.fixture.test:${port}/">
        <link rel="stylesheet" href="http://external.fixture.test:${port}/unexpected-style">
        <style>@import url("http://external.fixture.test:${port}/unexpected-import");</style>
      </head>
      <body onload="window.__archiveScriptRan = true">
        <main>
          <article>
            <h1>Fixture reading heading</h1>
            <p>Deterministic article body with <strong>preserved structure</strong>.</p>
            <a href="javascript:window.__archiveScriptRan=true">javascript link</a>
            <a href="data:text/html,%3Cscript%3Eparent.postMessage('escaped','*')%3C/script%3E">data link</a>
            <img src="http://external.fixture.test:${port}/unexpected-image" onerror="window.__archiveScriptRan=true">
          </article>
        </main>
        <form action="http://external.fixture.test:${port}/unexpected-form"><input name="secret" value="x"><button>send</button></form>
        <iframe src="http://external.fixture.test:${port}/unexpected-frame"></iframe>
        <script>
          window.__archiveScriptRan = true;
          fetch("http://external.fixture.test:${port}/unexpected-fetch");
          window.top.location = "http://external.fixture.test:${port}/unexpected-navigation";
        </script>
      </body>
    </html>`);
}).listen(port, "127.0.0.1", () => process.stdout.write(`fixture listening on ${port}\n`));
