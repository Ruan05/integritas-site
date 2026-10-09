"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import VisitorAnalytics, { openPrivacyChoices } from "@/components/VisitorAnalytics";
import CrmLogin from "@/components/CrmLogin";

// ═══════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════

const NAV_LINKS = [
  { label: "Home", href: "#hero" },
  { label: "About", href: "#about" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Sectors", href: "#sectors" },
  { label: "Team", href: "#team" },
  { label: "Contact", href: "#contact" },
];

const PRINCIPLES = [
  {
    num: "01",
    title: "Commercially grounded",
    body: "Advice is shaped around the commercial objective, the operating environment and the jurisdictions involved.",
  },
  {
    num: "02",
    title: "Cross-border perspective",
    body: "International and local considerations are brought together so regulatory, contractual and delivery decisions remain aligned.",
  },
  {
    num: "03",
    title: "Clear execution",
    body: "Complex requirements are translated into practical structures, accountable workstreams and decisions clients can act on.",
  },
];

const SECTORS = [
  "International trade",
  "Energy, oil & gas",
  "Mining & resources",
  "ICT & infrastructure",
  "Pharmaceuticals & healthcare",
  "Cross-border investment",
  "Commercial partnerships",
];

const WHY_IT_MATTERS = [
  {
    title: "Avoiding regulatory issues",
    body: "Compliance helps businesses avoid fines, penalties and disputes, and protects against costly regulatory exposure that can threaten business continuity and reputation in multiple jurisdictions.",
  },
  {
    title: "Building trust",
    body: "Businesses that comply with regulations build customer confidence and a durable reputation across markets, creating lasting relationships founded on transparency and accountability.",
  },
  {
    title: "Smooth operations",
    body: "Clear guidelines support confident decision-making and uninterrupted cross-border operations, eliminating ambiguity that can delay shipments and contracts.",
  },
  {
    title: "Facilitating growth",
    body: "Compliance enables expansion into new markets, investor confidence and sustainable partnerships that serve as the foundation for long-term commercial success.",
  },
  {
    title: "Managing risk",
    body: "Proper documentation and structure help identify and manage political, currency, tariff and regulatory risk before they become costly obstacles.",
  },
  {
    title: "Protecting people",
    body: "Sound frameworks ensure fair treatment, clarity of obligation and accountable governance across jurisdictions, safeguarding both the organisation and individuals.",
  },
];

const SERVICES = [
  {
    num: "01",
    title: "International Trade & Compliance",
    body: "Export controls, import and customs regulations, preferential trade arrangements, enhanced due diligence and counter-party screening across multiple jurisdictions.",
  },
  {
    num: "02",
    title: "Global Transactions",
    body: "Structuring and implementing strategic transactions, contractual joint ventures, manufacturing and partnering agreements, licence and distribution arrangements.",
  },
  {
    num: "03",
    title: "Foreign Direct Investment",
    body: "Optimal structures for overseas presence — joint ventures, strategic alliances, new investments — with evaluation of political, currency and regulatory risk.",
  },
  {
    num: "04",
    title: "Contract Law",
    body: "Custom drafting, review, negotiation and management of shareholder, partnership, joint venture and consulting agreements with a preventive focus.",
  },
  {
    num: "05",
    title: "Energy, Oil & Gas",
    body: "Upstream, midstream and downstream counsel; renewable energy; host-government instruments; LNG and infrastructure projects across the energy value chain.",
  },
  {
    num: "06",
    title: "Trade Finance & Instruments",
    body: "Guarantees, letters of credit, negotiable instruments, documentary collections, counter-trade and receivables financing for cross-border deals.",
  },
  {
    num: "07",
    title: "Pharmaceutical & Health Due Diligence",
    body: "Due diligence and compliance support for pharmaceutical and healthcare projects, including review of counterparties, licensing and regulatory considerations, product and supply-chain risks, and market-entry readiness across relevant jurisdictions.",
  },
];

const PROCESS_STEPS = [
  {
    num: "01",
    title: "Understand",
    body: "We take time to understand your commercial objectives and the jurisdictions involved, building a comprehensive picture of your operating environment.",
  },
  {
    num: "02",
    title: "Structure",
    body: "We design practical frameworks that protect interests and support operations, ensuring every element aligns with your commercial goals.",
  },
  {
    num: "03",
    title: "Advise",
    body: "Clear, actionable counsel on compliance, contracts, risk and regulatory engagement — delivered in plain language you can act on.",
  },
  {
    num: "04",
    title: "Partner",
    body: "Ongoing support as laws change and your international footprint evolves, ensuring you remain compliant and competitive.",
  },
];

const TEAM = [
  {
    name: "Johan Potgieter",
    role: "Executive Chairman",
    shortBio: "Johan brings extensive international experience in investment facilitation, strategic partnerships and project commercialization across energy, mining, ICT and agriculture.",
    bio: "Seasoned business development, project commercialization, and legal professional with extensive international experience across the agriculture, ICT, mining, energy, oil, and gas sectors. Formerly associated with South Africa’s Department of Justice, Parliament, CSIR, the UNDP, and a co-founder of a major internet company listed on both the JSE and Euronext Amsterdam. Recognized for expertise in investment facilitation, strategic partnerships, project commercialization, and cross-border project development, supported by a strong international network of investors, industry leaders, and government stakeholders.",
    photo: "/team/johan-v6.webp",
    email: "johan@integritass.com",
    phones: [
      { label: "WhatsApp", number: "(+27 79) 462 0451" },
      { label: "Mobile", number: "(+27 61) 502 6507" },
    ],
  },
  {
    name: "Anna-Mart Potgieter",
    role: "CEO, Advocate Legal Practitioner",
    shortBio: "Anna-Mart advises on international trade, cross-border transactions and multi-jurisdictional compliance as an admitted Advocate Legal Practitioner.",
    bio: "An admitted Advocate Legal Practitioner of the High Courts of South Africa with over five years' experience in transnational business law. She provides strategic counsel on international trade regulations, cross-border transactions, and multi-jurisdictional compliance, combining rigorous legal research with skilled negotiation and client advocacy to deliver result-driven outcomes.",
    photo: "/team/anna-mart-v4.webp",
    email: "anna-mart@integritass.com",
    phones: [
      { label: "WhatsApp", number: "(+27 79) 462 0451" },
      { label: "Mobile", number: "(+27 61) 502 6507" },
    ],
  },
  {
    name: "Ruan Scheepers",
    role: "Project Manager · Pharma & Health",
    shortBio: "Ruan coordinates cross-border project delivery, with domain expertise in pharmaceutical and healthcare due diligence and compliance.",
    bio: "Ruan coordinates the firm's cross-border engagements and applies domain expertise in pharmaceutical and healthcare due diligence and compliance. He manages reviews of counterparties, project readiness and execution risks, bringing commercial, regulatory and cross-border workstreams together from initial assessment through to clear, actionable findings.",
    photo: "/team/ruan-v4.webp",
    email: "ruan@integritass.com",
    phones: [
      { label: "WhatsApp", number: "(+27 79) 462 0451" },
      { label: "Mobile", number: "(+27 61) 502 6507" },
    ],
  },
];

const ENQUIRY_TYPES = [
  "International Trade & Compliance",
  "Global Transactions",
  "Foreign Direct Investment",
  "Contract Law",
  "Energy, Oil & Gas",
  "Trade Finance",
  "Project Management",
  "Pharmaceutical & Health Due Diligence",
  "Investment & Project Facilitation",
  "General Enquiry",
];

// ═══════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -20px 0px" }
    );
    document.querySelectorAll(".reveal, .flip-reveal").forEach((el) => observer.observe(el));
    setTimeout(() => {
      document
        .querySelectorAll("section:first-of-type .reveal, section:first-of-type .flip-reveal")
        .forEach((el) => el.classList.add("visible"));
    }, 100);
    return () => observer.disconnect();
  }, []);
}

function useNavScroll() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return scrolled;
}

function useGlisten() {
  const ref = useRef<HTMLDivElement>(null);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    el.style.setProperty("--beam-x", `${x - 60}px`);
  }, []);
  return { ref, handleMouseMove };
}

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const handler = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? scrollTop / docHeight : 0);
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return progress;
}

function useBackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return visible;
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════

function Navigation() {
  const scrolled = useNavScroll();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  return (
    <header
      id="nav"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled && !mobileOpen ? "nav-scrolled" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CrmLogin />
        </div>

        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7 lg:gap-9 text-[11px] tracking-[0.18em] uppercase text-[#A9A39A]">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="nav-link"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#contact"
          className="hidden md:inline-flex text-[11px] tracking-[0.2em] uppercase text-[#D4AF37] border border-[#D4AF37]/40 px-5 py-2.5 hover:bg-[#D4AF37]/10 transition-all duration-400"
        >
          Enquire
        </a>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden relative z-[60] flex min-h-11 min-w-11 flex-col items-center justify-center gap-1.5 p-3 -mr-3"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
        >
          <span
            className={`block w-6 h-px bg-[#D4AF37] transition-all duration-300 origin-center ${
              mobileOpen ? "rotate-45 translate-y-[4px]" : ""
            }`}
          />
          <span
            className={`block w-6 h-px bg-[#D4AF37] transition-all duration-300 ${
              mobileOpen ? "opacity-0 scale-0" : ""
            }`}
          />
          <span
            className={`block w-6 h-px bg-[#D4AF37] transition-all duration-300 origin-center ${
              mobileOpen ? "-rotate-45 -translate-y-[4px]" : ""
            }`}
          />
        </button>
      </div>

      {mobileOpen && (
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="md:hidden fixed inset-0 top-0 z-[55] mobile-menu-enter bg-[#0A0A0A]/98 backdrop-blur-md">
          <div className="flex flex-col items-center justify-center min-h-screen gap-8 text-[13px] tracking-[0.22em] uppercase text-[#A9A39A]">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="hover:text-[#D4AF37] transition-colors duration-300"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#contact"
              className="mt-4 text-[#D4AF37] border border-[#D4AF37]/40 px-8 py-3 hover:bg-[#D4AF37]/10 transition-all"
              onClick={() => setMobileOpen(false)}
            >
              Enquire
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HERO SECTION
// ═══════════════════════════════════════════════════════════════════

function HeroSection() {
  const spotlightRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = spotlightRef.current;
    if (!el) return;
    const rect = el.parentElement?.getBoundingClientRect();
    if (!rect) return;
    el.style.left = `${e.clientX - rect.left}px`;
    el.style.top = `${e.clientY - rect.top}px`;
  }, []);

  return (
    <section
      ref={heroSectionRef}
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* ═══ Subtle ambient gold glow ═══ */}
      <div
        className="absolute inset-0 opacity-[0.04] hero-ambient-glow"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 30% 20%, #D4AF37 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, #D4AF37 0%, transparent 40%)",
        }}
      />
      <div ref={spotlightRef} className="hero-spotlight" />

      {/* Restrained atmospheric detail */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { top: "10%", left: "15%", delay: "0s", size: 3 },
          { top: "18%", left: "82%", delay: "1.2s", size: 2 },
          { top: "35%", left: "6%", delay: "2.8s", size: 3 },
          { top: "45%", left: "92%", delay: "0.6s", size: 2 },
          { top: "65%", left: "10%", delay: "3.2s", size: 3 },
          { top: "75%", left: "85%", delay: "1.8s", size: 2 },
          { top: "20%", left: "45%", delay: "4.2s", size: 2 },
        ].map((p, i) => (
          <div
            key={i}
            className="gold-particle"
            style={{
              top: p.top,
              left: p.left,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: p.delay,
              animationDuration: `${3.4 + (i % 4) * 0.35}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-20">
        <div className="mb-8 flex justify-center">
          <figure className="m-0 w-full flex flex-col items-center">
            <div className="hero-logo-cinematic">
              <Image
                src="/brand/integritas-primary-artwork.webp"
                alt="Integritas gold artwork of Lady Justice with the scales and sword, framed by a radiant halo."
                width={1254}
                height={1254}
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 76vw, 760px"
                className="hero-logo-image"
                priority
              />
              <span className="hero-logo-glint hero-logo-glint-one" aria-hidden="true" />
              <span className="hero-logo-glint hero-logo-glint-two" aria-hidden="true" />
              <span className="hero-logo-glint hero-logo-glint-three" aria-hidden="true" />
            </div>
            <p className="sr-only">
              INTEGRITAS. INTEGRITY • GOVERNANCE • EXCELLENCE.
            </p>
          </figure>
        </div>

        <p className="sr-only">
          Legal &bull; Compliance &bull; Investment &bull; Business Consulting
        </p>

        <h1 className="sr-only">
          Integrity in every cross-border decision.
        </h1>

        <div className="hero-cascade-3 diamond-separator max-w-[80px] mx-auto mb-6">
          <span className="diamond" />
        </div>

        <p className="hero-cascade-4 max-w-xl mx-auto text-base md:text-lg text-[#8A857C] font-light leading-relaxed mb-10">
          Cross-border compliance and international business counsel across
          trade, contracts and energy, with pharmaceutical and healthcare due
          diligence and regulatory support.
        </p>

        <div className="hero-cascade-5 flex flex-col sm:flex-row items-center justify-center gap-5">
          <a
            href="#contact"
            className="btn-primary gold-glisten inline-flex px-10 py-4 text-[11px] tracking-[0.2em] uppercase"
          >
            <span>Begin a Conversation</span>
          </a>
          <a
            href="#about"
            className="text-[11px] tracking-[0.2em] uppercase text-[#8A857C] hover:text-[#F7F5F0] transition-colors duration-300"
          >
            Our Approach &rarr;
          </a>
        </div>
      </div>

      <div className="absolute bottom-9 left-1/2 -translate-x-1/2 scroll-indicator">
        <div className="w-px h-10 bg-gradient-to-b from-[#D4AF37]/50 to-transparent mx-auto" />
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ABOUT SECTION
// ═══════════════════════════════════════════════════════════════════

function AboutSection() {
  return (
    <section id="about" className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <p className="reveal text-[11px] tracking-[0.28em] uppercase text-[#D4AF37] mb-8">
          Who We Are
        </p>
        <blockquote className="reveal reveal-delay-1 font-serif text-2xl md:text-3xl lg:text-4xl font-normal leading-snug text-[#F7F5F0] mb-10">
          &ldquo;We act as a bridge between markets — delivering practical
          solutions that enable businesses to operate effectively across
          borders while minimising risk.&rdquo;
        </blockquote>
        <div className="reveal reveal-delay-2 gold-line gold-line-reveal w-16 mx-auto mb-8" />
        <p className="reveal reveal-delay-3 text-[#8A857C] font-light leading-relaxed max-w-2xl mx-auto text-sm md:text-base">
          Integritas specialises in corporate, commercial and international
          business counsel. We support clients in trade compliance, cross-border
          transactions, contract integrity and the regulatory frameworks that
          govern global operations. Our Global Team leverages a network of
          professionals worldwide who understand local and international
          languages, customs and regulatory landscapes.
        </p>
        {/* Location indicator */}
        <div className="reveal reveal-delay-4 mt-12 flex flex-wrap items-center justify-center gap-6 text-[10px] tracking-[0.15em] uppercase text-[#8A857C]">
          <span>Pretoria, South Africa</span>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WHY IT MATTERS
// ═══════════════════════════════════════════════════════════════════

function WhyIntegritasSection() {
  return (
    <section className="py-20 md:py-28 bg-[#111111] border-y border-[#D4AF37]/10">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-20 items-start">
          <div>
            <p className="reveal text-[11px] tracking-[0.28em] uppercase text-[#D4AF37] mb-5">
              Why Integritas
            </p>
            <h2 className="reveal reveal-delay-1 font-serif text-3xl md:text-5xl font-medium leading-tight mb-6">
              Counsel designed for the reality of international business.
            </h2>
            <p className="reveal reveal-delay-2 text-[#A9A39A] font-light leading-relaxed max-w-xl">
              Integritas connects legal analysis, commercial context and disciplined project delivery—so advice remains practical from the first decision through implementation.
            </p>
          </div>
          <div className="divide-y divide-[#D4AF37]/15 border-y border-[#D4AF37]/15">
            {PRINCIPLES.map((item, i) => (
              <article key={item.num} className={`reveal ${i ? "reveal-delay-1" : ""} grid grid-cols-[48px_1fr] gap-4 py-6 md:py-7`}>
                <span className="font-serif text-[#D4AF37]/55 text-lg" aria-hidden="true">{item.num}</span>
                <div>
                  <h3 className="font-serif text-xl text-[#F7F5F0] mb-2">{item.title}</h3>
                  <p className="text-[#A9A39A] text-sm font-light leading-relaxed">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyMatterSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-14">
          <p className="reveal text-[11px] tracking-[0.28em] uppercase text-[#D4AF37] mb-4">
            The Business Case
          </p>
          <h2 className="reveal reveal-delay-1 font-serif text-3xl md:text-4xl font-medium">
            Compliance for international business
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {WHY_IT_MATTERS.map((item, i) => (
            <div
              key={i}
              className={`reveal matter-item ${
                i % 3 === 1
                  ? "reveal-delay-1"
                  : i % 3 === 2
                  ? "reveal-delay-2"
                  : ""
              }`}
            >
              <h3 className="font-serif text-xl mb-3 text-[#D4AF37]/90">
                {item.title}
              </h3>
              <p className="text-[#A9A39A] text-sm font-light leading-relaxed">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SERVICES SECTION
// ═══════════════════════════════════════════════════════════════════

function GlistenCard({
  num,
  title,
  body,
  delay,
  featured = false,
}: {
  num: string;
  title: string;
  body: string;
  delay: string;
  featured?: boolean;
}) {
  const { ref, handleMouseMove } = useGlisten();
  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`service-card gold-glisten-interactive reveal ${delay} p-7 bg-[#0A0A0A]/50 ${featured ? "lg:col-span-3 lg:grid lg:grid-cols-[64px_300px_1fr] lg:items-center lg:gap-8" : ""}`}
    >
      <div className="glisten-beam" />
      <p className="text-[#D4AF37] text-[10px] tracking-[0.15em] uppercase mb-3">
        {num}
      </p>
      <h3 className="font-serif text-xl mb-3">{title}</h3>
      <p className="text-[#8A857C] text-sm font-light leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function ServicesSection() {
  return (
    <section id="capabilities" className="py-24 md:py-32 bg-[#111111] border-y border-[#D4AF37]/10">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-14">
          <p className="reveal text-[11px] tracking-[0.28em] uppercase text-[#D4AF37] mb-4">
            Core Capabilities
          </p>
          <h2 className="reveal reveal-delay-1 font-serif text-3xl md:text-4xl font-medium mb-4">
            Legal and commercial counsel
          </h2>
          <p className="reveal reveal-delay-2 text-[#8A857C] font-light max-w-xl mx-auto text-sm">
            Specialist support across the legal and commercial dimensions of international operations.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map((s, i) => (
            <GlistenCard
              key={i}
              num={s.num}
              title={s.title}
              body={s.body}
              featured={i === SERVICES.length - 1 && SERVICES.length % 3 === 1}
              delay={
                i % 3 === 1
                  ? "reveal-delay-1"
                  : i % 3 === 2
                  ? "reveal-delay-2"
                  : ""
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectManagementSection() {
  const workstreams = [
    "Cross-border engagement coordination",
    "Milestone and dependency management",
    "Stakeholder and advisor alignment",
    "Documentation and decision tracking",
  ];

  return (
    <section id="project-management" className="project-feature py-24 md:py-32 relative overflow-hidden">
      <div className="project-feature-glow" aria-hidden="true" />
      <div className="max-w-6xl mx-auto px-6 md:px-10 relative z-10">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-20 items-center">
          <div>
            <p className="reveal text-[11px] tracking-[0.28em] uppercase text-[#D4AF37] mb-5">Project Management</p>
            <h2 className="reveal reveal-delay-1 font-serif text-3xl md:text-5xl leading-tight mb-6">
              From sound advice to controlled execution.
            </h2>
            <p className="reveal reveal-delay-2 text-[#A9A39A] font-light leading-relaxed max-w-xl mb-6">
              Complex cross-border matters depend on more than a legal answer. Integritas coordinates workstreams, decisions and stakeholders so commercial and regulatory requirements move forward together.
            </p>
            <div className="reveal reveal-delay-2 border-l border-[#D4AF37]/40 pl-5 max-w-xl mb-8">
              <h3 className="font-serif text-xl text-[#E7E2D8] mb-2">Investment &amp; project facilitation</h3>
              <p className="text-[#A9A39A] text-sm font-light leading-relaxed mb-4">
                We help investors and project sponsors establish a credible basis for engagement.
              </p>
              <ol className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm text-[#E7E2D8]" aria-label="How we connect investors and projects">
                <li><span className="text-[#D4AF37] mr-2">01</span>Assess project fit</li>
                <li><span className="text-[#D4AF37] mr-2">02</span>Prepare due diligence</li>
                <li><span className="text-[#D4AF37] mr-2">03</span>Introduce parties</li>
                <li><span className="text-[#D4AF37] mr-2">04</span>Coordinate next steps</li>
              </ol>
              <p className="text-[#8A857C] text-xs leading-relaxed mt-4">
                Introductions are subject to fit and do not guarantee funding or investment endorsement.
              </p>
            </div>
            <a href="#contact" className="reveal reveal-delay-2 editorial-link">
              Discuss a project <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="project-panel reveal reveal-delay-1">
            <p className="text-[10px] tracking-[0.24em] uppercase text-[#D4AF37]/70 mb-7">Delivery focus</p>
            <ul className="space-y-0">
              {workstreams.map((item, index) => (
                <li key={item} className="grid grid-cols-[38px_1fr] gap-4 items-center py-5 border-t border-[#D4AF37]/15 first:border-t-0">
                  <span className="font-serif text-[#D4AF37]/45" aria-hidden="true">0{index + 1}</span>
                  <span className="text-[#E7E2D8] text-sm tracking-wide">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectorsSection() {
  return (
    <section id="sectors" className="py-20 md:py-28 bg-[#111111] border-y border-[#D4AF37]/10">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="grid lg:grid-cols-[0.75fr_1.25fr] gap-10 lg:gap-20 items-end">
          <div>
            <p className="reveal text-[11px] tracking-[0.28em] uppercase text-[#D4AF37] mb-4">Sector Perspective</p>
            <h2 className="reveal reveal-delay-1 font-serif text-3xl md:text-4xl font-medium">Where our experience is applied</h2>
          </div>
          <div className="grid sm:grid-cols-2 reveal reveal-delay-1 border-t border-[#D4AF37]/20">
            {SECTORS.map((sector, index) => (
              <div key={sector} className="sector-row flex items-center gap-4 py-5 border-b border-[#D4AF37]/15 sm:odd:pr-6 sm:even:pl-6">
                <span className="text-[9px] tracking-widest text-[#D4AF37]/50" aria-hidden="true">0{index + 1}</span>
                <span className="font-serif text-lg text-[#E7E2D8]">{sector}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROCESS SECTION
// ═══════════════════════════════════════════════════════════════════

function ProcessSection() {
  return (
    <section className="py-20 md:py-28 bg-[#111111]">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-14">
          <p className="reveal text-[11px] tracking-[0.28em] uppercase text-[#D4AF37] mb-4">
            How We Work
          </p>
          <h2 className="reveal reveal-delay-1 font-serif text-3xl md:text-4xl font-medium">
            A considered process
          </h2>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {PROCESS_STEPS.map((step, i) => (
            <div
              key={i}
              className={`reveal reveal-delay-${Math.min(i + 1, 4)} text-center process-connector`}
            >
              <p className="font-serif text-4xl text-[#D4AF37]/25 mb-4">
                {step.num}
              </p>
              <h3 className="font-serif text-lg mb-2">{step.title}</h3>
              <p className="text-[#8A857C] text-sm font-light leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TEAM SECTION (Flip Cards — Bio front, Business Card back)
// ═══════════════════════════════════════════════════════════════════

/* Inline SVG contact icons (stroke style, gold) */
function IconPhone() {
  return (
    <svg className="bcard-contact-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg className="bcard-contact-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg className="bcard-contact-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg className="bcard-contact-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function TeamCard({
  member,
  delay,
}: {
  member: (typeof TEAM)[number];
  delay: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const bioDialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = `bio-${member.name.toLowerCase().replace(/[^a-z]+/g, "-")}`;

  return (
    <div className={`flip-reveal ${delay}`}>
      <div className={`flip-card${flipped ? " flipped" : ""}`}>
        <div className="flip-card-inner">
          {/* ─── FRONT FACE — Bio side ─── */}
          <div className="flip-card-front" aria-hidden={flipped} inert={flipped}>
            <div style={{ position: 'relative', zIndex: 1 }} className="h-full flex flex-col">
              {/* Brand header */}
              <div className="flex-shrink-0 pt-5 pb-2 px-5 text-center">
                <div className="flex justify-center mb-1">
                  <Image src="/brand/integritas-compact-mark.png" alt="Integritas" width={512} height={512} className="h-7 w-7 opacity-80" />
                </div>
                <p className="font-serif text-sm sm:text-base tracking-[0.15em] uppercase text-[#D4AF37]">Integritas</p>
                <p className="text-[7px] sm:text-[8px] tracking-[0.2em] uppercase text-[#8A857C] mt-0.5">Legal &bull; Compliance &bull; Investment &bull; Business Consulting</p>
              </div>
              <div className="gold-line-solid"></div>
              {/* Photo, name, role, bio */}
              <div className="flex-1 min-h-0 pt-3 pb-1 px-5 text-center flex flex-col items-center">
                <div className="headshot-frame mb-3 flex-shrink-0">
                  <Image src={member.photo} alt={member.name} width={240} height={240} className="" priority unoptimized />
                </div>
                <h3 className="font-serif text-lg sm:text-xl tracking-[0.12em] uppercase text-[#D4AF37] mb-0.5 flex-shrink-0">{member.name}</h3>
                <p className="text-[11px] sm:text-xs tracking-[0.12em] uppercase text-[#B8B2A8] mb-2 flex-shrink-0">{member.role}</p>
                <div className="diamond-separator max-w-[50px] mx-auto mb-2 flex-shrink-0"><span className="diamond"></span></div>
                <p className="text-[#B8B2A8] text-[13px] sm:text-sm font-light leading-relaxed px-1">{member.shortBio}</p>
              </div>
              <div className="flex-shrink-0 pt-2 pb-4 flex justify-center gap-2 flex-wrap px-3">
                <button
                  type="button"
                  onClick={() => bioDialogRef.current?.showModal()}
                  className="flip-btn"
                  aria-haspopup="dialog"
                >
                  Read full bio
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFlipped(true); }}
                  className="flip-btn"
                >
                  View Business Card&nbsp;&rsaquo;
                </button>
              </div>
            </div>
          </div>
          {/* ─── BACK FACE — Business card side ─── */}
          <div className="flip-card-back" aria-hidden={!flipped} inert={!flipped}>
            <div style={{ position: 'relative', zIndex: 1 }} className="h-full flex flex-col">
              {/* Brand header */}
              <div className="flex-shrink-0 pt-3 pb-1.5 px-5 text-center">
                <div className="flex justify-center mb-0.5">
                  <Image src="/brand/integritas-compact-mark.png" alt="Integritas" width={512} height={512} className="h-5 w-5 opacity-70" />
                </div>
                <p className="bcard-gold-text font-serif text-[11px] tracking-[0.18em] uppercase">Integritas</p>
                <p className="text-[6px] tracking-[0.2em] uppercase text-[#8A857C] mt-0.5">Legal &bull; Compliance &bull; Investment &bull; Business Consulting</p>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <span className="block w-4 h-px bg-[#D4AF37]/25"></span>
                  <span className="text-[5px] tracking-[0.1em] uppercase bcard-gold-text">Integrity &middot; Governance &middot; Excellence</span>
                  <span className="block w-4 h-px bg-[#D4AF37]/25"></span>
                </div>
              </div>
              <div className="bcard-divider"></div>
              {/* Name & role */}
              <div className="flex-shrink-0 pt-2.5 pb-0.5 px-6 text-center">
                <h3 className="bcard-gold-text font-serif text-base sm:text-lg tracking-[0.1em] uppercase leading-tight">{member.name}</h3>
                <p className="bcard-gold-text text-[8px] sm:text-[9px] tracking-[0.25em] uppercase mt-0.5">{member.role}</p>
                <div className="diamond-separator max-w-[50px] mx-auto mt-1.5"><span className="diamond"></span></div>
              </div>
              <div className="bcard-divider"></div>
              {/* Contact details — fills remaining space evenly */}
              <div className="flex-1 min-h-0 py-4 px-5 flex flex-col items-center justify-evenly">
                {member.phones.length > 0 && member.phones.map((p) => (
                  <div key={p.label} className="bcard-contact-row text-[10px] sm:text-[11px]">
                    <IconPhone />
                    <span className="bcard-contact-label">{p.label}</span>
                    <span className="bcard-contact-value">{p.number}</span>
                  </div>
                ))}
                <div className="bcard-contact-row text-[10px] sm:text-[11px]">
                  <IconMail />
                  <span className="bcard-contact-label">Email</span>
                  <span className="bcard-contact-value">{member.email}</span>
                </div>
                <div className="bcard-contact-row text-[10px] sm:text-[11px]">
                  <IconGlobe />
                  <span className="bcard-contact-label">Web</span>
                  <span className="bcard-contact-value">www.integritass.com</span>
                </div>
                <div className="gold-line-solid max-w-[80px] mx-auto !my-1"></div>
                <div className="bcard-contact-row text-[10px] sm:text-[11px]">
                  <IconPin />
                  <span className="bcard-contact-label">Address</span>
                  <div className="bcard-contact-value leading-relaxed">
                    <p>94 Regency Drive, Route 21 Corporate Park</p>
                    <p>Irene, South Africa</p>
                  </div>
                </div>
              </div>
              {/* Flip button */}
              <div className="flex-shrink-0 pt-1 pb-3.5 flex justify-center">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFlipped(false); }}
                  className="flip-btn"
                >
                  &lsaquo;&nbsp;View Bio
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <dialog ref={bioDialogRef} className="team-bio-dialog" aria-labelledby={dialogTitleId}>
        <div className="flex items-start justify-between gap-6 mb-5">
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#D4AF37] mb-2">Our People</p>
            <h2 id={dialogTitleId} className="font-serif text-2xl text-[#F7F5F0]">{member.name}</h2>
            <p className="text-sm text-[#B8B2A8] mt-1">{member.role}</p>
          </div>
          <button type="button" onClick={() => bioDialogRef.current?.close()} className="text-[#D4AF37] text-sm underline underline-offset-4 p-2 -m-2">Close</button>
        </div>
        <p className="text-[#D5D0C7] text-base leading-relaxed">{member.bio}</p>
      </dialog>
    </div>
  );
}

function TeamSection() {
  return (
    <section id="team" className="py-16 md:py-32 relative">
      <div className="section-glow-line" />
      <div className="max-w-6xl mx-auto px-5 md:px-10">
        <div className="text-center mb-10 md:mb-14">
          <p className="reveal text-[11px] tracking-[0.28em] uppercase text-[#D4AF37] mb-4">
            Our People
          </p>
          <h2 className="reveal reveal-delay-1 font-serif text-3xl md:text-4xl font-medium">
            The team behind Integritas
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {TEAM.map((member, i) => (
            <TeamCard
              key={i}
              member={member}
              delay={`reveal-delay-${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CONTACT SECTION (Business Card Style)
// ═══════════════════════════════════════════════════════════════════

function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    enquiryType: "",
    message: "",
    website: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "draft" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [draftLink, setDraftLink] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (status !== "idle" && status !== "sending") setStatus("idle");
    setErrorMessage("");
    setDraftLink(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, privacyAccepted }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "We could not prepare your enquiry. Please email us directly.");
        setStatus("error");
      } else if (data.mode === "sent") {
        setStatus("sent");
        setDraftLink(null);
        setFormData({ name: "", email: "", phone: "", enquiryType: "", message: "", website: "" });
        setPrivacyAccepted(false);
      } else if (data.mailtoLink) {
        setDraftLink(data.mailtoLink);
        setStatus("draft");
      } else {
        setErrorMessage("Email delivery is not configured. Please email info@integritass.com directly.");
        setStatus("error");
      }
    } catch {
      setErrorMessage("We could not connect. Please email info@integritass.com directly.");
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="py-24 md:py-32">
      <div className="max-w-5xl mx-auto px-6 md:px-10">
        <div className="card-container gold-glisten-interactive" ref={null}>
          <div className="relative z-10">
            {/* Top: Brand identity */}
            <div className="pt-6 pb-5 px-8 text-center">
              <div className="flex justify-center mb-2">
                <Image
                  src="/brand/integritas-compact-mark.png"
                  alt="Integritas"
                  width={40}
                  height={40}
                  className="h-8 w-auto opacity-70"
                />
              </div>
              <p className="font-serif text-xl sm:text-2xl tracking-[0.15em] uppercase text-[#D4AF37]">
                Integritas
              </p>
              <p className="text-[9px] sm:text-[10px] tracking-[0.2em] uppercase text-[#8A857C] mt-0.5">
                Legal &bull; Compliance &bull; Investment &bull; Business Consulting
              </p>
              <div className="flex items-center justify-center gap-2 mt-2.5">
                <span className="block w-8 h-px bg-[#D4AF37]/40" />
                <span className="text-[8px] tracking-[0.12em] uppercase text-[#D4AF37]/50">
                  Integrity &middot; Governance &middot; Excellence
                </span>
                <span className="block w-8 h-px bg-[#D4AF37]/40" />
              </div>
            </div>

            {/* Gold divider */}
            <div className="gold-line-solid" />

            {/* Bottom: Contact content */}
            <div className="pt-5 pb-6 px-8">
              <div className="text-center mb-6">
                <h2 className="reveal font-serif text-2xl md:text-3xl tracking-[0.08em] uppercase text-[#D4AF37] mb-2">
                  Begin a Private Conversation
                </h2>
                <p className="reveal reveal-delay-1 text-[#8A857C] font-light text-sm">
                  We respond to every genuine enquiry. Please allow a brief period
                  for a considered reply.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="reveal reveal-delay-2 space-y-5 max-w-xl mx-auto"
                aria-describedby="contact-form-note contact-form-status"
              >
                <div className="honeypot-field" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={formData.website} onChange={handleChange} />
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className={`relative ${focusedField === "name" ? "form-field-focused" : ""}`}>
                    <label className="form-label" htmlFor="name">Full name <span aria-hidden="true">*</span></label>
                    <input
                      id="name"
                      type="text"
                      name="name"
                      autoComplete="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      onFocus={() => setFocusedField("name")}
                      onBlur={() => setFocusedField(null)}
                      className="form-input w-full px-4 py-3.5 text-sm"
                    />
                  </div>
                  <div className={`relative ${focusedField === "email" ? "form-field-focused" : ""}`}>
                    <label className="form-label" htmlFor="email">Email address <span aria-hidden="true">*</span></label>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      className="form-input w-full px-4 py-3.5 text-sm"
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className={`relative ${focusedField === "phone" ? "form-field-focused" : ""}`}>
                    <label className="form-label" htmlFor="phone">Phone number <span className="form-optional">Optional</span></label>
                    <input
                      id="phone"
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      onFocus={() => setFocusedField("phone")}
                      onBlur={() => setFocusedField(null)}
                      className="form-input w-full px-4 py-3.5 text-sm"
                    />
                  </div>
                  <div className={`relative ${focusedField === "enquiryType" ? "form-field-focused" : ""}`}>
                    <label className="form-label" htmlFor="enquiryType">Enquiry type <span aria-hidden="true">*</span></label>
                    <select
                      id="enquiryType"
                      name="enquiryType"
                      required
                      value={formData.enquiryType}
                      onChange={handleChange}
                      onFocus={() => setFocusedField("enquiryType")}
                      onBlur={() => setFocusedField(null)}
                      className="form-input w-full px-4 py-3.5 text-sm appearance-none cursor-pointer"
                      style={{ colorScheme: "dark" }}
                    >
                      <option value="" disabled>
                        Select a capability
                      </option>
                      {ENQUIRY_TYPES.map((t) => (
                        <option key={t} value={t} className="bg-[#111111]">
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={`relative ${focusedField === "message" ? "form-field-focused" : ""}`}>
                  <label className="form-label" htmlFor="message">How can we help? <span aria-hidden="true">*</span></label>
                  <textarea
                    id="message"
                    name="message"
                    placeholder="Briefly describe the matter, jurisdictions and timing."
                    required
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("message")}
                    onBlur={() => setFocusedField(null)}
                    className="form-input w-full px-4 py-3.5 text-sm resize-none"
                  />
                </div>
                <label className="privacy-consent flex items-start gap-3 text-xs text-[#A9A39A] leading-relaxed">
                  <input
                    type="checkbox"
                    name="privacyAccepted"
                    required
                    className="mt-0.5"
                    checked={privacyAccepted}
                    onChange={(event) => setPrivacyAccepted(event.target.checked)}
                  />
                  <span>I agree that Integritas may use these details to respond to my enquiry, as explained in the <a href="/privacy" className="text-[#D4AF37] underline underline-offset-4 hover:text-[#E5C07B]">Privacy Notice</a>.</span>
                </label>
                <p id="contact-form-note" className="text-[11px] text-[#8A857C] leading-relaxed">
                  Fields marked * are required. If direct delivery is unavailable, we will prepare an email draft for you to open, review and send.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-4">
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="btn-primary gold-glisten w-full sm:w-auto inline-flex justify-center px-12 py-4 text-[11px] tracking-[0.2em] uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>
                      {status === "sending"
                        ? "Processing…"
                        : status === "sent"
                        ? "Enquiry Submitted"
                        : status === "draft"
                        ? "Prepare Draft Again"
                        : status === "error"
                        ? "Try Again"
                        : "Continue with Enquiry"}
                    </span>
                  </button>
                  <span id="contact-form-status" role="status" aria-live="polite" className="min-h-5 text-xs tracking-wide">
                  {status === "sent" && (
                    <span className="text-[#D4AF37] animate-fade-in">
                      Thank you. Your enquiry was submitted to Integritas.
                    </span>
                  )}
                  {status === "draft" && (
                    <span className="text-[#D4AF37] animate-fade-in">
                      Your enquiry has not been sent. Open the draft, review it and press Send in your email app. {draftLink && (
                        <a href={draftLink} className="underline underline-offset-4 hover:text-[#E5C07B]">Open email draft</a>
                      )}
                    </span>
                  )}
                  {status === "error" && (
                    <span className="text-red-300">
                      {errorMessage}
                    </span>
                  )}
                  </span>
                </div>
              </form>

              {/* Contact details */}
              <div className="reveal reveal-delay-3 mt-10 gold-line-solid mb-8" />
              <div className="reveal reveal-delay-3 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <div className="space-y-1.5">
                  <p>
                    <a
                      href="mailto:info@integritass.com"
                      className="text-[#D4AF37]/80 hover:text-[#D4AF37] transition-colors"
                    >
                      info@integritass.com
                    </a>
                  </p>
                  <p>
                    <a
                      href="tel:+27615026507"
                      className="text-[#8A857C] hover:text-[#F7F5F0] transition-colors"
                    >
                      (+27 61) 502 6507
                    </a>
                  </p>
                </div>
                <div className="space-y-1.5 text-[#8A857C]">
                  <p>www.integritass.com</p>
                  <p>94 Regency Drive, Route 21 Corporate Park</p>
                  <p>Irene, South Africa</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CTA SECTION
// ═══════════════════════════════════════════════════════════════════

function CTASection() {
  return (
    <section className="py-24 md:py-32 bg-[#111111]">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <div className="gold-line gold-line-reveal w-16 mx-auto mb-10 reveal" />
        <p className="reveal reveal-delay-1 font-serif text-2xl md:text-3xl leading-snug text-[#F7F5F0] mb-8">
          &ldquo;We are committed to crafting practical solutions that enable
          businesses to operate effectively in the global market while
          minimising legal risks.&rdquo;
        </p>
        <a
          href="#contact"
          className="reveal reveal-delay-2 btn-primary gold-glisten inline-flex px-12 py-4 text-[11px] tracking-[0.2em] uppercase"
        >
          <span>Contact Integritas</span>
        </a>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════

function Footer() {
  return (
    <footer className="border-t border-[#D4AF37]/10 py-10 relative">
      <div className="gold-line absolute top-0 left-0 right-0 opacity-30" />
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        {/* Brand identity row */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/brand/integritas-compact-mark.png"
            alt="Integritas"
            width={100}
            height={100}
            className="h-10 w-auto opacity-70 mb-3"
          />
          <p className="font-serif text-sm tracking-[0.15em] uppercase text-[#D4AF37]/60">
            Integritas
          </p>
          <p className="text-[8px] tracking-[0.2em] uppercase text-[#8A857C]/50 mt-1">
            Integrity &middot; Governance &middot; Excellence
          </p>
        </div>

        {/* Footer links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex flex-wrap justify-center gap-x-7 gap-y-3 text-[11px] tracking-[0.15em] uppercase text-[#A9A39A]">
            <a href="#about" className="hover:text-[#D4AF37] transition-colors">
              About
            </a>
            <a href="#capabilities" className="hover:text-[#D4AF37] transition-colors">
              Capabilities
            </a>
            <a href="#team" className="hover:text-[#D4AF37] transition-colors">
              Team
            </a>
            <a href="#contact" className="hover:text-[#D4AF37] transition-colors">
              Contact
            </a>
            <a href="/privacy" className="hover:text-[#D4AF37] transition-colors">
              Privacy
            </a>
            <button type="button" onClick={openPrivacyChoices} className="hover:text-[#D4AF37] transition-colors uppercase">
              Privacy choices
            </button>
          </div>
          <p className="text-[10px] text-[#8A857C]/60 tracking-wide">
            &copy; {new Date().getFullYear()} Integritas. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SCROLL PROGRESS BAR
// ═══════════════════════════════════════════════════════════════════

function ScrollProgressBar() {
  const progress = useScrollProgress();
  return (
    <div
      className="scroll-progress"
      style={{ width: `${progress * 100}%` }}
      aria-hidden="true"
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// BACK TO TOP
// ═══════════════════════════════════════════════════════════════════

function BackToTopButton() {
  const visible = useBackToTop();
  const scrollToTop = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };
  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-8 right-8 z-40 w-11 h-11 flex items-center justify-center border border-[#D4AF37]/30 bg-[#0A0A0A]/90 backdrop-blur-sm transition-all duration-500 cursor-pointer group hover:border-[#D4AF37]/60 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
      aria-label="Back to top"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:-translate-y-0.5">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════

export default function HomePage() {
  useScrollReveal();

  return (
    <div className="public-site min-h-screen flex flex-col noise-overlay">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <ScrollProgressBar />
      <Navigation />
      <main id="main-content" className="flex-1">
        <HeroSection />
        <AboutSection />
        <WhyIntegritasSection />
        <WhyMatterSection />
        <ServicesSection />
        <ProjectManagementSection />
        <SectorsSection />
        <ProcessSection />
        <TeamSection />
        <CTASection />
        <ContactSection />
      </main>
      <Footer />
      <BackToTopButton />
      <VisitorAnalytics />
    </div>
  );
}
