# PayWise: Smart Banking Assistant
Team <number> | PS8 | SRM Agentic AI Hackathon

## The problem
Retail bank customers flood call centers and branches for routine tasks like checking balances, analyzing monthly category spend, moving money between their own accounts, and configuring spending limits. Standard chatbots fail because they hallucinate balances or lack atomic transaction safeguards.

## What our app does
- **Autonomous Multi-Tool Banking Agent:** Uses Gemini Function Calling with strict Zod validation to chain read and write tools across Supabase.
- **Atomic Self-Account Transfers:** Executes `transfer_funds()` in PostgreSQL to enforce active account checks, balance sufficiency, and KYC per-transfer/daily limits.
- **Proactive Budget Guardrails:** Tracks category spending against monthly caps and surfaces live alert banners when thresholds (e.g. 75% or 80%) are breached.
- **Transparent Execution Trace:** Displays real-time tool invocation badges and latencies above every agent response while syncing dashboard balances immediately.
- **Strict Banking Compliance:** Masks all account numbers and blocks PIN/OTP requests or investment advice.

## Live demo
Vercel link: <your-vercel-link>
Passcode: srm2026
Try this prompt: "How much did I spend on food this month, and am I over my budget?"

## Agent tools
| Tool | What it does | Reads or writes |
| --- | --- | --- |
| `getMyAccounts` | Fetches customer B001 accounts, masked numbers, balances, and active/frozen status | Reads |
| `getTransactions` | Lists recent ledger transactions with optional category filtering | Reads |
| `getSpendSummary` | Aggregates monthly debit expenses grouped by category | Reads |
| `transferFunds` | Atomically transfers funds between active self-accounts via Supabase RPC | Writes |
| `setBudgetAlert` | Creates or updates monthly budget caps and alert percentage thresholds | Writes |
| `getBudgetStatus` | Compares live category spending against configured monthly budgets | Reads |

## Database tables
- `customers`: Stores customer profile (`B001`, Rohan Iyer) and KYC tier (`FULL`).
- `accounts`: Stores savings, salary, and current accounts, balances, and `active`/`frozen` status.
- `transfer_limits`: Defines `per_transfer_limit` and `daily_limit` per KYC level.
- `transactions`: Records debit and credit ledger entries across accounts.
- `budgets`: Stores monthly spending limits and alert percentage thresholds per category.

## Tech stack
Next.js, React, TypeScript, Tailwind CSS, Supabase, Gemini API (function calling), Zod, Vercel


## Run it locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the keys
3. `npm run dev`
