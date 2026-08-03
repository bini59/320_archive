import http from "node:http";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { SafeCaptureClient } from "./fetcher";

const servers:http.Server[]=[];
afterEach(async()=>Promise.all(servers.splice(0).map(server=>new Promise<void>(resolve=>server.close(()=>resolve())))));

describe("SafeCaptureClient transport seam",()=>{
  it("validates the public DNS answer while allowing a separate fixture socket address",async()=>{
    const server=http.createServer((_request,response)=>{response.setHeader("content-type","text/html");response.end("<title>fixture</title>");});
    servers.push(server); await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const port=(server.address() as {port:number}).port;
    let validatedAddress:string|undefined;
    const client=new SafeCaptureClient({timeoutMs:1000,maxBytes:1024,maxRedirects:0,
      resolver:async()=>[{address:"93.184.216.34",family:4}],
      connectionAddress:(address)=>{validatedAddress=address;return {address:"127.0.0.1",family:4};},
    });
    const result=await client.capture(`http://fixture.example:${port}/page`);
    expect(validatedAddress).toBe("93.184.216.34");
    expect(Buffer.from(result.bytes).toString()).toContain("fixture");
    expect(result.finalUrl).toBe(`http://fixture.example:${port}/page`);
  });

  it("follows relative and absolute redirects while revalidating every hostname",async()=>{
    const seen:string[]=[];
    const server=http.createServer((request,response)=>{
      if(request.url==="/start"){response.writeHead(302,{location:"/middle"});response.end();return;}
      if(request.url==="/middle"){response.writeHead(302,{location:`http://other.fixture:${(server.address() as {port:number}).port}/final`});response.end();return;}
      response.setHeader("content-type","text/html; charset=utf-8");response.end("<html>redirected</html>");
    });
    servers.push(server);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const port=(server.address() as {port:number}).port;
    const client=new SafeCaptureClient({timeoutMs:1000,maxBytes:1024,maxRedirects:5,
      resolver:async hostname=>{seen.push(hostname);return [{address:"93.184.216.34",family:4}];},
      connectionAddress:()=>({address:"127.0.0.1",family:4}),
    });

    const result=await client.capture(`http://fixture.example:${port}/start`);

    expect(seen).toEqual(["fixture.example","fixture.example","other.fixture"]);
    expect(Buffer.from(result.bytes).toString()).toBe("<html>redirected</html>");
  });

  it("rejects the sixth redirect when five are allowed",async()=>{
    const server=http.createServer((request,response)=>{const step=Number(request.url?.slice(1)??0);response.writeHead(302,{location:`/${step+1}`});response.end();});
    servers.push(server);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const port=(server.address() as {port:number}).port;
    const client=new SafeCaptureClient({timeoutMs:1000,maxBytes:1024,maxRedirects:5,resolver:async()=>[{address:"93.184.216.34",family:4}],connectionAddress:()=>({address:"127.0.0.1",family:4})});
    await expect(client.capture(`http://fixture.example:${port}/0`)).rejects.toMatchObject({code:"redirect"});
  });

  it("applies one timeout to the entire response",async()=>{
    const server=http.createServer((_request,response)=>{setTimeout(()=>{response.setHeader("content-type","text/html");response.end("late");},100);});
    servers.push(server);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const port=(server.address() as {port:number}).port;
    const client=new SafeCaptureClient({timeoutMs:20,maxBytes:1024,maxRedirects:0,resolver:async()=>[{address:"93.184.216.34",family:4}],connectionAddress:()=>({address:"127.0.0.1",family:4})});
    await expect(client.capture(`http://fixture.example:${port}/`)).rejects.toMatchObject({code:"timeout"});
  });

  it("rejects non-HTML and an oversized Content-Length before reading the body",async()=>{
    const server=http.createServer((request,response)=>{
      if(request.url==="/json"){response.setHeader("content-type","application/json");response.end("{}");return;}
      response.setHeader("content-type","text/html");response.setHeader("content-length","1000");response.end("short");
    });
    servers.push(server);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const port=(server.address() as {port:number}).port;
    const client=new SafeCaptureClient({timeoutMs:1000,maxBytes:16,maxRedirects:0,resolver:async()=>[{address:"93.184.216.34",family:4}],connectionAddress:()=>({address:"127.0.0.1",family:4})});
    await expect(client.capture(`http://fixture.example:${port}/json`)).rejects.toMatchObject({code:"not_html"});
    await expect(client.capture(`http://fixture.example:${port}/large`)).rejects.toMatchObject({code:"too_large"});
  });

  it.each([
    ["chunked", undefined],
    ["decompressed gzip", "gzip"],
  ])("stops an oversized %s response",async(_name,encoding)=>{
    const original=Buffer.from("x".repeat(128));
    const body=encoding?gzipSync(original):original;
    const server=http.createServer((_request,response)=>{response.setHeader("content-type","text/html");if(encoding)response.setHeader("content-encoding",encoding);response.write(body.subarray(0,2));response.end(body.subarray(2));});
    servers.push(server);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const port=(server.address() as {port:number}).port;
    const client=new SafeCaptureClient({timeoutMs:1000,maxBytes:64,maxRedirects:0,resolver:async()=>[{address:"93.184.216.34",family:4}],connectionAddress:()=>({address:"127.0.0.1",family:4})});
    await expect(client.capture(`http://fixture.example:${port}/`)).rejects.toMatchObject({code:"too_large"});
  });

  it("does not invoke the connection seam when policy validation fails",async()=>{
    let invoked=false;
    const client=new SafeCaptureClient({timeoutMs:100,maxBytes:100,maxRedirects:0,
      resolver:async()=>[{address:"127.0.0.1",family:4}],
      connectionAddress:()=>{invoked=true;return {address:"127.0.0.1",family:4};},
    });
    await expect(client.capture("http://fixture.example/")).rejects.toMatchObject({code:"invalid_url"});
    expect(invoked).toBe(false);
  });
});
