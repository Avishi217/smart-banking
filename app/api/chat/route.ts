import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runBankingAgent } from "@/lib/agent/orchestrator";

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(z.any()).optional().default([]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history } = ChatRequestSchema.parse(body);
    const result = await runBankingAgent(message, history);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Invalid request" },
      { status: 400 }
    );
  }
}
