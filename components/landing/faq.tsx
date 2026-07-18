"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "Who is TaxBuddy for?",
    a: "TaxBuddy is built specifically for non-resident aliens in the U.S., including international students on F, J, M, and Q visas, who need to file Form 1040-NR.",
  },
  {
    q: "Do I qualify as a nonresident?",
    a: "Generally, if you are an international student on an F-1 or J-1 visa and have been in the U.S. for less than 5 calendar years, you are considered a non-resident for tax purposes.",
  },
  {
    q: "How much does it cost?",
    a: "TaxBuddy is currently free to use as we want to help as many students as possible file correctly and easily.",
  },
  {
    q: "Is my data safe?",
    a: "Yes, we use bank-level encryption for all data transmission and storage. We never share or sell your personal information.",
  },
  {
    q: "Which forms do you support?",
    a: "We support generating Form 1040-NR, Form 8843, and handle inputs from W-2, 1099-INT, 1099-DIV, and 1042-S.",
  },
  {
    q: "Can I e-file?",
    a: "Currently, the IRS has restrictions on e-filing 1040-NR for many users. We provide complete, filled-out forms ready to print and mail. Direct e-file support is coming soon.",
  },
];

export function Faq() {
  // First item open by default, matching the original static page.
  const [open, setOpen] = useState(0);

  return (
    <div className="max-w-3xl mx-auto divide-y divide-border-gray border-t border-b border-border-gray">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="py-4">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              className="faq-button flex w-full items-center justify-between text-left focus:outline-none"
            >
              <span className="font-headline-md text-body-lg font-bold text-ink-navy">
                {item.q}
              </span>
              <span className="material-symbols-outlined text-muted-slate transition-transform">
                {isOpen ? "remove" : "add"}
              </span>
            </button>
            {isOpen && (
              <div className="mt-4 text-muted-slate font-body-md pr-8">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
