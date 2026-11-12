"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight } from "lucide-react";

export default function PasscodeLoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Incorrect team passcode.");
      }
    } catch {
      setError("Failed to verify passcode.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-stone-200 p-7 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-[#047857] text-white flex items-center justify-center font-semibold mb-4">
          PW
        </div>
        <h1 className="text-xl font-semibold text-stone-900 tracking-tight">
          PayWise Smart Banking
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Enter your team workspace passcode to access Customer B001.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Workspace Passcode
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter APP_PASSCODE"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-stone-300 bg-[#FAF9F6] focus:outline-none focus:border-[#047857]"
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-[#047857] hover:bg-emerald-800 text-white text-sm font-medium flex items-center justify-center gap-2 transition"
          >
            <span>{loading ? "Verifying..." : "Unlock Workspace"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-stone-100 flex items-center gap-2 text-xs text-stone-500">
          <ShieldCheck className="w-4 h-4 text-[#047857]" />
          <span>SRM Agentic AI Hackathon • PS8</span>
        </div>
      </div>
    </div>
  );
}
