import React from "react";
// @ts-ignore
import Balatro from "./Balatro";

export function CipherBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#080D0F]">
      <div className="absolute inset-0 opacity-[0.62]">
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

      <div className="absolute inset-0 bg-[#080D0F]/20" />

      <div
        className="
          absolute
          inset-0
          bg-[radial-gradient(
            circle_at_center,
            transparent_30%,
            rgba(8,13,15,0.45)_100%
          )]
        "
      />
      
      <div className="absolute inset-0 opacity-[0.025] bg-[url('/noise.png')]" />

    </div>
  );
}