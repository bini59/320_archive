import {describe,expect,it} from "vitest"; import {ImmediateSemaphore} from "./limiter";
describe("ImmediateSemaphore",()=>{it("rejects rather than queues excess work",()=>{const semaphore=new ImmediateSemaphore(1);const release=semaphore.tryAcquire();expect(release).not.toBeNull();expect(semaphore.tryAcquire()).toBeNull();release!();expect(semaphore.tryAcquire()).not.toBeNull();});});
