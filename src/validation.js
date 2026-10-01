import { toMinor } from "./money.js";

export class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.status = 400;
  }
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

  const description = String(input.description ?? "").trim();
  if (description.length === 0) {
    throw new ValidationError("description", "A description is required.");
  }
  if (description.length > 140) {
    throw new ValidationError("description", "Description must be 140 characters or fewer.");
  }

  const amountMinor = toMinor(input.amount);
  if (amountMinor === null) {
    throw new ValidationError("amount", "Amount must be a number.");
  }
  if (amountMinor < 0) {
    throw new ValidationError("amount", "Negative numbers are not allowed.");
  }

  if (!memberIds.includes(input.paidBy)) {
    throw new ValidationError("paidBy", "The payer must be a member of this group.");
  }

  const participants = Array.isArray(input.participants) ? input.participants : [];
  if (participants.length === 0) {
    throw new ValidationError("participants", "At least one participant is required.");
  }
  for (const p of participants) {
    if (!memberIds.includes(p)) {
      throw new ValidationError("participants", `${p} is not a member of this group.`);
    }
  }

  return { description, amountMinor, paidBy: input.paidBy, participants };
}
