import { motion } from 'framer-motion';

/**
 * Hero-sized illustration for the Overview. Shows a miniature Bronze → Silver
 * → Gold pipeline with flowing data particles, rotating orbit rings, and a
 * floating fact/dim cluster. All pure SVG (global no-emoji rule).
 */
export function DataFlowIllustration() {
  return (
    <svg viewBox="0 0 520 440" className="w-full h-auto">
      <defs>
        <radialGradient id="bronzeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#b07b3a" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#b07b3a" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="silverGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c6cbd1" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#c6cbd1" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f1b02c" stopOpacity={1} />
          <stop offset="100%" stopColor="#f1b02c" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="bzToSv2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b07b3a" />
          <stop offset="100%" stopColor="#c6cbd1" />
        </linearGradient>
        <linearGradient id="svToGd2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c6cbd1" />
          <stop offset="100%" stopColor="#f1b02c" />
        </linearGradient>
        <filter id="softBlur">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* Faint orbit rings */}
      <g stroke="rgba(255,255,255,0.07)" fill="none">
        <motion.ellipse
          cx={260} cy={220} rx={200} ry={130}
          strokeDasharray="3 5"
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '260px 220px' }}
        />
        <motion.ellipse
          cx={260} cy={220} rx={150} ry={95}
          strokeDasharray="2 6"
          initial={{ rotate: 0 }}
          animate={{ rotate: -360 }}
          transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '260px 220px' }}
        />
      </g>

      {/* Bronze tank */}
      <g>
        <circle cx={80} cy={220} r={62} fill="url(#bronzeGlow)" opacity={0.45} filter="url(#softBlur)" />
        <rect
          x={40} y={180} width={80} height={80} rx={18}
          fill="rgba(176,123,58,0.12)"
          stroke="rgba(176,123,58,0.7)"
          strokeWidth={1.3}
        />
        <text x={80} y={220} textAnchor="middle" fill="#f1dfc3" fontSize={14} fontFamily="Fraunces" fontWeight={600}>Bronze</text>
        <text x={80} y={238} textAnchor="middle" fill="#f1dfc3" fontSize={10} fontFamily="monospace" opacity={0.7}>raw</text>
      </g>

      {/* Silver tank */}
      <g>
        <circle cx={260} cy={220} r={68} fill="url(#silverGlow)" opacity={0.45} filter="url(#softBlur)" />
        <rect
          x={220} y={180} width={80} height={80} rx={18}
          fill="rgba(147,160,172,0.1)"
          stroke="rgba(198,203,209,0.7)"
          strokeWidth={1.3}
        />
        <text x={260} y={220} textAnchor="middle" fill="#eff2f5" fontSize={14} fontFamily="Fraunces" fontWeight={600}>Silver</text>
        <text x={260} y={238} textAnchor="middle" fill="#eff2f5" fontSize={10} fontFamily="monospace" opacity={0.7}>clean</text>
      </g>

      {/* Gold tank */}
      <g>
        <circle cx={440} cy={220} r={76} fill="url(#goldGlow)" opacity={0.55} filter="url(#softBlur)" />
        <rect
          x={400} y={180} width={80} height={80} rx={18}
          fill="rgba(241,176,44,0.15)"
          stroke="rgba(241,176,44,0.9)"
          strokeWidth={1.6}
        />
        <text x={440} y={220} textAnchor="middle" fill="#fff4c8" fontSize={14} fontFamily="Fraunces" fontWeight={600}>Gold</text>
        <text x={440} y={238} textAnchor="middle" fill="#fff4c8" fontSize={10} fontFamily="monospace" opacity={0.7}>trusted</text>
      </g>

      {/* Pipes */}
      <line x1={120} y1={220} x2={220} y2={220} stroke="url(#bzToSv2)" strokeWidth={3} strokeLinecap="round" />
      <line x1={300} y1={220} x2={400} y2={220} stroke="url(#svToGd2)" strokeWidth={3} strokeLinecap="round" />

      {/* Particles */}
      <Particles fromX={125} toX={215} y={220} color="#b07b3a" />
      <Particles fromX={305} toX={395} y={220} color="#f1b02c" />

      {/* Source arrow */}
      <g>
        <line x1={-5} y1={220} x2={38} y2={220} stroke="rgba(148,163,184,0.55)" strokeWidth={2} strokeLinecap="round" strokeDasharray="2 4" />
        <text x={-8} y={213} textAnchor="start" fill="rgba(161,161,170,0.8)" fontSize={9} fontFamily="monospace">sources</text>
      </g>

      {/* Tiny floating star schema inside Gold tank */}
      <g transform="translate(440,220)">
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '0px 0px' }}
        >
          <circle r={5} fill="#fff4c8" />
          {[0, 72, 144, 216, 288].map((deg) => {
            const a = (deg * Math.PI) / 180;
            const x = Math.cos(a) * 20, y = Math.sin(a) * 20;
            return (
              <g key={deg}>
                <line x1={0} y1={0} x2={x} y2={y} stroke="rgba(255,244,200,0.7)" strokeWidth={0.8} />
                <circle cx={x} cy={y} r={2.3} fill="rgba(255,244,200,0.9)" />
              </g>
            );
          })}
        </motion.g>
      </g>

      {/* Top label band */}
      <g transform="translate(260,80)">
        <rect x={-130} y={-18} width={260} height={36} rx={18} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
        <text x={0} y={5} textAnchor="middle" fill="#fff4c8" fontSize={12} fontFamily="Fraunces" letterSpacing="0.2em">
          MEDALLION ARCHITECTURE
        </text>
      </g>

      {/* Bottom annotation line */}
      <g fill="rgba(161,161,170,0.7)" fontSize={10} fontFamily="monospace">
        <text x={80} y={320} textAnchor="middle">3,500+ rows</text>
        <text x={260} y={320} textAnchor="middle">typed · deduped</text>
        <text x={440} y={320} textAnchor="middle">star schema</text>
      </g>

      {/* floating data packets (for character) */}
      <g transform="translate(90,100)" opacity={0.85}>
        <rect x={0} y={0} width={18} height={6} rx={2} fill="rgba(241,176,44,0.6)" />
        <rect x={0} y={10} width={28} height={6} rx={2} fill="rgba(176,123,58,0.5)" />
        <rect x={0} y={20} width={14} height={6} rx={2} fill="rgba(147,160,172,0.6)" />
      </g>
      <g transform="translate(400,380)" opacity={0.85}>
        <rect x={0} y={0} width={26} height={6} rx={2} fill="rgba(241,176,44,0.55)" />
        <rect x={0} y={10} width={16} height={6} rx={2} fill="rgba(147,160,172,0.5)" />
      </g>
    </svg>
  );
}

function Particles({ fromX, toX, y, color }: { fromX: number; toX: number; y: number; color: string }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.circle
          key={i}
          cx={fromX}
          cy={y}
          r={2.4}
          fill={color}
          initial={{ opacity: 0 }}
          animate={{
            cx: [fromX, toX],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 2.2,
            delay: (i * 2.2) / 5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </>
  );
}
