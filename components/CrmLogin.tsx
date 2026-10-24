"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";

export default function CrmLogin() {
  return (
    <Link
      href="/crm"
      className="inline-flex min-h-11 items-center gap-1.5 border border-[#D4AF37]/30 px-2.5 text-[9px] uppercase tracking-[0.16em] text-[#C5A46E] transition-colors hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/10 hover:text-[#E5C07B]"
      aria-label="Go to Dashboard"
    >
      <LogIn aria-hidden="true" className="size-3" />
      <span>Go to Dashboard</span>
    </Link>
  );
}
