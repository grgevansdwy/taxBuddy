import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { SiteNav } from "@/components/landing/site-nav";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Faq } from "@/components/landing/faq";
import { DemoVideo } from "@/components/landing/demo-video";
import "./landing.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TaxBuddy — File your U.S. taxes in under 10 minutes",
  description:
    "Built for international students. Upload your documents, we do the rest. No manual data entry. No expensive filing fees.",
};

// Problem section: each pain point with its Material Symbols icon.
const PROBLEM_POINTS = [
  {
    icon: "desktop_windows",
    text: "Expensive, complicated self-prep software",
  },
  {
    icon: "block",
    text: "TurboTax is residents-only",
  },
  {
    icon: "payments",
    text: "$300+ for a local tax consultant",
  },
  {
    icon: "person_off",
    text: "Left to figure it out alone, with barely any one to help",
  },
];

const SECURITY_POINTS = [
  {
    icon: "lock",
    title: "Encrypted",
    body: "Your documents are encrypted at rest and in transit.",
  },
  {
    icon: "shield",
    title: "Saved for next year",
    body: "Securely stored so next season takes minutes, not hours.",
  },
  {
    icon: "verified_user",
    title: "Never sold",
    body: "We never share or sell your data to third parties. Ever.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Fonts: Material Symbols icon font (React 19 hoists these to <head>). */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      />

      <div
        className={`${hanken.className} bg-warm-cream text-on-surface font-body-md antialiased pt-24`}
      >
        <SiteNav />

        {/* Hero Section */}
        <section className="site-container py-section-gap-lg flex flex-col items-center text-center relative overflow-hidden">
          <h1 className="font-headline-lg-mobile md:font-headline-xl text-headline-lg-mobile md:text-headline-xl text-ink-navy max-w-4xl mb-6">
            File your U.S. taxes in under 10 minutes.
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-10">
            Built for international students. Upload your documents, we do the
            rest — no manual data entry, no $50 filing fees.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-20 z-10">
            <Link
              className="bg-deep-green text-pure-white px-8 py-3.5 rounded-full font-label-md text-label-md font-bold hover:bg-brand transition-colors shadow-[0_4px_20px_rgba(31,92,77,0.2)]"
              href="/signup"
            >
              Start filing free
            </Link>
            <a
              className="border-2 border-deep-green text-deep-green px-8 py-3 rounded-full font-label-md text-label-md font-bold hover:bg-surface-dim transition-colors flex items-center gap-2 bg-pure-white"
              href="#demo"
            >
              <span className="material-symbols-outlined">play_circle</span>
              Watch demo
            </a>
          </div>
          {/* Product mockup. The photo carries its own perspective, so no CSS
              tilt is layered on top; it renders flat at its natural aspect. */}
          <div className="relative w-full max-w-5xl mx-auto mt-2 md:mt-6">
            <div className="rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(26,26,46,0.10),0_8px_24px_-6px_rgba(26,26,46,0.16)]">
              <Image
                alt="TaxBuddy open on a tablet, showing a completed 1040-NR ready to download"
                className="w-full h-auto"
                src="/hero_image.png"
                width={1744}
                height={1222}
                sizes="(max-width: 1024px) 100vw, 1024px"
                priority
              />
            </div>
          </div>
        </section>

        {/* Section A (Problem) */}
        <section className="site-container pt-section-gap-lg pb-section-gap-md text-center">
          <h2 className="font-headline-lg text-headline-lg text-ink-navy mb-10">
            Filing taxes as an international student is broken.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROBLEM_POINTS.map((point) => (
              <div
                key={point.text}
                className="bg-pure-white rounded-12px border border-border-gray shadow-sm p-6 flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 mb-4 flex items-center justify-center">
                  <span className="material-symbols-outlined text-deep-green text-[56px]">
                    {point.icon}
                  </span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {point.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section B (How it Works) — scroll-driven */}
        <HowItWorks />

        {/* Section C (Video Demo) */}
        <section
          className="site-container py-section-gap-lg text-center"
          id="demo"
        >
          <h2 className="font-headline-lg text-headline-lg text-deep-green mb-10">
            See it in action
          </h2>
          <DemoVideo />
          <p className="font-body-md text-body-md text-muted-slate mt-4">
            Full walkthrough ~ 2 minutes
          </p>
        </section>

        {/* Section E (Security & Privacy) */}
        <section className="bg-mint-success/30 py-section-gap-lg" id="security">
          <div className="site-container text-center">
            <h2 className="font-headline-lg text-headline-lg text-deep-green mb-4">
              Your data stays yours.
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-12">
              Secured your most sensitive documents.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {SECURITY_POINTS.map((point) => (
                <div
                  key={point.title}
                  className="bg-pure-white rounded-12px p-6 shadow-sm border border-border-gray text-left flex flex-col items-start"
                >
                  <span className="material-symbols-outlined text-deep-green text-[32px] mb-4">
                    {point.icon}
                  </span>
                  <h4 className="font-headline-md text-body-md font-bold text-ink-navy mb-2">
                    {point.title}
                  </h4>
                  <p className="font-body-md text-on-surface-variant">
                    {point.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section F (Founders Backstory) */}
        <section
          className="site-container min-h-screen flex flex-col items-center justify-center py-section-gap-lg text-center"
          id="about"
        >
          <div className="max-w-3xl mx-auto">
            <h2 className="font-headline-lg text-headline-lg text-deep-green mb-6">
              Why we built TaxBuddy.
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-6 leading-relaxed">
              We&apos;re two international students. We worked, invested, and
              traded in the U.S. and every tax season we were stuck: friends
              <b> couldn&apos;t legally help</b>, online services{" "}
              <b>charged $50+</b> per filing, and doing it alone{" "}
              <b>risked leaving unclaimed money</b> on the table. So we built
              the tool we wished we had.
            </p>
            <div className="flex items-center justify-center gap-2 font-headline-md text-body-md font-bold">
              <span className="text-muted-slate font-normal select-none mr-1">
                —
              </span>
              <a
                className="founder-name"
                href="https://www.linkedin.com/in/grgevansportfolio/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Learn more about Evans"
              >
                Evans
                <span className="founder-tip">Learn more about Evans ↗</span>
              </a>
              <span className="text-muted-slate font-normal select-none">
                ,
              </span>
              <a
                className="founder-name"
                href="https://jonathanbw.me/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Learn more about Jonathan"
              >
                Jonathan
                <span className="founder-tip">Learn more about Jonathan ↗</span>
              </a>
            </div>
            <p className="mt-10 font-body-md text-body-md text-muted-slate">
              Have any questions?{" "}
              <Link
                href="/contact"
                className="text-deep-green font-bold underline underline-offset-4 hover:text-brand transition-colors"
              >
                Talk to us
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Section G (FAQ) */}
        <section className="site-container py-section-gap-lg" id="faq">
          <h2 className="font-headline-lg text-headline-lg text-deep-green mb-10 text-center">
            Frequently asked questions
          </h2>
          <Faq />
        </section>

        {/* Final CTA Section */}
        <section className="bg-deep-green py-section-gap-lg">
          <div className="site-container text-center flex flex-col items-center">
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-pure-white mb-6">
              File in 10 minutes. Keep what&apos;s yours.
            </h2>
            <p className="font-body-lg text-body-lg text-primary-fixed-dim max-w-xl mb-10">
              Join thousands of international students filing stress-free.
            </p>
            <Link
              className="bg-pure-white text-deep-green px-8 py-4 rounded-full font-label-md text-label-md font-bold hover:bg-warm-cream transition-colors shadow-lg"
              href="/signup"
            >
              Start Filing Free
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-background w-full rounded-t-xl border-t border-border-gray">
          <div className="site-container py-section-gap-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8">
              <div>
                <Link href="/" className="flex items-center gap-2 mb-4">
                  <span className="font-headline-md text-headline-md font-bold text-brand">
                    TaxBuddy
                  </span>
                </Link>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  © 2026 TaxBuddy. All rights reserved.
                </p>
              </div>
              <div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Made by international students who file taxes :)
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
