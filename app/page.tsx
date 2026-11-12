"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  AlertTriangle,
  Send,
  Sparkles,
  Wallet,
  PieChart,
  ListFilter,
  Lock,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface Account {
  id: string;
  account_type: string;
  masked_number: string;
  balance: number;
  status: string;
}

interface Transaction {
  id: string;
  account_id: string;
  amount: number;
  type: "debit" | "credit";
  category: string;
  merchant: string;
  description: string;
  created_at: string;
}

interface BudgetStatus {
  category: string;
  monthly_limit: number;
  spent: number;
  remaining: number;
  percent_used: number;
  alert_threshold_pct: number;
  status: "ON_TRACK" | "ALERT_TRIGGERED" | "OVER_BUDGET";
}

interface ToolTrace {
  tool: string;
  args: Record<string, unknown>;
  status: "success" | "error";
  durationMs: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  traces?: ToolTrace[];
}

const DEMO_PROMPTS = [
  "How much did I spend on food this month, and am I over my budget?",
  "Move 20,000 from savings to my salary account.",
  "Set a 4,000 rupee monthly budget for shopping and alert me at 75%.",
  "Show my active accounts and frozen status.",
];

export default function PayWiseBankingApp() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [spendByCategory, setSpendByCategory] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "budgets">("overview");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Good afternoon, Rohan. I can check your balances, break down category spending, move funds between your active accounts, or configure budget alerts. How can I help?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchBankingState = async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "Database connection pending. Run seed SQL in Supabase.");
        return;
      }
      if (data.accounts) setAccounts(data.accounts);
      if (data.transactions) setTransactions(data.transactions);
      if (data.budgets) setBudgets(data.budgets);
      if (data.spendSummary?.by_category) setSpendByCategory(data.spendSummary.by_category);
    } catch {
      setLoadError("Unable to reach /api/state. Check .env.local keys.");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBankingState();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (promptText?: string) => {
    const textToSend = (promptText ?? input).trim();
    if (!textToSend || isSending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: textToSend }]);
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend }),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply || data.error || "Unable to process request.",
          traces: data.traces || [],
        },
      ]);

      if (data.didMutateDatabase) {
        await fetchBankingState();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Network error reaching banking agent." },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const triggeredAlerts = budgets.filter((b) => b.status !== "ON_TRACK");
  const totalLiquidBalance = accounts
    .filter((a) => a.status !== "frozen")
    .reduce((sum, a) => sum + a.balance, 0);

  const categories = ["All", ...Array.from(new Set(transactions.map((t) => t.category)))];
  const filteredTransactions =
    selectedCategory === "All"
      ? transactions
      : transactions.filter((t) => t.category.toLowerCase() === selectedCategory.toLowerCase());

  const totalSpend = Object.values(spendByCategory).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111827] font-sans antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#047857] text-white flex items-center justify-center font-semibold tracking-tight">
              PW
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight text-stone-900">
                  PayWise
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-[#047857] border border-emerald-200">
                  Smart Banking
                </span>
              </div>
              <p className="text-xs text-stone-500">Customer B001 • Rohan Iyer (Full KYC)</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-stone-600 bg-stone-100 px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
              <span>256-bit Guarded Session</span>
            </div>
            <button
              onClick={fetchBankingState}
              className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 transition"
              title="Refresh balances"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Setup Warning Banner if Supabase is not seeded yet */}
      {loadError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-xs text-rose-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span>Setup notice: {loadError}</span>
            <button onClick={fetchBankingState} className="underline font-semibold">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Proactive Budget Alert Banner */}
      {triggeredAlerts.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Budget Alert:{" "}
                {triggeredAlerts
                  .map(
                    (a) =>
                      `${a.category} is at ${a.percent_used}% (₹${a.spent.toLocaleString(
                        "en-IN"
                      )} / ₹${a.monthly_limit.toLocaleString("en-IN")})`
                  )
                  .join(" • ")}
              </span>
            </div>
            <button
              onClick={() => setActiveTab("budgets")}
              className="underline font-semibold hover:text-amber-950"
            >
              Review Budgets
            </button>
          </div>
        </div>
      )}

      {/* Main Split Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Liquid Balance Summary & Account Cards */}
          <section className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-stone-100">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  Available Liquid Balance
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-stone-900 tabular-nums mt-1">
                  ₹{totalLiquidBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </h1>
              </div>
              <span className="text-xs text-stone-500">
                Excludes frozen accounts from active liquidity
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {accounts.map((acc) => {
                const isFrozen = acc.status === "frozen";
                return (
                  <div
                    key={acc.id}
                    className={`rounded-lg border p-3.5 transition ${
                      isFrozen
                        ? "bg-stone-50 border-stone-200 opacity-80"
                        : "bg-[#FAF9F6] border-stone-200 hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-stone-700">
                        {acc.account_type}
                      </span>
                      {isFrozen ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          <Lock className="w-3 h-3" /> Frozen
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-[#047857]">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-semibold text-stone-900 tabular-nums mt-2">
                      ₹{acc.balance.toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs text-stone-500 font-mono mt-1">{acc.masked_number}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-stone-200">
            {[
              { id: "overview", label: "Spend & Budgets", icon: PieChart },
              { id: "transactions", label: "Transactions", icon: ListFilter },
              { id: "budgets", label: "Budget Alerts", icon: Wallet },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                    active
                      ? "border-[#047857] text-[#047857]"
                      : "border-transparent text-stone-500 hover:text-stone-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* VIEW 1: Spend Breakdown + Budgets */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-stone-900">Monthly Spend Breakdown</h2>
                  <span className="text-xs font-medium text-stone-500 tabular-nums">
                    Total: ₹{totalSpend.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="space-y-3.5">
                  {Object.entries(spendByCategory).map(([cat, amount]) => {
                    const pct = totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-stone-700">{cat}</span>
                          <span className="text-stone-600 tabular-nums">
                            ₹{amount.toLocaleString("en-IN")} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#047857] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(spendByCategory).length === 0 && (
                    <p className="text-xs text-stone-400">No debit transactions recorded yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-stone-900">Budget Guardrails</h2>
                  <span className="text-xs text-stone-500">{budgets.length} active</span>
                </div>
                <div className="space-y-4">
                  {budgets.map((b) => {
                    const barColor =
                      b.status === "OVER_BUDGET"
                        ? "bg-rose-600"
                        : b.status === "ALERT_TRIGGERED"
                        ? "bg-amber-500"
                        : "bg-[#047857]";
                    return (
                      <div key={b.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-800">{b.category}</span>
                          <span className="tabular-nums text-stone-600">
                            ₹{b.spent.toLocaleString("en-IN")} / ₹
                            {b.monthly_limit.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barColor} rounded-full transition-all duration-500`}
                            style={{ width: `${Math.min(100, b.percent_used)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-stone-500">
                          <span>Alert at {b.alert_threshold_pct}%</span>
                          <span className="font-medium">{b.percent_used}% used</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: Transactions */}
          {activeTab === "transactions" && (
            <section className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-sm font-semibold text-stone-900">Recent Ledger</h2>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                        selectedCategory === cat
                          ? "bg-stone-900 text-white"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-stone-100">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.type === "credit"
                            ? "bg-emerald-50 text-[#047857]"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {tx.type === "credit" ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-900">
                          {tx.merchant || tx.description}
                        </p>
                        <p className="text-xs text-stone-500">
                          {tx.category} •{" "}
                          {new Date(tx.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        tx.type === "credit" ? "text-[#047857]" : "text-stone-900"
                      }`}
                    >
                      {tx.type === "credit" ? "+" : "-"}₹
                      {Number(tx.amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* VIEW 3: Full Budgets Table */}
          {activeTab === "budgets" && (
            <section className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs space-y-4">
              <h2 className="text-sm font-semibold text-stone-900">Configured Monthly Budgets</h2>
              {budgets.map((b) => (
                <div key={b.category} className="p-4 rounded-lg border border-stone-200 bg-[#FAF9F6]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-stone-900">{b.category}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-white border border-stone-200">
                      {b.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-[#047857] transition-all"
                      style={{ width: `${Math.min(100, b.percent_used)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-stone-600 tabular-nums">
                    <span>Spent: ₹{b.spent.toLocaleString("en-IN")}</span>
                    <span>Remaining: ₹{b.remaining.toLocaleString("en-IN")}</span>
                    <span>Cap: ₹{b.monthly_limit.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>

        {/* RIGHT COLUMN (5 cols): Autonomous Gemini Banking Agent */}
        <div className="lg:col-span-5">
          <section className="bg-white rounded-xl border border-stone-200 shadow-2xs flex flex-col h-[640px]">
            <div className="px-4 py-3.5 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#047857]" />
                <h2 className="text-sm font-semibold text-stone-900">PayWise AI Assistant</h2>
              </div>
              <span className="text-[11px] font-medium text-stone-500">
                Gemini Function Calling
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF9F6]/60">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    m.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {m.traces && m.traces.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1.5 max-w-[90%]">
                      {m.traces.map((t, tIdx) => (
                        <span
                          key={tIdx}
                          className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-[#047857] border border-emerald-200"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {t.tool}() • {t.durationMs}ms
                        </span>
                      ))}
                    </div>
                  )}

                  <div
                    className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-stone-900 text-white"
                        : "bg-white border border-stone-200 text-stone-800 shadow-2xs"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="text-xs text-stone-500 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#047857]" />
                  <span>Agent querying Supabase tools...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="px-3 py-2 border-t border-stone-100 bg-white flex gap-1.5 overflow-x-auto">
              {DEMO_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  disabled={isSending}
                  className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-stone-100 hover:bg-emerald-50 hover:text-[#047857] text-stone-700 border border-stone-200 transition"
                >
                  {prompt.length > 38 ? prompt.slice(0, 38) + "..." : prompt}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="p-3 border-t border-stone-200 bg-white rounded-b-xl flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about spending, budgets, or transfer funds..."
                className="flex-1 text-sm px-3.5 py-2 rounded-lg border border-stone-300 bg-[#FAF9F6] focus:outline-none focus:border-[#047857]"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="px-4 py-2 rounded-lg bg-[#047857] hover:bg-emerald-800 disabled:opacity-40 text-white text-sm font-medium flex items-center gap-1.5 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
