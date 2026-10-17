import { toMinor } from "./money.js";
import { BASE_CURRENCY, convertToBase, supportedCurrencies } from "./exchange.js";
import { SPLIT_TYPES, weighted } from "./splits.js";

export class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.status = 400;
  }
}

export const CATEGORIES = ["food", "travel", "stay", "entertainment", "other"];

export function validateDescription(raw) {
  const description = String(raw ?? "").trim();
  if (description.length === 0) {
    throw new ValidationError("description", "A description is required.");
  }
  if (description.length > 140) {
    throw new ValidationError("description", "Description must be 140 characters or fewer.");
  }
  return description;
}

export function validateCategory(raw) {
  if (raw === undefined || raw === null || raw === "") return "other";
  const category = String(raw).trim().toLowerCase();
  if (!CATEGORIES.includes(category)) {
    throw new ValidationError("category", `Category must be one of: ${CATEGORIES.join(", ")}.`);
  }
  return category;
}

export function normalizeCurrencyCode(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

export function validateCurrencyCode(raw) {
  const currency = normalizeCurrencyCode(raw);
  if (currency.length !== 3) {
    throw new ValidationError("currency", "Currency must be a 3-letter code.");
  }
  if (!supportedCurrencies().includes(currency)) {
    throw new ValidationError("currency", `Unsupported currency: ${currency}.`);
  }
  return currency;
}

/**
 * Validate how an expense is divided. `originalMinor` is the total in the
 * currency it was entered in; the returned details are in base-currency minor
 * units for `exact`, and as entered for `percent` and `shares`.
 */
function validateSplit(input, participants, originalMinor, baseMinor) {
  const splitType = input.splitType === undefined || input.splitType === "" ? "equal" : input.splitType;
  if (!SPLIT_TYPES.includes(splitType)) {
    throw new ValidationError("splitType", `Split type must be one of: ${SPLIT_TYPES.join(", ")}.`);
  }
  if (splitType === "equal") return { splitType, splitDetails: undefined };

  const raw = input.splitDetails;
  if (!raw || typeof raw !== "object") {
    throw new ValidationError("splitDetails", "Split details are required for this split type.");
  }
  for (const p of participants) {
    if (raw[p] === undefined || raw[p] === null || raw[p] === "") {
      throw new ValidationError("splitDetails", `A value is required for ${p}.`);
    }
  }

  if (splitType === "exact") {
    const entered = participants.map((p) => toMinor(raw[p]));
    if (entered.some((v) => v === null)) {
      throw new ValidationError("splitDetails", "Exact amounts must be numbers.");
    }
    if (entered.reduce((a, b) => a + b, 0) !== originalMinor) {
      throw new ValidationError("splitDetails", "Exact amounts must add up to the total.");
    }
    const inBase = weighted(baseMinor, entered);
    return { splitType, splitDetails: Object.fromEntries(participants.map((p, i) => [p, inBase[i]])) };
  }

  if (splitType === "percent") {
    const pct = participants.map((p) => Number(raw[p]));
    if (pct.some((v) => !Number.isFinite(v) || v < 0)) {
      throw new ValidationError("splitDetails", "Percentages must be numbers.");
    }
    // Compared in hundredths of a percent so 33.33 + 33.33 + 33.34 is exactly 100.
    if (pct.reduce((a, b) => a + Math.round(b * 100), 0) !== 10000) {
      throw new ValidationError("splitDetails", "Percentages must add up to 100.");
    }
    return { splitType, splitDetails: Object.fromEntries(participants.map((p, i) => [p, pct[i]])) };
  }

  const weights = participants.map((p) => Number(raw[p]));
  if (weights.some((v) => !Number.isInteger(v) || v <= 0)) {
    throw new ValidationError("splitDetails", "Shares must be whole numbers greater than zero.");
  }
  return { splitType, splitDetails: Object.fromEntries(participants.map((p, i) => [p, weights[i]])) };
}

/**
 * Validate an incoming expense against a group's member list.
 * Throws ValidationError with the offending field named, so the API can return
 * something a user can act on rather than "invalid request".
 */
export function validateExpense(input, memberIds) {
  if (!input || typeof input !== "object") {
    throw new ValidationError("body", "An expense object is required.");
  }

  const description = validateDescription(input.description);

  const originalMinor = toMinor(input.amount);
  if (originalMinor === null) {
    throw new ValidationError("amount", "Amount must be a number.");
  }
  if (originalMinor < 0) {
    throw new ValidationError("amount", "Negative numbers are not allowed.");
  }

  if (!memberIds.includes(input.paidBy)) {
    throw new ValidationError("paidBy", "The payer must be a member of this group.");
  }

  const participants = Array.isArray(input.participants) ? input.participants : [];
  if (participants.length === 0) {
    throw new ValidationError("participants", "At least one participant is required.");
  }

  const uniqueParticipants = new Set();
  for (const p of participants) {
    if (uniqueParticipants.has(p)) {
      throw new ValidationError("participants", "Duplicate participants are not allowed.");
    }
    uniqueParticipants.add(p);
    if (!memberIds.includes(p)) {
      throw new ValidationError("participants", `${p} is not a member of this group.`);
    }
  }

  const category = validateCategory(input.category);

  const currency = validateCurrencyCode(input.currency ?? BASE_CURRENCY);
  const amountMinor = convertToBase(originalMinor, currency);

  const { splitType, splitDetails } = validateSplit(input, participants, originalMinor, amountMinor);

  return {
    description,
    amountMinor,
    paidBy: input.paidBy,
    participants,
    category,
    splitType,
    splitDetails,
    original: { amountMinor: originalMinor, currency },
  };
}
