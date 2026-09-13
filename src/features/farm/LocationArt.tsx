import type { FarmLocationId } from './locations'

function Cactus({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0V-42M0-20H-14V-34M0-12H13V-28" fill="none" stroke="#71875b" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-1-4V-39" stroke="#abb176" strokeWidth="2" strokeLinecap="round" />
    </g>
  )
}

export function LocationArt({ location }: { location: FarmLocationId }) {
  return (
    <svg className="location-art" viewBox="0 0 280 190" aria-hidden="true" focusable="false">
      <ellipse cx="140" cy="169" rx="116" ry="15" fill="#100d0b" opacity=".3" />
      {location === 'nursery' ? (
        <g stroke="#bba17a" strokeWidth="3" strokeLinejoin="round">
          <path d="M39 91 105 35 232 58 232 151 104 175 39 145Z" fill="#344b42" />
          <path d="M39 91 105 35 167 94 104 175 39 145Z" fill="#698875" fillOpacity=".38" />
          <path d="M105 35 167 94 232 77 232 58Z" fill="#afbd9c" fillOpacity=".25" />
          <path d="M167 94V163M39 91 104 106 167 94 232 77M104 106V175M75 62 137 99M143 42 202 85V157M39 119 104 135 232 107" fill="none" />
          <path d="M77 169V123L104 129V175" fill="#24352d" />
          <path d="M174 149H222" stroke="#927151" strokeWidth="8" />
          <Cactus x={187} y={144} scale={.6} /><Cactus x={214} y={139} scale={.5} />
        </g>
      ) : location === 'garden' ? (
        <g>
          <path d="M27 102 171 61 255 106 111 154Z" fill="#7f5940" stroke="#a88156" strokeWidth="4" />
          <path d="M27 115 111 166 255 119V106L111 154 27 102Z" fill="#4b3529" />
          <path d="m71 116 142-40M114 141l143-48" fill="none" stroke="#c2a078" strokeWidth="3" />
          <Cactus x={81} y={107} scale={1.1} /><Cactus x={142} y={90} scale={.75} />
          <Cactus x={183} y={120} scale={1.25} /><Cactus x={122} y={136} scale={.55} />
          <circle cx="183" cy="64" r="6" fill="#dc927e" /><circle cx="142" cy="56" r="5" fill="#e6bc7a" />
          <path d="M32 133V159M50 144V170M26 146 58 165" stroke="#ac8a62" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="222" cy="154" rx="14" ry="8" fill="#a28868" />
        </g>
      ) : location === 'lab' ? (
        <g stroke="#bba17a" strokeWidth="3" strokeLinejoin="round">
          <path d="M48 91 103 47H203L238 88V158H48Z" fill="#4d3b30" />
          <path d="M103 47 132 88H238L203 47Z" fill="#789183" fillOpacity=".55" />
          <path d="M132 88V158M177 88V158M103 47V158M48 91H238" fill="none" />
          <path d="M58 105H98V145H58ZM184 105H226V145H184Z" fill="#9fb29d" fillOpacity=".35" />
          <path d="M113 158V113H151V158" fill="#2c2923" />
          <circle cx="194" cy="69" r="8" fill="#c77b4b" /><path d="m194 58 0 22m-11-11h22" stroke="#f0c18f" strokeWidth="2" />
          <Cactus x={78} y={143} scale={.48} /><Cactus x={211} y={142} scale={.42} />
        </g>
      ) : (
        <g strokeLinejoin="round">
          <path d="M58 84H222V158H58Z" fill="#654630" stroke="#af8455" strokeWidth="3" />
          <path d="M73 69V165M209 69V165" stroke="#c29865" strokeWidth="7" />
          <path d="M54 47H225L248 87H30Z" fill={location === 'shop' ? '#ad633e' : '#6b7d66'} stroke="#d1ab78" strokeWidth="3" />
          <path d="M87 48 75 87M122 48 117 87M158 48 161 87M193 48 205 87" stroke={location === 'shop' ? '#e3b37a' : '#b8bd92'} strokeWidth="19" />
          <path d="M31 87V99Q53 113 75 99Q96 113 118 99Q140 113 162 99Q183 113 205 99Q226 113 248 99V87" fill={location === 'shop' ? '#a55736' : '#526950'} />
          <path d="M51 134H230V148H51Z" fill="#b88c5c" stroke="#d0a576" strokeWidth="2" />
          {location === 'shop' ? (
            <g><path d="M88 130 84 107H112L108 130Z" fill="#c18a63" /><Cactus x={98} y={108} scale={.6} /><path d="M142 129V110H164V129M173 129V110H195V129" fill="#d0b480" stroke="#4d4934" strokeWidth="2" /></g>
          ) : (
            <g><Cactus x={94} y={122} scale={.55} /><Cactus x={144} y={120} scale={.8} /><Cactus x={194} y={123} scale={.5} /><path d="m83 123 4 10H102L106 123M132 120l4 13H153l4-13M183 123l4 10H202l4-10" fill="#bd7955" /></g>
          )}
          <path d="M67 160H216" stroke="#35271e" strokeWidth="5" />
        </g>
      )}
    </svg>
  )
}
