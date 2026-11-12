import { Type, FunctionDeclaration } from "@google/genai";
import { supabase } from "@/lib/supabase";
import {
  GetMyAccountsSchema,
  GetTransactionsSchema,
  GetSpendSummarySchema,
  TransferFundsSchema,
  SetBudgetAlertSchema,
  GetBudgetStatusSchema,
} from "@/lib/schemas";

export const bankingToolDeclarations: FunctionDeclaration[] = [
  {
    name: "getMyAccounts",
    description:
      "Fetch all bank accounts (savings, salary, current), masked account numbers, balances, and account status (active/frozen) for customer B001.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerId: { type: Type.STRING, description: "Customer ID, default B001" },
      },
    },
  },
  {
    name: "getTransactions",
    description:
      "Fetch recent transactions for customer B001, optionally filtered by spending category.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerId: { type: Type.STRING, description: "Customer ID, default B001" },
        category: {
          type: Type.STRING,
          description: "Category filter (Food, Shopping, Utilities, Travel, Transfer)",
        },
        limit: {
          type: Type.NUMBER,
          description: "Number of records to return (default 15)",
        },
      },
    },
  },
  {
    name: "getSpendSummary",
    description:
      "Calculate total debit spending grouped by category for the current or specified month.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerId: { type: Type.STRING, description: "Customer ID, default B001" },
        month: { type: Type.STRING, description: "Month in YYYY-MM format" },
        category: { type: Type.STRING, description: "Specific category name to check" },
      },
    },
  },
  {
    name: "transferFunds",
    description:
      "Atomically transfer money between the customer's own active accounts (e.g. savings to salary). Validates balances, frozen status, and KYC limits.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerId: { type: Type.STRING, description: "Customer ID, default B001" },
        fromAccountType: {
          type: Type.STRING,
          description: "Source account type: savings, salary, or current",
        },
        toAccountType: {
          type: Type.STRING,
          description: "Destination account type: savings, salary, or current",
        },
        amount: { type: Type.NUMBER, description: "Amount in INR to transfer" },
        note: { type: Type.STRING, description: "Optional transfer memo" },
      },
      required: ["fromAccountType", "toAccountType", "amount"],
    },
  },
  {
    name: "setBudgetAlert",
    description:
      "Create or update a monthly spending budget limit and percentage alert threshold for a category.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerId: { type: Type.STRING, description: "Customer ID, default B001" },
        category: {
          type: Type.STRING,
          description: "Category name (e.g., Shopping, Food, Travel, Utilities)",
        },
        monthlyLimit: { type: Type.NUMBER, description: "Monthly spending cap in INR" },
        alertThresholdPct: {
          type: Type.NUMBER,
          description: "Alert percentage threshold (e.g., 75 for 75%)",
        },
      },
      required: ["category", "monthlyLimit"],
    },
  },
  {
    name: "getBudgetStatus",
    description:
      "Check current month spending against configured budget limits and alert thresholds.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerId: { type: Type.STRING, description: "Customer ID, default B001" },
        category: { type: Type.STRING, description: "Optional category name" },
      },
    },
  },
];

function maskAccountNumber(accNum: string) {
  if (!accNum || accNum.length < 4) return "•••• 0000";
  return `•••• ${accNum.slice(-4)}`;
}

export async function executeBankingTool(name: string, rawArgs: unknown) {
  switch (name) {
    case "getMyAccounts": {
      const args = GetMyAccountsSchema.parse(rawArgs ?? {});
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("customer_id", args.customerId)
        .order("id", { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []).map((a) => ({
        id: a.id,
        account_type: a.account_type,
        masked_number: maskAccountNumber(a.account_number || a.id),
        balance: Number(a.balance),
        status: a.status || "active",
      }));
    }

    case "getTransactions": {
      const args = GetTransactionsSchema.parse(rawArgs ?? {});
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("customer_id", args.customerId);
      const accIds = (accounts || []).map((a) => a.id);
      if (accIds.length === 0) return [];

      let query = supabase
        .from("transactions")
        .select("*")
        .in("account_id", accIds)
        .order("created_at", { ascending: false })
        .limit(args.limit);

      if (args.category) {
        query = query.ilike("category", args.category);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    }

    case "getSpendSummary": {
      const args = GetSpendSummarySchema.parse(rawArgs ?? {});
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("customer_id", args.customerId);
      const accIds = (accounts || []).map((a) => a.id);
      if (accIds.length === 0) return { total_spend: 0, by_category: {} };

      let query = supabase
        .from("transactions")
        .select("category, amount, type, created_at")
        .in("account_id", accIds)
        .eq("type", "debit");

      if (args.category) {
        query = query.ilike("category", args.category);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const summary: Record<string, number> = {};
      let total = 0;
      for (const tx of data || []) {
        if ((tx.category || "").toLowerCase() === "transfer") continue;
        const cat = tx.category || "Other";
        summary[cat] = (summary[cat] || 0) + Number(tx.amount);
        total += Number(tx.amount);
      }
      return { total_spend: total, by_category: summary };
    }

    case "transferFunds": {
      const args = TransferFundsSchema.parse(rawArgs);
      const { data: accounts, error: accErr } = await supabase
        .from("accounts")
        .select("*")
        .eq("customer_id", args.customerId);
      if (accErr) throw new Error(accErr.message);

      const fromAcc = accounts?.find(
        (a) => a.account_type.toLowerCase() === args.fromAccountType.toLowerCase()
      );
      const toAcc = accounts?.find(
        (a) => a.account_type.toLowerCase() === args.toAccountType.toLowerCase()
      );

      if (!fromAcc || !toAcc) {
        return {
          success: false,
          error: "Could not locate one of the specified account types for this customer.",
        };
      }

      const { data, error } = await supabase.rpc("transfer_funds", {
        p_customer_id: args.customerId,
        p_from_account_id: fromAcc.id,
        p_to_account_id: toAcc.id,
        p_amount: args.amount,
        p_note: args.note,
      });

      if (error) return { success: false, error: error.message };
      return data;
    }

    case "setBudgetAlert": {
      const args = SetBudgetAlertSchema.parse(rawArgs);
      const normalizedCat =
        args.category.charAt(0).toUpperCase() + args.category.slice(1).toLowerCase();

      const { data: existing } = await supabase
        .from("budgets")
        .select("id")
        .eq("customer_id", args.customerId)
        .ilike("category", normalizedCat)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("budgets")
          .update({
            monthly_limit: args.monthlyLimit,
            alert_threshold_pct: args.alertThresholdPct,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return { updated: true, budget: data };
      } else {
        const { data, error } = await supabase
          .from("budgets")
          .insert({
            customer_id: args.customerId,
            category: normalizedCat,
            monthly_limit: args.monthlyLimit,
            alert_threshold_pct: args.alertThresholdPct,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return { created: true, budget: data };
      }
    }

    case "getBudgetStatus": {
      const args = GetBudgetStatusSchema.parse(rawArgs ?? {});
      let budgetQuery = supabase
        .from("budgets")
        .select("*")
        .eq("customer_id", args.customerId);
      if (args.category) {
        budgetQuery = budgetQuery.ilike("category", args.category);
      }
      const { data: budgets, error } = await budgetQuery;
      if (error) throw new Error(error.message);

      const spendData = (await executeBankingTool("getSpendSummary", {
        customerId: args.customerId,
      })) as { by_category: Record<string, number> };

      return (budgets || []).map((b) => {
        const matchedKey = Object.keys(spendData.by_category).find(
          (k) => k.toLowerCase() === b.category.toLowerCase()
        );
        const spent = matchedKey ? spendData.by_category[matchedKey] : 0;
        const limit = Number(b.monthly_limit);
        const threshold = Number(b.alert_threshold_pct || 80);
        const pctUsed = limit > 0 ? Math.round((spent / limit) * 100) : 0;
        return {
          category: b.category,
          monthly_limit: limit,
          spent,
          remaining: Math.max(0, limit - spent),
          percent_used: pctUsed,
          alert_threshold_pct: threshold,
          status:
            pctUsed >= 100
              ? "OVER_BUDGET"
              : pctUsed >= threshold
              ? "ALERT_TRIGGERED"
              : "ON_TRACK",
        };
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
