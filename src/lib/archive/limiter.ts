export class ImmediateSemaphore {
  private active = 0;
  constructor(private readonly limit: number) { if (!Number.isInteger(limit) || limit < 1) throw new Error("limit must be positive"); }
  tryAcquire(): (() => void) | null {
    if (this.active >= this.limit) return null;
    this.active += 1; let released = false;
    return () => { if (!released) { released = true; this.active -= 1; } };
  }
}
