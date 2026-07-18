"use client";

import { useState } from "react";
import Image from "next/image";

// Facade / click-to-play: the landing page ships only the lightweight thumbnail
// (~61 KB). The 41 MB video is fetched on demand — the <video> is not mounted
// until the visitor clicks play, keeping initial page load fast.
export function DemoVideo() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative max-w-4xl mx-auto rounded-12px overflow-hidden shadow-lg border border-border-gray aspect-video group bg-ink-navy">
      {playing ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- product demo, no captions track yet
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/demo/TaxBuddy_Demo.mp4"
          poster="/demo/thumbnail.jpg"
          controls
          autoPlay
          playsInline
          preload="none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="Play the TaxBuddy demo video"
          className="absolute inset-0 h-full w-full cursor-pointer"
        >
          <Image
            src="/demo/thumbnail.jpg"
            alt="TaxBuddy product demo thumbnail"
            fill
            sizes="(max-width: 896px) 100vw, 896px"
            className="object-cover"
          />
          <span className="absolute inset-0 bg-ink-navy/20 group-hover:bg-ink-navy/10 transition-colors duration-300" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-20 h-20 bg-deep-green rounded-full flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-pure-white text-[40px] ml-2">
                play_arrow
              </span>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
