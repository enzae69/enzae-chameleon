import type { ReactNode } from "react";

export function Background({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-full w-full overflow-hidden bg-gradient-to-b from-cham-900 via-[#0b2018] to-black text-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-cham-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6">
        {children}
      </div>
    </div>
  );
}

export function Logo({ size = "text-4xl" }: { size?: string }) {
  return (
    <div className={`font-display font-extrabold ${size} tracking-tight`}>
      <span className="text-cham-300">enzae</span>{" "}
      <span className="text-white">Chameleon</span> <span className="align-middle">🦎</span>
    </div>
  );
}
