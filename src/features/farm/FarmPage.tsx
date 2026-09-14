import { useNavigate } from 'react-router-dom'
import { useGameState } from '../../game/useGameState'
import { farmLocations, resolveWorldBuilding } from './locations'
import { WorldBuildingButton } from './WorldBuildingButton'

export function FarmPage() {
  const { state } = useGameState()
  const navigate = useNavigate()
  const buildings = farmLocations.map((building) => resolveWorldBuilding(building, state.property, state.geneticsLab))

  return (
    <section className="farm" aria-label="Farm">
      <div className="farm-world" aria-label="Farm locations">
        <div className="farm-world__sun" aria-hidden="true" />
        <svg className="farm-world__terrain" viewBox="0 0 1200 720" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="farm-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#8b4d2d" /><stop offset=".48" stopColor="#5a3828" /><stop offset="1" stopColor="#27231d" /></linearGradient>
            <linearGradient id="farm-earth" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#675039" /><stop offset="1" stopColor="#2c251d" /></linearGradient>
          </defs>
          <rect width="1200" height="720" fill="url(#farm-sky)" />
          <path d="M0 245 115 154 220 207 343 106 445 198 566 132 692 208 832 92 957 194 1085 126 1200 207V360H0Z" fill="#3b2c25" opacity=".82" />
          <path d="M0 292 160 211 281 262 425 196 578 267 735 199 906 270 1062 205 1200 251V391H0Z" fill="#49362a" opacity=".86" />
          <path d="M0 330Q265 283 480 329T1200 318V720H0Z" fill="url(#farm-earth)" />
          <path d="M598 760V440M598 440Q525 368 353 301M598 440Q691 356 867 299M598 459Q466 455 272 421M598 459Q738 452 949 414M598 493Q470 559 291 617M598 493Q733 559 918 616" fill="none" stroke="#a27b51" strokeWidth="54" strokeLinecap="round" opacity=".68" />
          <path d="M598 760V440M598 440Q525 368 353 301M598 440Q691 356 867 299M598 459Q466 455 272 421M598 459Q738 452 949 414M598 493Q470 559 291 617M598 493Q733 559 918 616" fill="none" stroke="#d0a46a" strokeWidth="3" strokeDasharray="3 17" opacity=".38" />
          <g fill="#8b7150" opacity=".55"><ellipse cx="92" cy="446" rx="18" ry="8" /><ellipse cx="1084" cy="471" rx="23" ry="10" /><ellipse cx="746" cy="345" rx="11" ry="5" /><ellipse cx="393" cy="662" rx="21" ry="8" /><ellipse cx="1017" cy="652" rx="13" ry="6" /></g>
        </svg>
        <div className="farm-world__yard" aria-hidden="true"><span /><span /><span /></div>
        <div className="farm-world__decor farm-world__decor--left" aria-hidden="true"><i /><i /><i /></div>
        <div className="farm-world__decor farm-world__decor--right" aria-hidden="true"><i /><i /></div>
        <div className="farm-world__locations">
          {buildings.map((building) => <WorldBuildingButton key={building.id} building={building} onEnter={() => navigate(building.route)} />)}
        </div>
        <span className="farm-world__caption">Your cactus property</span>
      </div>
    </section>
  )
}
