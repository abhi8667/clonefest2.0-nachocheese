import React, { useEffect, useState } from "react";
import {
  Compass,
  Terminal,
  ArrowRight,
  LockKeyhole,
  ShieldCheck,
  Activity,
} from "lucide-react";

// @ts-ignore
import Balatro from "./Balatro";

interface ModeSelectionScreenProps {
  onSelect: (mode: "guided" | "operator") => void;
}

export function ModeSelectionScreen({ onSelect }: ModeSelectionScreenProps) {
  const [mouse, setMouse] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMouse({
        x: (event.clientX / window.innerWidth) * 100,
        y: (event.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05080b] text-white">
      {/* =========================================================
          BALATRO BACKGROUND
      ========================================================= */}

      <div className="absolute inset-0 z-0">
        <Balatro
          spinRotation={-2}
          spinSpeed={7}
          color1="#DE443B"
          color2="#006BB4"
          color3="#162325"
          contrast={3.5}
          lighting={0.4}
          spinAmount={0.25}
          pixelFilter={745}
        />
      </div>

      {/* Dark cinematic vignette */}

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          z-[1]
          bg-[radial-gradient(
            circle_at_center,
            transparent_15%,
            rgba(5,8,11,0.08)_40%,
            rgba(5,8,11,0.55)_100%
          )]
        "
      />

      {/* Very subtle dark layer */}

      <div className="pointer-events-none absolute inset-0 z-[2] bg-black/10" />

      {/* =========================================================
          MOUSE FOLLOWING LIGHT
      ========================================================= */}

      <div
        className="pointer-events-none absolute inset-0 z-[3] transition-all duration-150"
        style={{
          background: `
            radial-gradient(
              500px circle at ${mouse.x}% ${mouse.y}%,
              rgba(0,132,255,0.10),
              transparent 65%
            )
          `,
        }}
      />

      {/* =========================================================
          TECHNICAL GRID
      ========================================================= */}

      <div
        className="pointer-events-none absolute inset-0 z-[4] opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(
              rgba(255,255,255,0.12) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255,255,255,0.12) 1px,
              transparent 1px
            )
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Scanlines */}

      <div
        className="pointer-events-none absolute inset-0 z-[5] opacity-[0.025]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 4px)",
        }}
      />

      {/* =========================================================
          TOP SYSTEM BAR
      ========================================================= */}

      <header
        className="
          absolute
          top-0
          left-0
          right-0
          z-30
          flex
          items-center
          justify-between
          px-6
          md:px-10
          py-7
          border-b
          border-white/[0.08]
          bg-[#05080b]/45
          backdrop-blur-md
        "
      >
        <div
          className="
            flex
            items-center
            gap-3
            font-mono
            text-[9px]
            md:text-[10px]
            tracking-[0.25em]
            text-slate-400
          "
        >
          <span
            className="
              h-1.5
              w-1.5
              rounded-full
              bg-cyan-400
              shadow-[0_0_12px_rgba(34,211,238,0.9)]
              animate-pulse
            "
          />
          crypton // SECURE NODE
        </div>

        <div
          className="
            hidden
            md:flex
            items-center
            gap-6
            font-mono
            text-[9px]
            tracking-[0.2em]
            text-slate-500
          "
        >
          <span>NODE: LOCAL</span>

          <span className="text-slate-700">/</span>

          <span className="text-emerald-400">ENCRYPTION: ACTIVE</span>

          <span className="text-slate-700">/</span>

          <span>v1.0.0</span>
        </div>
      </header>

      {/* =========================================================
          MAIN CONTENT
      ========================================================= */}

      <main
        className="
          relative
          z-20
          min-h-screen
          flex
          flex-col
          items-center
          justify-center
          px-6
          pt-20
          pb-24
        "
      >
        {/* =====================================================
            HEADER
        ===================================================== */}

        <section className="text-center mb-7">
          <div
            className="
              flex
              items-center
              justify-center
              gap-4
              mb-4
              font-mono
              text-[9px]
              tracking-[0.35em]
              text-slate-300
              mt-2
            "
          >
            <span className="text-cyan-400">///</span>

            <span>SECURE SECRET EXCHANGE</span>

            <span className="text-red-400">///</span>
          </div>

          {/* Logo */}

          <div className="relative inline-block">
            <h1
              className="
                text-7xl
                md:text-9xl
                font-black
                tracking-[-0.065em]
                leading-none
                drop-shadow-[0_10px_40px_rgba(0,0,0,0.45)]
                unica-one
              "
            >
              Crypton
            </h1>

            <span
              className="
                absolute
                -right-6
                bottom-1
                font-mono
                text-base
                text-white
                animate-pulse
              "
            >
              _
            </span>
          </div>

          {/* Subtitle */}

          <div
            className="
              mt-5
              flex
              items-center
              justify-center
              gap-3
            "
          >
            <span
              className="
                hidden
                sm:block
                h-px
                w-10
                bg-gradient-to-r
                from-transparent
                to-white/30
              "
            />

            <p
              className="
                text-xs
                md:text-sm
                text-slate-300
                drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]
                font-mono
              "
            >
              Choose your operating environment
            </p>

            <span
              className="
                hidden
                sm:block
                h-px
                w-10
                bg-gradient-to-l
                from-transparent
                to-white/30
              "
            />
          </div>
        </section>

        {/* =====================================================
            MODE CARDS
        ===================================================== */}

        <section
          className="
            grid
            w-full
            max-w-2xl
            gap-4
            md:grid-cols-2
            mt-7
          "
        >
          {/* ===================================================
                        GUIDED (Compact Fit)
            =================================================== */}

          <button
            onClick={() => onSelect("guided")}
            className="
    group
    relative
    overflow-hidden
    rounded-[18px]
    border
    border-white/[0.12]
    bg-black/5
    backdrop-blur-lg
    p-4
    text-left
    transition-all
    duration-300
    hover:-translate-y-1
    hover:border-[#0084ff]/60
    hover:bg-white/10
  "
          >
            <div className="relative z-10 flex flex-col justify-between h-full">
              {/* Header Row: Compass + Titles Inline */}
              <div>
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div
                    className="
            relative
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-xl
            border
            border-[#0084ff]/30
            bg-[rgba(0,132,255,0.15)]
            text-[#4de4ff]
          "
                  >
                    <Compass size={18} />

                    <span
                      className="
              absolute
              -right-0.5
              -top-0.5
              h-2
              w-2
              rounded-full
              bg-cyan-300
              shadow-[0_0_10px_#22d3ee]
            "
                    />
                  </div>

                  {/* Mode 01 & Guided */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] tracking-[0.2em] text-cyan-400">
                        MODE 01
                      </span>
                      <span className="font-mono text-[8px] tracking-wider text-slate-600 transition-colors group-hover:text-cyan-400">
                        [ SAFE ]
                      </span>
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-white leading-none mt-0.5">
                      Guided
                    </h2>
                  </div>
                </div>

                {/* Shortened Description */}
                <p className="mt-2 text-[11px] leading-snug text-slate-400 line-clamp-2">
                  Black magic hidden. Secrets moved cleanly.
                </p>
              </div>

              {/* Action Footer */}
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-2.5">
                <span className="font-mono text-[9px] tracking-[0.15em] text-slate-500 transition-colors group-hover:text-white">
                  INITIALIZE SESSION
                </span>

                <div
                  className="
          flex
          h-6
          w-6
          items-center
          justify-center
          rounded-full
          border
          border-white/10
          transition-colors
          group-hover:border-cyan-400/60
          group-hover:bg-cyan-400/10
        "
                >
                  <ArrowRight
                    size={12}
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  />
                </div>
              </div>
            </div>
          </button>


          {/* ===================================================
                        OPERATOR
          =================================================== */}

<button
  onClick={() => onSelect("operator")}
  className="
    group
    relative
    overflow-hidden
    rounded-[18px]
    border
    border-white/[0.12]
    bg-black/5
    backdrop-blur-lg
    p-4
    text-left
    transition-all
    duration-300
    hover:-translate-y-1
    hover:border-[#e63946]/60
    hover:bg-white/10
  "
>
  <div className="relative z-10 flex flex-col justify-between h-full">
    {/* Header Row: Terminal Icon + Titles Inline */}
    <div>
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className="
            relative
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-xl
            border
            border-[#e63946]/30
            bg-[rgba(230,57,70,0.15)]
            text-[#ff5c67]
          "
        >
          <Terminal size={18} />
        </div>

        {/* Mode 02 & Operator */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] tracking-[0.2em] text-[#ff5c67]">
              MODE 02
            </span>
            <span className="font-mono text-[8px] tracking-wider text-slate-600 transition-colors group-hover:text-red-400">
              [ ROOT ]
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white leading-none mt-0.5">
            Operator
          </h2>
        </div>
      </div>

      {/* Quirky Shortened Description */}
      <p className="mt-2 text-[11px] leading-snug text-slate-400">
        Raw telemetry unleashed. Pop the hood.
      </p>
    </div>

    {/* Action Footer */}
    <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-2.5">
      <span className="font-mono text-[9px] tracking-[0.15em] text-slate-500 transition-colors group-hover:text-white">
        OPEN TERMINAL
      </span>

      <div
        className="
          flex
          h-6
          w-6
          items-center
          justify-center
          rounded-full
          border
          border-white/10
          transition-colors
          group-hover:border-red-400/60
          group-hover:bg-red-400/10
        "
      >
        <ArrowRight
          size={12}
          className="transition-transform duration-300 group-hover:translate-x-0.5"
        />
      </div>
    </div>
  </div>
</button>
        </section>

        {/* =====================================================
            SECURITY STATUS
        ===================================================== */}

        <div
          className="
            mt-6
            flex
            flex-wrap
            items-center
            justify-center
            gap-x-4
            gap-y-2
            font-mono
            text-[8px]
            tracking-[0.18em]
            text-slate-300
            drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]
          "
        >
          <span className="flex items-center gap-2">
            <span
              className="
                h-1.5
                w-1.5
                rounded-full
                bg-emerald-400
                shadow-[0_0_8px_#34d399]
                animate-pulse
              "
            />
            ALL SYSTEMS OPERATIONAL
          </span>

          <span className="text-white/30">///</span>

          <span>AES-256-GCM</span>

          <span className="text-white/30">///</span>

          <span>ZERO-KNOWLEDGE</span>

          <span className="text-white/30">///</span>

          <span>E2EE</span>
        </div>
      </main>

      {/* =========================================================
          FLOATING SECURITY DOCK
      ========================================================= */}

      <div
        className="
          fixed
          bottom-4
          left-1/2
          z-40
          -translate-x-1/2
          flex
          items-center
          gap-1
          rounded-full
          border
          border-white/[0.12]
          bg-[rgba(8,13,18,0.92)]
          px-2
          py-1.5
          shadow-[0_15px_60px_rgba(0,0,0,0.55)]
          backdrop-blur-xl
        "
      >
        {/* Encryption */}

        <div
          className="
            flex
            items-center
            gap-2
            rounded-full
            px-3
            py-1.5
            font-mono
            text-[8px]
            tracking-[0.1em]
            text-slate-300
          "
        >
          <LockKeyhole size={11} className="text-cyan-400" />

          <span className="hidden sm:inline">CLIENT-SIDE ENCRYPTION</span>

          <span className="sm:hidden">CLIENT ENCRYPTED</span>
        </div>

        <div
          className="
            hidden
            sm:block
            h-4
            w-px
            bg-white/[0.10]
          "
        />

        {/* Zero knowledge */}

        <div
          className="
            hidden
            sm:flex
            items-center
            gap-2
            rounded-full
            px-3
            py-1.5
            font-mono
            text-[8px]
            tracking-[0.1em]
            text-slate-300
          "
        >
          <ShieldCheck size={11} className="text-emerald-400" />
          ZERO SERVER KNOWLEDGE
        </div>

        <div
          className="
            hidden
            md:block
            h-4
            w-px
            bg-white/[0.10]
          "
        />

        {/* E2EE */}

        <div
          className="
            hidden
            md:flex
            items-center
            gap-2
            rounded-full
            px-3
            py-1.5
            font-mono
            text-[8px]
            tracking-[0.1em]
            text-slate-300
          "
        >
          <Activity size={11} className="text-red-400" />
          E2EE ACTIVE
        </div>
      </div>
    </div>
  );
}
