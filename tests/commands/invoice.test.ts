// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { daysFromPaymentTerms } from "../../src/commands/invoice.js";

describe("daysFromPaymentTerms", () => {
  it("parses Net terms", () => {
    expect(daysFromPaymentTerms("Net 30")).toBe(30);
    expect(daysFromPaymentTerms("Net 7")).toBe(7);
    expect(daysFromPaymentTerms("net 15")).toBe(15);
  });
  it("returns 0 for due on receipt", () => {
    expect(daysFromPaymentTerms("Due on receipt")).toBe(0);
    expect(daysFromPaymentTerms("due on receipt")).toBe(0);
  });
  it("falls back to 30 for anything else", () => {
    expect(daysFromPaymentTerms("weird")).toBe(30);
    expect(daysFromPaymentTerms("")).toBe(30);
  });
});
