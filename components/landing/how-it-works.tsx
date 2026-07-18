"use client";

import { useEffect, useRef, useState } from "react";

// Scroll position drives the four steps (pinned scrollytelling). If the user
// stops scrolling, an idle timer gently advances to the next step so it still
// plays on its own. Completed steps become a checkmark.
const ZONES = [0.22, 0.44, 0.66, 0.88];
const CENTERS = [0.1, 0.32, 0.54, 0.76, 0.93]; // step 1..4 + done

const STEPS = [
  { n: 1, label: "Upload" },
  { n: 2, label: "Process" },
  { n: 3, label: "Confirm" },
  { n: 4, label: "File" },
] as const;

const MOBILE_RECAP = [
  { n: 1, label: "Upload", sub: "W-2, 1099, I-20, I-94" },
  { n: 2, label: "Process", sub: "AI field extraction" },
  { n: 3, label: "Confirm", sub: "Quick status questions" },
  { n: 4, label: "File", sub: "1040-NR + est. refund" },
];

export function HowItWorks() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(1);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      // No pinned scroll — just show the completed state.
      setCurrent(4);
      setDone(true);
      setProgress(100);
      return;
    }

    const metrics = () => {
      const rect = stage.getBoundingClientRect();
      const range = stage.offsetHeight - window.innerHeight;
      const top = window.scrollY + rect.top;
      const p = range > 0 ? (window.scrollY - top) / range : 0;
      return { p: Math.min(Math.max(p, 0), 1), top, range, rect };
    };

    let ticking = false;
    const render = () => {
      ticking = false;
      const { p } = metrics();
      let step = 1;
      let isDone = false;
      if (p >= ZONES[3]) {
        step = 4;
        isDone = true;
      } else if (p >= ZONES[2]) step = 4;
      else if (p >= ZONES[1]) step = 3;
      else if (p >= ZONES[0]) step = 2;
      setCurrent(step);
      setDone(isDone);
      setProgress(Math.min(p / ZONES[3], 1) * 100);
    };
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(render);
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    render();

    // Idle auto-advance: after a pause with no user input, move to the next
    // step. Uses wheel/touch/key (user-only) so our own smooth scroll never
    // counts as activity. Stops at the last step so it never scrolls away.
    const IDLE_MS = 2600;
    let lastInteract = Date.now();
    const bump = () => {
      lastInteract = Date.now();
    };
    const interactEvents = ["wheel", "touchmove", "keydown", "pointerdown"];
    interactEvents.forEach((ev) =>
      window.addEventListener(ev, bump, { passive: true }),
    );

    const zoneIndex = (p: number) => {
      for (let i = 0; i < ZONES.length; i++) if (p < ZONES[i]) return i;
      return 4;
    };

    const idle = window.setInterval(() => {
      const { p, top, range, rect } = metrics();
      const mid = window.innerHeight * 0.5;
      const pinned = rect.top < mid && rect.bottom > mid;
      if (!pinned || Date.now() - lastInteract < IDLE_MS) return;
      const zi = zoneIndex(p);
      if (zi >= 4) return; // already at the final step
      window.scrollTo({
        top: top + CENTERS[zi + 1] * range,
        behavior: "smooth",
      });
      lastInteract = Date.now();
    }, 700);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      interactEvents.forEach((ev) => window.removeEventListener(ev, bump));
      window.clearInterval(idle);
    };
  }, []);

  // Click a rail step to jump to it.
  const jumpTo = (index: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const range = stage.offsetHeight - window.innerHeight;
    const top = window.scrollY + stage.getBoundingClientRect().top;
    window.scrollTo({ top: top + CENTERS[index] * range, behavior: "smooth" });
  };

  return (
    <section
      id="how-it-works"
      className="bg-surface-bright border-y border-border-gray md:pb-section-gap-lg"
    >
      <div className="site-container pt-section-gap-lg text-center">
        <p className="font-label-md text-label-md uppercase tracking-[0.12em] text-deep-green mb-4">
          There&apos;s finally a better way
        </p>
        <h2 className="font-headline-lg text-headline-lg text-deep-green mb-4">
          How it works
        </h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          From documents to a filed return in four steps.
        </p>
      </div>

      {/* Pinned split-column: scroll drives the steps, idle auto-advances them */}
      <div ref={stageRef} className="howto-stage site-container mt-6 md:mt-10">
        <div className="sticky top-32 mx-auto max-w-4xl flex flex-col md:flex-row gap-12 items-stretch h-[560px]">
          {/* LEFT: vertical progress rail */}
          <div className="hidden md:flex md:w-72 shrink-0 items-center">
            <div className="relative flex flex-col gap-12 w-full">
              {/* track runs through the circle centers */}
              <div className="absolute left-7 top-7 bottom-7 w-px -translate-x-1/2 bg-border-gray" />
              <div className="absolute left-7 top-7 bottom-7 w-px -translate-x-1/2 overflow-hidden">
                <div
                  className="w-full bg-deep-green transition-all duration-500 ease-out"
                  style={{ height: `${progress}%` }}
                />
              </div>
              {STEPS.map((step, i) => {
                const isActive = !done && step.n === current;
                const isDone = done || step.n < current;
                const circleClass = isActive
                  ? "active-step-circle"
                  : isDone
                    ? "done-step-circle"
                    : "inactive-step-circle";
                return (
                  <button
                    type="button"
                    key={step.n}
                    onClick={() => jumpTo(i)}
                    className="step-nav-item relative z-10 flex items-center gap-5 transition-all duration-500 text-left"
                    style={{ opacity: isActive || isDone ? 1 : 0.4 }}
                  >
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center font-headline-md text-headline-md shrink-0 ${circleClass}`}
                    >
                      {isDone ? (
                        <span className="material-symbols-outlined text-[30px]">
                          check
                        </span>
                      ) : (
                        step.n
                      )}
                    </div>
                    <span
                      className={`font-headline-md text-headline-md ${
                        isActive || isDone
                          ? "text-deep-green"
                          : "text-muted-slate"
                      } ${isActive ? "font-bold" : ""}`}
                    >
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: preview panel */}
          <div className="flex-1 w-full self-stretch relative overflow-hidden">
            {STEPS.map((step) => {
              const visible =
                (!done && step.n === current) || (done && step.n === 4);
              const style: React.CSSProperties = {
                opacity: visible ? 1 : 0,
                transform: visible
                  ? "translateY(0)"
                  : step.n < current
                    ? "translateY(-8px)"
                    : "translateY(8px)",
                pointerEvents: visible ? "auto" : "none",
              };
              return (
                <div
                  key={step.n}
                  style={style}
                  className="step-transition absolute inset-0 p-8 md:p-12 flex flex-col justify-center"
                >
                  <StepPanel step={step.n} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile-only static four-step recap (desktop uses the rail as the overview) */}
      <section className="site-container py-section-gap-lg md:hidden">
        <div className="border-t border-border-gray pt-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {MOBILE_RECAP.map((step) => (
              <div
                key={step.n}
                className="flex flex-col items-center text-center relative z-10"
              >
                <div className="w-12 h-12 rounded-full bg-deep-green text-white flex items-center justify-center font-bold mb-4">
                  {step.n}
                </div>
                <h5 className="font-headline-md text-label-md text-deep-green font-bold mb-2">
                  {step.label}
                </h5>
                <p className="text-sm text-muted-slate">{step.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function StepPanel({ step }: { step: number }) {
  if (step === 1) {
    return (
      <div className="max-w-md w-full">
        <h3 className="font-headline-lg text-headline-lg text-deep-green mb-4">
          Upload your documents
        </h3>
        <p className="font-body-md text-body-md text-muted-slate mb-8">
          Just add your W-2, 1099, I-20 and I-94. We handle messy scans and
          phone photos automatically.
        </p>
        {/* Self-playing upload demo: a cursor drags a handful of files in */}
        <div className="upload-stage relative h-[240px]">
          <div className="absolute inset-0 rounded-2xl bg-surface-container-low border border-border-gray p-5 flex flex-col justify-center gap-3">
            <p className="font-label-md text-label-md text-muted-slate uppercase tracking-wider mb-1">
              Your documents
            </p>
            {["W-2_2023.pdf", "1099-NEC.pdf", "I-20.jpg"].map((name) => (
              <div
                key={name}
                className="up-row flex items-center gap-3 bg-pure-white border border-border-gray rounded-xl px-4 py-3"
              >
                <span className="material-symbols-outlined text-forest-green">
                  description
                </span>
                <span className="font-body-md text-body-md text-ink-navy flex-1">
                  {name}
                </span>
                <span className="material-symbols-outlined text-forest-green">
                  check_circle
                </span>
              </div>
            ))}
          </div>
          {/* Cursor-dragged stack of files */}
          <div className="drag-group absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-40 h-20">
              <div
                className="absolute inset-0 bg-pure-white border border-border-gray rounded-lg shadow-md flex items-center gap-2 px-3"
                style={{ transform: "rotate(-9deg) translate(-16px, 8px)" }}
              >
                <span className="material-symbols-outlined text-muted-slate text-[18px]">
                  description
                </span>
                <span className="font-label-md text-xs text-muted-slate">
                  1099-NEC
                </span>
              </div>
              <div
                className="absolute inset-0 bg-pure-white border border-border-gray rounded-lg shadow-md flex items-center gap-2 px-3"
                style={{ transform: "rotate(6deg) translate(14px, -4px)" }}
              >
                <span className="material-symbols-outlined text-muted-slate text-[18px]">
                  description
                </span>
                <span className="font-label-md text-xs text-muted-slate">
                  I-20.jpg
                </span>
              </div>
              <div
                className="absolute inset-0 bg-pure-white border border-border-gray rounded-lg shadow-lg flex items-center gap-2 px-3"
                style={{ transform: "rotate(-1deg)" }}
              >
                <span className="material-symbols-outlined text-forest-green text-[18px]">
                  description
                </span>
                <span className="font-label-md text-xs text-ink-navy">
                  W-2_2023.pdf
                </span>
              </div>
              <span className="material-symbols-outlined up-cursor">
                arrow_selector_tool
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="max-w-md">
        <h3 className="font-headline-lg text-headline-lg text-deep-green mb-4">
          AI-powered extraction
        </h3>
        <p className="font-body-md text-body-md text-muted-slate mb-8">
          No manual entry. AI extracts every field automatically from your tax
          documents.
        </p>
        <div className="relative bg-surface p-6 rounded-xl border border-border-gray overflow-hidden">
          <div className="scan-line absolute left-0 w-full z-10" />
          <div className="space-y-4 relative z-0">
            {[
              { k: "Employer Name", v: "Acme Corp." },
              { k: "Wages & Tips", v: "$95,000.00" },
              { k: "Federal Tax", v: "$18,500.00" },
            ].map((row) => (
              <div
                key={row.k}
                className="flex justify-between items-center pb-2 border-b border-border-gray"
              >
                <span className="font-label-md text-muted-slate">{row.k}</span>
                <span className="font-label-md text-deep-green bg-primary-fixed/30 px-2 rounded tabular-nums">
                  {row.v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="max-w-md">
        <h3 className="font-headline-lg text-headline-lg text-deep-green mb-4">
          Confirm a few details
        </h3>
        <p className="font-body-md text-body-md text-muted-slate mb-8">
          We ask a handful of quick questions to confirm your status from the
          documents.
        </p>
        <div className="bg-surface rounded-xl border border-border-gray shadow-sm overflow-hidden">
          <div className="bg-deep-green px-4 py-2 text-white font-label-md">
            Confirm your status
          </div>
          <div className="p-6 space-y-4">
            {[
              "Are you an F-1 visa student?",
              "Were you in the U.S. 5 years or less?",
              "Filing as a nonresident (1040-NR)?",
            ].map((q, i, arr) => (
              <div
                key={q}
                className={`flex items-center justify-between gap-4 ${
                  i < arr.length - 1
                    ? "pb-3 border-b border-border-gray"
                    : "pb-1"
                }`}
              >
                <span className="font-body-md text-body-md text-ink-navy">
                  {q}
                </span>
                <span className="inline-flex items-center gap-1 bg-mint-success text-forest-green px-2.5 py-1 rounded-full font-label-md shrink-0">
                  <span className="material-symbols-outlined text-[16px]">
                    check
                  </span>
                  Yes
                </span>
              </div>
            ))}
            <button
              type="button"
              className="w-full bg-deep-green text-white font-label-md py-3 rounded-lg hover:opacity-90 active:scale-95 transition-all mt-2"
            >
              Confirm &amp; Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h3 className="font-headline-lg text-headline-lg text-deep-green mb-4">
        Ready to send
      </h3>
      <p className="font-body-md text-body-md text-muted-slate mb-8">
        Get a filled 1040-NR, ready to print and mail. We provide clear
        instructions for every university office.
      </p>
      <div className="bg-mint-success/60 border border-forest-green/20 rounded-xl px-5 py-4 mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-label-md text-forest-green uppercase tracking-wider mb-0.5">
            Estimated refund
          </p>
          <div className="text-stats-numeric font-stats-numeric text-forest-green tabular-nums">
            $1,250.00
          </div>
        </div>
        <span className="material-symbols-outlined text-forest-green text-4xl">
          savings
        </span>
      </div>
      <div className="relative bg-white border border-border-gray rounded-xl p-6 shadow-sm flex items-center gap-6">
        <div className="w-20 h-28 bg-surface-container border border-border-gray flex items-center justify-center rounded relative">
          <span className="material-symbols-outlined text-3xl text-muted-slate">
            picture_as_pdf
          </span>
          <div className="absolute -top-2 -right-2 bg-forest-green text-white rounded-full p-1 shadow-md">
            <span className="material-symbols-outlined text-sm">check</span>
          </div>
        </div>
        <div>
          <h4 className="font-headline-md text-label-md text-deep-green font-bold">
            IRS Form 1040-NR
          </h4>
          <p className="text-xs text-muted-slate mb-3">
            Ready to print &amp; mail
          </p>
          <div className="inline-flex items-center gap-1.5 bg-mint-success px-2 py-1 rounded-full text-forest-green">
            <span className="material-symbols-outlined text-[14px]">
              auto_awesome
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              E-file support coming soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
