import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { passcode } = await req.json();
  const expected = process.env.APP_PASSCODE || "srm2026";

  if (passcode === expected) {
    const res = NextResponse.json({ authenticated: true });
    res.cookies.set("paywise_passcode", expected, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return res;
  }

  return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
}
