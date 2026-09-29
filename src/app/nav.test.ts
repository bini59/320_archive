import { describe, expect, it } from "vitest";
import { activeNavId } from "./nav";

describe("activeNavId", () => {
  it("maps routes to one sidebar item", () => {
    expect(activeNavId("/")).toBe("register");
    expect(activeNavId("/archives")).toBe("archives");
    expect(activeNavId("/archives/123")).toBe("archives");
    expect(activeNavId("/library")).toBe("library");
    expect(activeNavId("/library/abc")).toBe("folder:abc");
    expect(activeNavId("/settings")).toBe("settings");
  });
});
