export function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square">
      <path d="M6 18 18 6M8 6h10v10" />
    </svg>
  );
}
export function ArrowRight() {
  return (
    <svg className="arr-r" aria-hidden="true" width="18" height="14" viewBox="0 0 28 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square">
      <path d="M2 10h22M17 3l7 7-7 7" />
    </svg>
  );
}
export function Spark() {
  return (
    <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1 14.2 9.8 23 12 14.2 14.2 12 23 9.8 14.2 1 12 9.8 9.8z" />
    </svg>
  );
}
