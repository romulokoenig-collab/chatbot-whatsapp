import { describe, it, expect } from "vitest";
import { normalizePhone } from "../utils/normalize-phone.js";

describe("normalizePhone", () => {
  it("strips + prefix", () => {
    expect(normalizePhone("+5551999999999")).toBe("5551999999999");
  });

  it("strips spaces and dashes", () => {
    expect(normalizePhone("55 51 99999-9999")).toBe("5551999999999");
  });

  it("returns already clean number unchanged", () => {
    expect(normalizePhone("5551999999999")).toBe("5551999999999");
  });
});
