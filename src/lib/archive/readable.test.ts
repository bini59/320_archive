import { describe, expect, it } from "vitest";
import { createReadableHtml } from "./readable";

const render = (html: string) => new TextDecoder().decode(createReadableHtml(Buffer.from(html)));

describe("createReadableHtml", () => {
  it("keeps article structure and decoded text in a standalone document", () => {
    const result = render("<html><body><main><h1>Fish &amp; Chips</h1><p>Hello <strong>reader</strong></p></main></body></html>");
    expect(result).toBe('<!doctype html><html><head><meta charset="utf-8"><title>Archived reading view</title></head><body><main><h1>Fish &amp; Chips</h1><p>Hello <strong>reader</strong></p></main></body></html>');
  });

  it("removes active content, controls, styling, and every URL-bearing attribute", () => {
    const result = render('<body onload="evil()"><base href="https://evil.test"><script>evil()</script><style>@import url(x)</style><iframe src="https://evil.test"></iframe><form action="javascript:evil()"><input><button>go</button></form><svg><a href="data:text/html,x">x</a></svg><p style="background:url(x)" onclick="evil()"><a href="javascript:evil()">safe text</a><img srcset="https://evil.test/x 1x" src="x"></p><link rel="stylesheet" href="x"><meta http-equiv="refresh" content="0;url=x">');
    const body = result.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? "";
    expect(body).not.toMatch(/<script|style=|onclick|onload|href=|src(?:set)?=|<form|<input|<button|<iframe|<svg|<link|<meta|evil\.test/i);
    expect(result).toContain("safe text");
  });

  it("safely handles malformed markup, entities, and an empty body", () => {
    expect(render("<body><p>one<div>two &lt; three<script><p>hidden</body>")).toContain("one");
    expect(render("<html><head><title>x</title></head><body> </body></html>")).toMatch(/<body><\/body>/);
  });
});
