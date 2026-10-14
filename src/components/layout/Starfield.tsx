/**
 * Decorative night-sky backdrop for the sidebar rail.
 * Stars are generated from a fixed seed so the sky is identical on every render.
 */

// Small deterministic PRNG (mulberry32) — no layout shift between renders.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 256;
const H = 1000;

const rand = rng(16949);
const STARS = Array.from({ length: 90 }, () => ({
  x: rand() * W,
  y: rand() * H,
  r: 0.35 + rand() * 0.8,
  o: 0.3 + rand() * 0.6,
  twinkle: rand() < 0.3,
  dur: 2.4 + rand() * 3.6,
  delay: rand() * 5,
}));

// Brighter four-point sparkles, placed by hand to avoid crowding the nav labels.
const SPARKLES = [
  { x: 214, y: 92, s: 5, c: '#FFFFFF', delay: 0 },
  { x: 36, y: 318, s: 4, c: '#BACDEB', delay: 1.6 },
  { x: 228, y: 472, s: 3.5, c: '#FFFFFF', delay: 3.1 },
  { x: 58, y: 690, s: 5, c: '#BACDEB', delay: 0.8 },
  { x: 196, y: 862, s: 4, c: '#FFFFFF', delay: 2.4 },
];

function sparklePath(x: number, y: number, s: number) {
  const k = s * 0.22;
  return `M${x} ${y - s} Q${x + k} ${y - k} ${x + s} ${y} Q${x + k} ${y + k} ${x} ${y + s} Q${x - k} ${y + k} ${x - s} ${y} Q${x - k} ${y - k} ${x} ${y - s}Z`;
}

export default function Starfield() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Nebula glow */}
      <div className="absolute -top-16 -left-20 size-64 rounded-full bg-brand-400 opacity-35 blur-[70px]" />
      <div className="absolute top-[45%] -right-24 size-56 rounded-full bg-indigo opacity-40 blur-[70px]" />
      <div className="absolute -bottom-20 -left-10 size-72 rounded-full bg-accent opacity-25 blur-[80px]" />

      <svg className="absolute inset-0 size-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="shooting-star" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="sparkle-glow">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#FFFFFF"
            opacity={s.o}
            className={s.twinkle ? 'star-twinkle' : undefined}
            style={s.twinkle ? { animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` } : undefined}
          />
        ))}

        {SPARKLES.map((s, i) => (
          <g key={i} className="star-twinkle" style={{ animationDuration: '4.5s', animationDelay: `${s.delay}s` }}>
            <circle cx={s.x} cy={s.y} r={s.s * 1.8} fill="url(#sparkle-glow)" />
            <path d={sparklePath(s.x, s.y, s.s)} fill={s.c} />
          </g>
        ))}

        {/* Shooting star — crosses the upper sky every few seconds */}
        <g className="shooting-star">
          <line x1="0" y1="0" x2="46" y2="0" stroke="url(#shooting-star)" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="46" cy="0" r="1.3" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  );
}
