import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How Integritas handles personal information submitted through this website.",
  alternates: { canonical: "/privacy" },
};

const sections = [
  {
    title: "Information we collect",
    body: "When you contact us, we may collect your name, email address, telephone number, organisation details and the information you include in your enquiry. Basic technical records may also be processed to keep the website secure and prevent abuse.",
  },
  {
    title: "Why we use it",
    body: "We use this information to assess and respond to enquiries, communicate about requested services, maintain appropriate business records, protect the website and comply with applicable legal obligations. We do not sell personal information.",
  },
  {
    title: "Sharing and service providers",
    body: "Information may be handled by service providers that support website hosting, security and email delivery, or by professional advisers where reasonably necessary. We require information to be used only for the relevant purpose and subject to appropriate safeguards.",
  },
  {
    title: "International processing",
    body: "Because Integritas advises on cross-border matters and may use international technology providers, information may be processed outside South Africa. Where this occurs, we take reasonable steps to ensure an appropriate level of protection.",
  },
  {
    title: "Retention and security",
    body: "We retain information only for as long as reasonably needed for the purpose for which it was collected, our professional and legal obligations, and the resolution of disputes. We apply reasonable technical and organisational safeguards, but no internet transmission can be guaranteed completely secure.",
  },
  {
    title: "Your choices and rights",
    body: "Subject to applicable law, you may ask whether we hold your personal information, request access or correction, object to certain processing, withdraw consent where consent is the basis for processing, or request deletion where retention is no longer authorised.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="public-site public-privacy min-h-screen bg-[#0A0A0A] text-[#F7F5F0]">
      <a href="#privacy-content" className="skip-link">Skip to privacy notice</a>
      <header className="border-b border-[#D4AF37]/15">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-6">
          <Link href="/" aria-label="Integritas home" className="flex items-center gap-3">
            <Image src="/brand/integritas-scales.svg" alt="" width={512} height={512} className="h-10 w-10" />
            <span className="font-serif tracking-[0.14em] uppercase text-[#D4AF37]">Integritas</span>
          </Link>
          <Link href="/#contact" className="editorial-link">Contact <span aria-hidden="true">↗</span></Link>
        </div>
      </header>

      <article id="privacy-content" className="max-w-4xl mx-auto px-6 py-20 md:py-28">
        <p className="text-[11px] tracking-[0.28em] uppercase text-[#D4AF37] mb-5">Privacy</p>
        <h1 className="font-serif text-4xl md:text-6xl leading-tight mb-7">Privacy Notice</h1>
        <p className="text-[#A9A39A] font-light leading-relaxed max-w-2xl mb-4">
          This notice explains how Integritas handles personal information submitted through this website. Integritas is the responsible party for this processing under South African data-protection law.
        </p>
        <p className="text-xs text-[#8A857C] mb-14">Last updated: 28 August 2026</p>

        <div className="border-t border-[#D4AF37]/15">
          {sections.map((section, index) => (
            <section key={section.title} className="grid md:grid-cols-[60px_1fr] gap-4 md:gap-8 py-8 border-b border-[#D4AF37]/15">
              <span className="font-serif text-[#D4AF37]/50" aria-hidden="true">0{index + 1}</span>
              <div>
                <h2 className="font-serif text-2xl mb-3">{section.title}</h2>
                <p className="text-[#A9A39A] font-light leading-relaxed">{section.body}</p>
              </div>
            </section>
          ))}
        </div>

        <section id="website-analytics" className="mt-12 p-7 md:p-9 border border-[#D4AF37]/20 bg-[#111111] scroll-mt-24">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#D4AF37] mb-3">Optional analytics</p>
          <h2 className="font-serif text-2xl mb-4">Website visits and notifications</h2>
          <p className="text-[#A9A39A] font-light leading-relaxed mb-4">
            If you select “Allow analytics”, the website records a limited visit summary: time, page, referring website domain, selected campaign tags, broad device category, browser family, language, a random session identifier and country code only when the hosting provider supplies one. Integritas may receive an email notification containing this summary.
          </p>
          <p className="text-[#A9A39A] font-light leading-relaxed mb-4">
            The analytics feature does not intentionally record your full IP address, precise location, browsing activity on other websites, advertising identifiers or a device fingerprint. Your choice is stored in your browser so the website can remember it.
          </p>
          <p className="text-[#A9A39A] font-light leading-relaxed mb-4">
            Consented visit summaries are automatically removed after 90 days.
          </p>
          <p className="text-[#A9A39A] font-light leading-relaxed">
            You may decline without losing access to the website. Use “Privacy choices” in the footer at any time to change the choice on that browser.
          </p>
        </section>

        <section className="mt-8 p-7 md:p-9 border border-[#D4AF37]/20 bg-[#111111]">
          <h2 className="font-serif text-2xl mb-4">Contact and complaints</h2>
          <p className="text-[#A9A39A] font-light leading-relaxed mb-4">
            To ask a privacy question or exercise a right, email <a href="mailto:info@integritass.com?subject=Privacy%20request" className="text-[#D4AF37] underline underline-offset-4">info@integritass.com</a>. We may need reasonable proof of identity before disclosing or changing personal information.
          </p>
          <p className="text-[#A9A39A] font-light leading-relaxed">
            You may also lodge a complaint with South Africa&apos;s <a href="https://inforegulator.org.za/complaints/" rel="noreferrer" className="text-[#D4AF37] underline underline-offset-4">Information Regulator</a>.
          </p>
        </section>

        <p className="mt-10 text-xs leading-relaxed text-[#8A857C]">
          This website notice is a practical summary and should be reviewed alongside Integritas&apos;s engagement terms, records-management practices and internal compliance documents.
        </p>
      </article>
    </main>
  );
}
