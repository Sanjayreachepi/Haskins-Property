"use client";
import SharedCountUp from "@haskins/shared/count-up";

export default function CountUp({
  to,
  duration = 1400,
}: {
  to: number;
  duration?: number;
}) {
  return <SharedCountUp to={to} duration={duration} threshold={0.4} />;
}
