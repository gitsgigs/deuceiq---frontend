import { useState } from "react";
import "./FrontDeskCourt.css";

export function FrontDeskCourt() {
  const [paused, setPaused] = useState(false);
  return <div className={`front-desk-court ${paused ? "is-paused" : ""}`}>
    <svg viewBox="0 0 600 300" aria-hidden="true" focusable="false">
      <circle cx="105" cy="140" r="92" fill="#dac8f5" opacity=".35" />
      <circle cx="484" cy="158" r="104" fill="#ffcfb9" opacity=".35" />
      <g transform="translate(110 38) rotate(-6 190 110)">
        <rect x="-12" y="-12" width="404" height="244" rx="28" fill="#452d64" opacity=".1" />
        <rect width="380" height="220" rx="18" fill="#7e69ad" />
        <rect x="22" y="20" width="336" height="180" fill="#b8e1d3" stroke="#fffaf5" strokeWidth="3" />
        <g fill="none" stroke="#fffaf5" strokeWidth="3">
          <path d="M22 44H358M22 176H358M190 20V200M105 44V176M275 44V176M105 110H275" />
        </g>
        <path d="M190 12V208" stroke="#493463" strokeWidth="5" />
        <path d="M190 16V204" stroke="#fffaf5" strokeWidth="1.5" strokeDasharray="3 4" />
        <g className="front-desk-ball">
          <ellipse cx="0" cy="8" rx="11" ry="5" fill="#493463" opacity=".2" />
          <circle r="9" fill="#f7ed7a" stroke="#9d943e" strokeWidth="1" />
          <path d="M-6-6Q3 0-6 6M6-6Q-3 0 6 6" fill="none" stroke="#fffdf0" strokeWidth="1.4" />
        </g>
      </g>
      <path d="M62 230v12m-6-6h12M528 58v12m-6-6h12" stroke="#aa8bcb" strokeWidth="3" strokeLinecap="round" />
      <circle cx="80" cy="64" r="4" fill="#e7b68a" /><circle cx="536" cy="232" r="5" fill="#84b9ab" />
    </svg>
    <div className="front-desk-court-caption"><span>A little court-side calm.</span><button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "Resume animation" : "Pause animation"}</button></div>
  </div>;
}
