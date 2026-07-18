"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "#faq", label: "FAQ" },
];

const NAV_LINK_CLASS =
  "text-on-surface-variant font-medium hover:text-brand transition-colors font-label-md text-label-md";

export function SiteNav() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    // Collapse the nav into a floating pill once the user scrolls past the top.
    const onScroll = () => {
      nav.classList.toggle("scrolled", window.scrollY > 40);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      ref={navRef}
      id="top-nav"
      className="fixed left-1/2 -translate-x-1/2 rounded-full z-50"
    >
      <div className="nav-inner flex justify-between items-center w-full">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-headline-md text-headline-md font-bold text-brand">
            TaxBuddy
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) =>
            link.href.startsWith("#") ? (
              // Same-page anchor — plain <a> for smooth scroll.
              <a key={link.href} className={NAV_LINK_CLASS} href={link.href}>
                {link.label}
              </a>
            ) : (
              // Route link (e.g. /contact) — client navigation.
              <Link key={link.href} className={NAV_LINK_CLASS} href={link.href}>
                {link.label}
              </Link>
            ),
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link
            className="text-brand font-label-md text-label-md hover:text-brand transition-colors hidden sm:block"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className="bg-deep-green text-pure-white px-4 py-2 rounded-full font-label-md text-label-md font-bold hover:bg-brand transition-colors"
            href="/signup"
          >
            Start filing free
          </Link>
        </div>
      </div>
    </nav>
  );
}
