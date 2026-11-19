"use client";

import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useEffect, useRef } from "react";

gsap.registerPlugin(MotionPathPlugin);

/**
 * Original layered illustration (duotone halftone collage): a hand reaching down with an apple and
 * an open hand reaching up. Layers are separate groups so they can animate independently.
 * Transforms and opacity only; static and fully visible with reduced motion.
 */
export function HeroHands({ className }: { className?: string }) {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // entrance: mask reveal from top and bottom
        gsap.from(".hh-top", { yPercent: -18, opacity: 0, duration: 1.4, ease: "power3.out" });
        gsap.from(".hh-bottom", { yPercent: 18, opacity: 0, duration: 1.4, ease: "power3.out", delay: 0.1 });
        gsap.from(".hh-path", { strokeDashoffset: 420, duration: 1.8, ease: "power2.inOut", delay: 0.6 });

        // the giving moment: ~6 s loop
        const loop = gsap.timeline({ repeat: -1, delay: 1.6, defaults: { ease: "sine.inOut" } });
        loop
          .to(".hh-top", { y: 10, rotation: -1.6, svgOrigin: "430 0", duration: 2.2 }, 0)
          .to(".hh-apple", { y: 12, rotation: 4, svgOrigin: "318 262", duration: 2.2 }, 0)
          .to(".hh-bottom", { y: -8, rotation: 1.2, svgOrigin: "150 640", duration: 2.2 }, 0)
          .to(".hh-fingers", { rotation: -4, scale: 1.03, svgOrigin: "262 404", duration: 2.2 }, 0)
          .fromTo(".hh-meet", { scale: 0, opacity: 0, svgOrigin: "318 330" },
            { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(3)" }, 2.1)
          .to(".hh-meet", { scale: 0, opacity: 0, duration: 0.5, ease: "power2.in" }, 2.9)
          .to([".hh-top", ".hh-apple", ".hh-bottom", ".hh-fingers"], { y: 0, rotation: 0, scale: 1, duration: 2.4 }, 3.2);

        gsap.to(".hh-shine", { opacity: 0.85, duration: 1.6, repeat: -1, yoyo: true, ease: "sine.inOut" });
        gsap.to(".hh-sparkle", { scale: 1.25, rotation: 45, svgOrigin: "120 150", duration: 1.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
        gsap.to(".hh-traveller", {
          motionPath: { path: ".hh-path", align: ".hh-path", alignOrigin: [0.5, 0.5] },
          duration: 4.5, repeat: -1, ease: "power1.inOut", delay: 2,
        });
      });

      const pause = () => (document.hidden ? gsap.globalTimeline.pause() : gsap.globalTimeline.resume());
      document.addEventListener("visibilitychange", pause);
      return () => document.removeEventListener("visibilitychange", pause);
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <svg ref={svg} viewBox="0 0 560 660" className={className} role="img" aria-labelledby="hh-title">
      <title id="hh-title">A hand offering a red apple to an open hand reaching up</title>
      <defs>
        <pattern id="hh-dots" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="1.5" cy="1.5" r="1.05" fill="#102F46" opacity=".55" />
        </pattern>
        <pattern id="hh-dots-light" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="2" cy="2" r="1.1" fill="#F4ECD8" opacity=".35" />
        </pattern>
        <linearGradient id="hh-skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E9DDC4" />
          <stop offset="1" stopColor="#B9AE98" />
        </linearGradient>
        <linearGradient id="hh-skin-2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E4D7BC" />
          <stop offset="1" stopColor="#A99F8B" />
        </linearGradient>
        <radialGradient id="hh-apple-g" cx=".38" cy=".32" r=".75">
          <stop offset="0" stopColor="#F0715F" />
          <stop offset=".55" stopColor="#C93A2E" />
          <stop offset="1" stopColor="#7E1F1A" />
        </radialGradient>
      </defs>

      {/* sparkle star and dotted path towards the apple */}
      <g className="hh-sparkle">
        <path d="M120 122 l6 22 22 6 -22 6 -6 22 -6 -22 -22 -6 22 -6z" fill="#FFE28A" />
        <circle cx="120" cy="150" r="18" fill="#FFE28A" opacity=".18" />
      </g>
      <path
        className="hh-path"
        d="M148 150 C 200 120, 262 150, 296 216"
        fill="none"
        stroke="#F4ECD8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 9"
        style={{ strokeDashoffset: 0 }}
        opacity=".7"
      />
      <circle className="hh-traveller" cx="148" cy="150" r="4" fill="#FFE28A" />

      {/* TOP: sleeve + hand holding the apple, reaching down from the top-right */}
      <g className="hh-top">
        <path d="M440 -320 L580 -320 L470 132 C 452 150, 404 156, 378 140 Z" fill="#164B70" />
        <path d="M440 -320 L580 -320 L470 132 C 452 150, 404 156, 378 140 Z" fill="url(#hh-dots-light)" />
        <path d="M384 128 C 400 150, 452 150, 470 132" fill="none" stroke="#102F46" strokeWidth="5" opacity=".5" />
        {/* back of the hand */}
        <path
          d="M380 140 C 372 160, 360 178, 344 196 C 330 210, 312 214, 300 210 C 290 206, 290 194, 300 186 L 334 158 C 350 146, 366 136, 380 140 Z"
          fill="url(#hh-skin)"
          stroke="#102F46"
          strokeWidth="2.5"
        />
        <path d="M380 140 C 372 160, 360 178, 344 196 C 330 210, 312 214, 300 210" fill="url(#hh-dots)" opacity=".45" />
        {/* thumb along the apple's side */}
        <path
          d="M372 166 C 376 196, 372 226, 360 246 C 354 256, 344 254, 344 244 C 346 222, 348 200, 352 180 Z"
          fill="url(#hh-skin-2)"
          stroke="#102F46"
          strokeWidth="2.5"
        />
        {/* apple */}
        <g className="hh-apple">
          <path
            d="M318 214 C 296 200, 262 206, 254 238 C 246 270, 262 304, 290 312 C 304 316, 310 310, 318 310 C 326 310, 332 316, 346 312 C 374 304, 386 270, 378 240 C 370 208, 340 200, 318 214 Z"
            fill="url(#hh-apple-g)"
            stroke="#5A1612"
            strokeWidth="2"
          />
          <path d="M318 214 C 316 204, 318 196, 324 188" stroke="#4A3423" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M324 196 C 334 182, 352 182, 360 190 C 350 198, 336 200, 324 196 Z" fill="#2F6B4F" />
          <ellipse className="hh-shine" cx="282" cy="238" rx="10" ry="18" fill="#FFF6E6" opacity=".55" transform="rotate(24 282 238)" />
          <path d="M318 214 C 296 200, 262 206, 254 238 C 246 270, 262 304, 290 312" fill="url(#hh-dots)" opacity=".25" />
        </g>
        {/* fingers wrapping over the top of the apple */}
        <g stroke="#102F46" strokeWidth="2.5" fill="url(#hh-skin)">
          <path d="M300 186 C 286 190, 270 202, 262 220 C 258 230, 266 236, 274 228 C 282 216, 294 206, 308 200 Z" />
          <path d="M314 194 C 298 202, 286 218, 280 236 C 278 246, 288 248, 292 240 C 298 226, 310 214, 322 208 Z" />
          <path d="M330 196 C 318 206, 310 224, 308 242 C 308 252, 318 252, 320 244 C 322 228, 330 216, 340 208 Z" />
        </g>
      </g>

      {/* BOTTOM: sleeve + open hand reaching up from the bottom-left, with a thread bracelet */}
      <g className="hh-bottom">
        <path d="M-60 900 L100 900 C 170 740, 230 560, 248 462 L 196 436 C 150 540, 60 720, -60 900 Z" fill="#287FA6" />
        <path d="M-60 900 L100 900 C 170 740, 230 560, 248 462 L 196 436 C 150 540, 60 720, -60 900 Z" fill="url(#hh-dots)" opacity=".5" />
        {/* wrist + palm */}
        <path
          d="M196 436 C 204 410, 222 390, 246 378 C 270 366, 300 366, 316 378 C 328 388, 322 404, 306 412 C 290 420, 276 432, 266 448 C 260 458, 252 466, 248 462 Z"
          fill="url(#hh-skin-2)"
          stroke="#102F46"
          strokeWidth="2.5"
        />
        <path d="M196 436 C 204 410, 222 390, 246 378 C 262 370, 280 368, 294 370" fill="url(#hh-dots)" opacity=".4" />
        {/* thread bracelet */}
        <g>
          <path d="M194 440 C 210 452, 232 462, 250 464" stroke="#E87968" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M196 448 C 212 460, 232 468, 248 470" stroke="#FFE28A" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="5 4" />
          <circle cx="224" cy="458" r="4" fill="#F4ECD8" stroke="#102F46" strokeWidth="1.5" />
        </g>
        {/* fingers opening towards the apple */}
        <g className="hh-fingers" stroke="#102F46" strokeWidth="2.5" fill="url(#hh-skin)">
          <path d="M300 372 C 314 356, 330 342, 344 336 C 354 332, 360 340, 352 348 C 340 360, 326 372, 314 384 Z" />
          <path d="M310 386 C 328 376, 346 368, 360 366 C 370 366, 372 376, 362 380 C 348 386, 334 394, 320 400 Z" />
          <path d="M306 404 C 322 400, 340 398, 352 400 C 362 402, 360 412, 350 412 C 336 414, 322 416, 308 418 Z" />
          <path d="M284 368 C 292 348, 304 330, 316 320 C 324 314, 332 322, 326 330 C 316 344, 306 360, 298 376 Z" />
          <path d="M236 382 C 232 362, 236 342, 244 330 C 250 322, 260 328, 256 338 C 252 352, 252 368, 256 384 Z" />
        </g>
      </g>

      {/* the almost-meeting spark */}
      <g className="hh-meet" opacity="0">
        <path d="M318 318 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z" fill="#FFE28A" />
      </g>
    </svg>
  );
}
