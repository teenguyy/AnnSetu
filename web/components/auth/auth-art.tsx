import { cn } from "@/lib/utils";

const DECK = "M-10 300 C 120 250, 260 250, 400 300 C 520 342, 600 330, 650 300";

/** Decorative auth illustrations (aria-hidden): never delays or hides the form. */
export function AuthArt({ variant }: { variant: "signin" | "donor" | "receiver" }) {
  const warm = variant === "donor";
  return (
    <div
      aria-hidden
      className={cn(
        "grain relative hidden overflow-hidden lg:block",
        warm ? "bg-[#2a3b2f] bg-gradient-to-br from-[#5b4a1f] via-[#3b3a24] to-ink" : "bg-gradient-to-br from-deep-ocean via-[#123d5c] to-ink",
      )}
    >
      <svg viewBox="0 0 640 640" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        {/* pylon */}
        <g fill={warm ? "#F5D98B" : "#82C5DF"} opacity=".9">
          <path d="M300 60 h12 L250 360 h-12 Z" />
          <path d="M306 60 h20 L360 360 h-22 Z" />
        </g>
        <g stroke={warm ? "#F5D98B" : "#82C5DF"} strokeWidth="1.5" opacity=".55">
          <path d="M312 70 L150 285" />
          <path d="M312 70 L210 270" />
          <path d="M318 70 L470 300" />
          <path d="M318 70 L560 320" />
        </g>
        {/* deck */}
        <path className="aa-deck" d={DECK} fill="none" stroke={warm ? "#FFE28A" : "#287FA6"} strokeWidth="14" strokeLinecap="round" pathLength={1} />

        {variant === "signin" && (
          <g className="aa-node" style={{ offsetPath: `path("${DECK}")` }}>
            <circle r="16" fill="#FFE28A" stroke="#102F46" strokeWidth="5" />
          </g>
        )}

        {variant === "donor" && (
          <g className="aa-crate" style={{ offsetPath: `path("${DECK}")` }}>
            <g transform="translate(0 -26)">
              <ellipse cx="0" cy="18" rx="46" ry="9" fill="#102F46" opacity=".35" />
              <path d="M-44 6 H44 C 40 22, 26 28, 0 28 C -26 28, -40 22, -44 6 Z" fill="#F4ECD8" stroke="#102F46" strokeWidth="3" />
              <path d="M-36 6 C -30 -26, 30 -26, 36 6 Z" fill="#E87968" stroke="#102F46" strokeWidth="3" />
              <circle cx="0" cy="-20" r="5" fill="#102F46" />
              <g className="aa-steam" stroke="#F4ECD8" strokeWidth="3" fill="none" strokeLinecap="round">
                <path d="M-14 -34 c -6 -8, 6 -12, 0 -22" />
                <path d="M12 -34 c -6 -8, 6 -12, 0 -22" />
              </g>
            </g>
          </g>
        )}

        {variant === "receiver" && (
          <g className="aa-bank" transform="translate(-150 -20)">
            {/* far bank with community figures and open hands */}
            <path d="M440 420 C 520 390, 600 400, 680 380 V 640 H 440 Z" fill="#102F46" opacity=".8" />
            {[470, 515, 560, 600].map((x, i) => (
              <g key={x} className="aa-figure" style={{ animationDelay: `${0.5 + i * 0.15}s` }}>
                <circle cx={x} cy={392 - (i % 2) * 8} r="12" fill="#A8D9E9" />
                <path d={`M${x - 15} ${440 - (i % 2) * 8} C ${x - 15} ${408 - (i % 2) * 8}, ${x + 15} ${408 - (i % 2) * 8}, ${x + 15} ${440 - (i % 2) * 8} Z`} fill="#287FA6" />
              </g>
            ))}
            <g className="aa-hands" fill="#F4ECD8" stroke="#102F46" strokeWidth="3">
              <path d="M470 340 C 470 318, 500 312, 512 322 C 520 312, 548 316, 548 340 C 530 352, 488 352, 470 340 Z" />
            </g>
            <g className="aa-node-recv">
              <circle cx="509" cy="312" r="13" fill="#FFE28A" stroke="#102F46" strokeWidth="4" />
            </g>
          </g>
        )}
      </svg>
      <div className="absolute inset-x-10 bottom-10 text-cream">
        <p className="font-hand text-3xl">
          {variant === "donor" ? "Your surplus, someone’s dinner." : variant === "receiver" ? "Food that reaches your community." : "Welcome back to the bridge."}
        </p>
      </div>
      <style>{`
        .aa-deck { stroke-dasharray: 1; stroke-dashoffset: 1; animation: aa-draw 1.1s cubic-bezier(.65,0,.35,1) .1s forwards; }
        .aa-node, .aa-crate { offset-rotate: 0deg; offset-distance: 0%; opacity: 0; animation: aa-cross 2.2s cubic-bezier(.22,1,.36,1) 1s forwards; }
        .aa-crate { animation-duration: 2.8s; }
        .aa-steam path { animation: aa-steam 1.8s ease-in-out infinite; }
        .aa-steam path:nth-child(2) { animation-delay: .4s; }
        .aa-figure { opacity: 0; animation: aa-rise .7s ease-out forwards; }
        .aa-hands, .aa-node-recv { opacity: 0; animation: aa-rise .8s ease-out 1.2s forwards; }
        .aa-node-recv { animation-delay: 1.6s; }
        @keyframes aa-draw { to { stroke-dashoffset: 0; } }
        @keyframes aa-cross { 0% { opacity: 1; offset-distance: 0%; } 100% { opacity: 1; offset-distance: 58%; } }
        @keyframes aa-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes aa-steam { 0% { opacity: 0; transform: translateY(4px); } 50% { opacity: .9; } 100% { opacity: 0; transform: translateY(-8px); } }
      `}</style>
    </div>
  );
}
