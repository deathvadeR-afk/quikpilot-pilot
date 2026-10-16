import { describe, it, expect } from "vitest";
import { BASE_CURRENCY, convertToBase, supportedCurrencies } from "./exchange.js";

describe("convertToBase", () => {
  it("leaves base-currency amounts alone", () => {
    expect(BASE_CURRENCY).toBe("INR");
    expect(convertToBase(12345, "INR")).toBe(12345);
    expect(convertToBase(12345)).toBe(12345);
  });

  it("converts a foreign amount at the fixed rate", () => {
    expect(convertToBase(10000, "USD")).toBe(832000);
    expect(convertToBase(10000, "EUR")).toBe(905000);
  });

  it("rounds to a whole minor unit", () => {
    expect(Number.isInteger(convertToBase(333, "GBP"))).toBe(true);
  });

  it("lists the currencies it can convert", () => {
    expect(supportedCurrencies()).toEqual(["INR", "USD", "EUR", "GBP", "AED"]);
  });

  it("[QP-QUIKSPL-255-1] converts expense amount when lowercase currency code is supplied", () => {
    expect(convertToBase(10000, "usd")).toBe(832000);
  });

  it("[QP-QUIKSPL-255-2] converts expense amount when mixed case currency code is supplied", () => {
    expect(convertToBase(10000, "Usd")).toBe(832000);
  });
});
