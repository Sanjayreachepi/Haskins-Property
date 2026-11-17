"use client";
import { useState } from "react";

export default function CompareSlider({
  before,
  after,
  beforeAlt,
  afterAlt,
}: {
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
}) {
  const [pos, setPos] = useState(50);
  return (
    <div className="hk-compare">
      <img src={after} alt={afterAlt} />
      <img
        className="hk-compare-before"
        src={before}
        alt={beforeAlt}
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <div className="hk-compare-bar" aria-hidden="true" style={{ left: `${pos}%` }} />
      <div className="hk-compare-knob" aria-hidden="true" style={{ left: `${pos}%` }}>
        <svg width="30" height="16" viewBox="0 0 30 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square">
          <path d="M8 2 2 8l6 6M22 2l6 6-6 6" />
        </svg>
      </div>
      <span className="disp hk-compare-tag">1960s</span>
      <span className="disp hk-compare-tag right">Today</span>
      <input
        className="hk-compare-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare the 1960s aerial with today"
      />
    </div>
  );
}
