import { describe, expect, it } from "vitest";

import { fieldErrors, opportunitySchema, quoteSchema, webEnquirySchema } from "./validation";

describe("opportunity form", () => {
  it("reports every missing field at once", () => {
    const res = opportunitySchema.safeParse({ nextActionTitle: "", nextActionDue: "" });
    expect(res.success).toBe(false);
    const errors = fieldErrors(res.error!);
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(["clientId", "contactId", "productId", "source", "ownerId", "segment"]));
  });

  it("accepts a new client with pounds input", () => {
    const res = opportunitySchema.parse({
      newClientName: "Harrow Lane Surgery",
      newContactName: "Practice Manager",
      segment: "end_user_contractor",
      productId: "a".repeat(24),
      source: "phone",
      ownerId: "b".repeat(24),
      valueLow: "£12,000",
      valueHigh: "16000",
      nextActionTitle: "Book survey",
      nextActionDue: "2026-10-15",
    });
    expect(res.valueLow).toBe(1_200_000);
    expect(res.quantity).toBe(1);
    expect(res.clientId).toBeUndefined();
  });
});

describe("quote options", () => {
  it("parses one option per line", () => {
    const res = quoteSchema.parse({ total: "38,450", options: "Automatic doors | 3200\nWarranty | 1,300" });
    expect(res.options).toEqual([
      { label: "Automatic doors", pence: 320_000 },
      { label: "Warranty", pence: 130_000 },
    ]);
  });

  it("rejects malformed options", () => {
    expect(quoteSchema.safeParse({ total: "100", options: "Doors" }).success).toBe(false);
  });
});

describe("web enquiry", () => {
  it("accepts a minimal enquiry and ignores an unknown segment", () => {
    const res = webEnquirySchema.parse({ name: "Mrs Okafor", phone: "07700 900000", segment: "nonsense", email: "" });
    expect(res.segment).toBeUndefined();
    expect(res.email).toBeUndefined();
  });
});
