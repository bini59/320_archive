import http from "node:http";
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
