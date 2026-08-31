import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BriefcaseBusiness, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { crmSessionCookie, isValidCrmSession } from "@/lib/crm-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CRM Dashboard",
  robots: { index: false, follow: false },
};

export default async function CrmDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(crmSessionCookie.name)?.value;
  if (!(await isValidCrmSession(token))) redirect("/");

  return (
    <main className="min-h-screen bg-[#080808] text-[#F7F5F0]">
      <header className="border-b border-[#D4AF37]/20 bg-[#0D0D0D]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center border border-[#D4AF37]/35 text-[#D4AF37]">
              <BriefcaseBusiness className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-serif text-lg leading-none">Integritas</p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-[#C5A46E]">CRM workspace</p>
            </div>
          </div>
          <form action="/api/crm/logout" method="post">
            <button className="inline-flex min-h-10 items-center gap-2 border border-[#D4AF37]/25 px-4 text-[10px] uppercase tracking-[0.18em] text-[#C5A46E] transition-colors hover:bg-[#D4AF37]/10 hover:text-[#E5C07B]">
              <LogOut className="size-3.5" aria-hidden="true" />
              Log out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 text-[10px] uppercase tracking-[0.26em] text-[#D4AF37]">Secure dashboard</p>
          <h1 className="font-serif text-4xl font-normal md:text-5xl">Your CRM foundation is ready.</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#A9A39A]">
            This protected workspace is prepared for your client relationships, matters, tasks and reporting modules.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <article className="border border-[#D4AF37]/18 bg-[#111111] p-7">
            <LayoutDashboard className="mb-8 size-5 text-[#D4AF37]" aria-hidden="true" />
            <p className="font-serif text-2xl">Dashboard shell</p>
            <p className="mt-3 text-sm leading-6 text-[#8F8981]">Ready for the CRM sections and live data you choose to add next.</p>
          </article>
          <article className="border border-[#D4AF37]/18 bg-[#111111] p-7">
            <ShieldCheck className="mb-8 size-5 text-[#D4AF37]" aria-hidden="true" />
            <p className="font-serif text-2xl">Protected access</p>
            <p className="mt-3 text-sm leading-6 text-[#8F8981]">The dashboard is excluded from search indexing and requires a valid private session.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
