// An animated hand loom: warp threads, heddles lifting in turn, a shuttle carrying the weft,
// and the finished cloth rolling down onto the beam. Pure SVG + CSS, no images to license.
const WARP_COUNT = 34;
const WARP_COLOURS = ['#36459a', '#f6f3ec', '#36459a', '#e8a93e'];

export function LoomScene() {
  const warps = Array.from({ length: WARP_COUNT }, (_, index) => 70 + index * 11.5);
  return (
    <svg className="loom" viewBox="0 0 520 440" role="img" aria-label="A loom weaving cloth">
      <defs>
        {/* The woven cloth: an ikat-style band pattern that scrolls down as it is woven */}
        <pattern id="loom-cloth" width="46" height="46" patternUnits="userSpaceOnUse">
          <rect width="46" height="46" fill="#36459a" />
          <rect y="0" width="46" height="6" fill="#e8a93e" />
          <rect y="12" width="46" height="3" fill="#f6f3ec" opacity="0.8" />
          <path d="M0 30 L11.5 22 L23 30 L34.5 22 L46 30 L46 34 L34.5 26 L23 34 L11.5 26 L0 34 Z" fill="#b5462a" />
          <rect y="40" width="46" height="2" fill="#f6f3ec" opacity="0.5" />
          <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="0 46" dur="6s" repeatCount="indefinite" />
        </pattern>
        <pattern id="loom-twill" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="transparent" />
          <rect width="2" height="6" fill="rgba(255,255,255,0.08)" />
        </pattern>
        <linearGradient id="loom-wood" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#9a6b43" />
          <stop offset="1" stopColor="#6f4a2c" />
        </linearGradient>
      </defs>

      {/* Frame */}
      <rect x="40" y="30" width="16" height="390" rx="4" fill="url(#loom-wood)" />
      <rect x="464" y="30" width="16" height="390" rx="4" fill="url(#loom-wood)" />
      <rect x="30" y="34" width="460" height="22" rx="8" fill="url(#loom-wood)" />

      {/* Warp threads */}
      <g className="loom__warp">
        {warps.map((x, index) => (
          <line key={x} x1={x} y1="56" x2={x} y2="270" stroke={WARP_COLOURS[index % WARP_COLOURS.length]} strokeWidth="2.2" opacity={index % 4 === 1 ? 0.75 : 0.95} />
        ))}
      </g>

      {/* Two heddle shafts, lifting in turn to open the shed */}
      <g className="loom__heddle loom__heddle--a">
        <rect x="58" y="112" width="404" height="8" rx="4" fill="#d8cdb6" />
      </g>
      <g className="loom__heddle loom__heddle--b">
        <rect x="58" y="146" width="404" height="8" rx="4" fill="#c3b596" />
      </g>

      {/* Reed (beater) */}
      <g className="loom__reed">
        <rect x="58" y="214" width="404" height="12" rx="3" fill="#7b5634" />
        {warps.map((x) => <line key={x} x1={x} y1="216" x2={x} y2="224" stroke="#e5d6b8" strokeWidth="1" />)}
      </g>

      {/* Woven cloth, moving down to the cloth beam */}
      <rect x="64" y="270" width="392" height="120" fill="url(#loom-cloth)" />
      <rect x="64" y="270" width="392" height="120" fill="url(#loom-twill)" />
      <rect x="64" y="270" width="392" height="3" fill="#f6f3ec" opacity="0.6" />

      {/* Weft being laid at the fell of the cloth */}
      <line className="loom__weft" x1="64" y1="262" x2="456" y2="262" stroke="#e8a93e" strokeWidth="3" strokeLinecap="round" />

      {/* Shuttle */}
      <g className="loom__shuttle">
        <path d="M0 6 Q6 0 24 0 L48 0 Q66 0 72 6 Q66 12 48 12 L24 12 Q6 12 0 6 Z" fill="#b5462a" />
        <rect x="26" y="3" width="20" height="6" rx="3" fill="#e8a93e" />
      </g>

      {/* Cloth beam */}
      <rect x="44" y="392" width="432" height="26" rx="13" fill="url(#loom-wood)" />
      <rect x="60" y="398" width="400" height="6" rx="3" fill="#36459a" opacity="0.65" />
    </svg>
  );
}

/** Fabric swatches drawn with CSS patterns, named after the cloths mills actually make. */
export const SWATCHES = [
  { name: 'Cotton poplin', className: 'swatch--poplin' },
  { name: 'Denim twill', className: 'swatch--denim' },
  { name: 'Madras check', className: 'swatch--madras' },
  { name: 'Bandhani', className: 'swatch--bandhani' },
  { name: 'Ikat', className: 'swatch--ikat' },
  { name: 'Khadi', className: 'swatch--khadi' },
  { name: 'Houndstooth', className: 'swatch--houndstooth' },
  { name: 'Chambray', className: 'swatch--chambray' },
  { name: 'Block print', className: 'swatch--block' },
  { name: 'Jacquard', className: 'swatch--jacquard' },
];

export function Swatch({ name, className }) {
  return (
    <figure className={`swatch ${className}`}>
      <div className="swatch__cloth" />
      <figcaption>{name}</figcaption>
    </figure>
  );
}

/** Cones of yarn, as they arrive at the gate. */
export function YarnCones() {
  const cones = [
    { x: 30, colour: '#36459a', band: '#29357f' },
    { x: 120, colour: '#e8a93e', band: '#c98d25' },
    { x: 210, colour: '#b5462a', band: '#8f3420' },
    { x: 300, colour: '#f6f3ec', band: '#d9cfbb' },
  ];
  return (
    <svg className="yarn-cones" viewBox="0 0 380 190" aria-hidden>
      {cones.map((cone, index) => (
        <g key={cone.x} className="yarn-cones__cone" style={{ animationDelay: `${index * 0.4}s` }}>
          <path d={`M${cone.x + 10} 170 L${cone.x + 30} 40 L${cone.x + 50} 40 L${cone.x + 70} 170 Z`} fill={cone.colour} />
          {[60, 85, 110, 135].map((y) => (
            <line key={y} x1={cone.x + 30 - (y - 40) * 0.155} y1={y} x2={cone.x + 50 + (y - 40) * 0.155} y2={y} stroke={cone.band} strokeWidth="2" />
          ))}
          <rect x={cone.x + 34} y="22" width="12" height="20" rx="3" fill="#9a6b43" />
          <ellipse cx={cone.x + 40} cy="171" rx="31" ry="6" fill="rgba(22,26,68,0.12)" />
        </g>
      ))}
    </svg>
  );
}
