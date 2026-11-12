import { GoogleGenAI } from "@google/genai";
import { bankingToolDeclarations, executeBankingTool } from "./tools";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const SYSTEM_PROMPT = `You are PayWise AI, a smart retail banking assistant serving logged-in customer Rohan Iyer (ID: B001).
You have access to banking tools: getMyAccounts, getTransactions, getSpendSummary, transferFunds, setBudgetAlert, and getBudgetStatus.

STRICT RULES:
1. ALWAYS use your tools to read live balances, transactions, or budgets before answering. Never guess numbers.
2. When asked about spending vs budget (e.g. "How much did I spend on food and am I over budget?"), call BOTH getSpendSummary and getBudgetStatus.
3. For transfers, use transferFunds. Never allow transfers from frozen accounts or external third-party accounts.
4. SECURITY & COMPLIANCE: NEVER ask for, display, or confirm a PIN, password, OTP, CVV, or full unmasked account number. NEVER provide stock tips, mutual fund picks, or investment advice. Politely decline if asked.
5. Format currency clearly in Indian Rupees (₹) with commas (e.g., ₹20,000). Keep answers concise, accurate, and reassuring.`;

export interface ToolTrace {
  tool: string;
  args: Record<string, unknown>;
  status: "success" | "error";
  durationMs: number;
}

export async function runBankingAgent(userMessage: string, history: any[] = []) {
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const traces: ToolTrace[] = [];
  let didMutateDatabase = false;

  const contents = [
    ...history,
    { role: "user", parts: [{ text: userMessage }] },
  ];

  for (let round = 0; round < 5; round++) {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: bankingToolDeclarations }],
        temperature: 0.1,
      },
    });

    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      return {
        reply: response.text || "I completed your request.",
        traces,
        didMutateDatabase,
      };
    }

    if (response.candidates?.[0]?.content) {
      contents.push(response.candidates[0].content);
    }

    const functionResponses = await Promise.all(
      functionCalls.map(async (call) => {
        const start = Date.now();
        const toolName = call.name!;
        const toolArgs = (call.args as Record<string, unknown>) || {};

        if (toolName === "transferFunds" || toolName === "setBudgetAlert") {
          didMutateDatabase = true;
        }

        try {
          const result = await executeBankingTool(toolName, toolArgs);
          traces.push({
            tool: toolName,
            args: toolArgs,
            status: "success",
            durationMs: Date.now() - start,
          });
          return {
            functionResponse: {
              name: toolName,
              response: { result },
            },
          };
        } catch (err: any) {
          traces.push({
            tool: toolName,
            args: toolArgs,
            status: "error",
            durationMs: Date.now() - start,
          });
          return {
            functionResponse: {
              name: toolName,
              response: { error: err.message || "Tool validation failed" },
            },
          };
        }
      })
    );

    contents.push({
      role: "user",
      parts: functionResponses,
    });
  }

  return {
    reply: "I reached the maximum reasoning steps. Please try a simpler request.",
    traces,
    didMutateDatabase,
  };
}
