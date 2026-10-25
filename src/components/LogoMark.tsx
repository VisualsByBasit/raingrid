// The logo's glass droplet, shown next to the RAIN//GRID wordmark. Built by
// scripts/build-logo.mjs; decorative, the wordmark carries the name.
export default function LogoMark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 19 KB static mark, already sized
    <img src="/media/logo-mark.png" alt="" aria-hidden width={96} height={96} className={`shrink-0 ${className}`} draggable={false} />
  );
}
