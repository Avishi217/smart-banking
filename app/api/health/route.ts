import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
    passcodeConfigured: Boolean(process.env.APP_PASSCODE),
  });
}
