# QuikSplit

A shared expense splitter. Add what people spent; get back who owes whom.

Built as the pilot application for QuikPilot — small enough to read in one
sitting, real enough that its bugs are the kind people actually file.

## Running it

```bash
npm install
npm start          # http://localhost:3300
npm test           # vitest
```

## Design notes

**Money is integer minor units everywhere.** Floating point is never used for a
balance: `0.1 + 0.2 !== 0.3` is not an acceptable property for a ledger, and
every bug of that shape arrives as a rounding complaint rather than a bug report.

**Splits distribute their remainder** rather than dropping it. `splitEvenly`
hands out the odd unit to the earliest participants, so parts always sum to the
total — a split that does not sum to its total is a ledger that never balances.

**`assertBalanced` exists rather than a comment.** Every unit one person is owed
is a unit another owes, so balances must sum to zero. A non-zero sum means money
was created or destroyed.

**Splits come in four kinds.** Equal, exact amounts, percentages and shares.
Whatever the kind, the parts handed back always sum to the expense's total.

**Deleting is soft.** A deleted expense stays on record with a `deletedAt`
time, so ids stay unique and an accidental delete can be traced.

**Other currencies are converted once, at entry,** at a fixed rate into the
group's base currency (INR). The amount as entered is kept beside it.

## What it does

- Groups with members; add and remove members.
- Expenses with a category, in any supported currency, split four ways.
- Edit an expense's description, category or amount; delete one.
- Record a payment between members; settle-up suggests who pays whom.
- Spending by category, and what each member paid and owes.
- A filterable, paged expense history.

## Layout

```
src/money.js        parsing, rendering, equal splitting — integer minor units
src/splits.js       the four split kinds
src/exchange.js     fixed rates and currency conversion
src/validation.js   incoming expense validation, per-field errors
src/ledger.js       balances, payments, edits, members, settle-up
src/reports.js      category totals and per-member summary
src/history.js      filtered, paged expense history
src/store.js        in-memory groups (one process, one dataset)
src/server.js       HTTP API + static UI
public/index.html   the UI
```
