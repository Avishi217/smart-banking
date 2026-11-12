import { NextResponse } from "next/server";
import { executeBankingTool } from "@/lib/agent/tools";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [accounts, transactions, spendSummary, budgets] = await Promise.all([
      executeBankingTool("getMyAccounts", { customerId: "B001" }),
      executeBankingTool("getTransactions", { customerId: "B001", limit: 30 }),
      executeBankingTool("getSpendSummary", { customerId: "B001" }),
      executeBankingTool("getBudgetStatus", { customerId: "B001" }),
    ]);

    return NextResponse.json({
      customer: { id: "B001", name: "Rohan Iyer", kycLevel: "Full KYC" },
      accounts,
      transactions,
      spendSummary,
      budgets,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
