import { z } from "zod";

export const GetMyAccountsSchema = z.object({
  customerId: z.string().default("B001"),
});

export const GetTransactionsSchema = z.object({
  customerId: z.string().default("B001"),
  category: z
    .string()
    .optional()
    .describe("Filter by category e.g. Food, Shopping, Utilities, Travel, Transfer"),
  limit: z.number().int().min(1).max(50).default(15),
});

export const GetSpendSummarySchema = z.object({
  customerId: z.string().default("B001"),
  month: z.string().optional().describe("YYYY-MM format, defaults to current month"),
  category: z.string().optional().describe("Optional specific category to summarize"),
});

export const TransferFundsSchema = z.object({
  customerId: z.string().default("B001"),
  fromAccountType: z
    .enum(["savings", "salary", "current"])
    .describe("Source account type"),
  toAccountType: z
    .enum(["savings", "salary", "current"])
    .describe("Destination account type"),
  amount: z.number().positive().describe("Amount in INR to transfer"),
  note: z.string().max(100).optional().default("Self transfer via PayWise AI"),
});

export const SetBudgetAlertSchema = z.object({
  customerId: z.string().default("B001"),
  category: z
    .string()
    .min(2)
    .describe("Expense category e.g. Shopping, Food, Entertainment, Utilities, Travel"),
  monthlyLimit: z.number().positive().describe("Monthly budget cap in INR"),
  alertThresholdPct: z
    .number()
    .min(10)
    .max(100)
    .default(80)
    .describe("Percentage threshold (10-100) to trigger alert"),
});

export const GetBudgetStatusSchema = z.object({
  customerId: z.string().default("B001"),
  category: z
    .string()
    .optional()
    .describe("Specific category to check, or omit for all budgets"),
});
