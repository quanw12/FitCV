/* Check mark drawn by stroke-dashoffset. Scenes set the beat by overriding
   `.lpd-tick-path`'s animation-delay at their own specificity. */

export default function Tick() {
  return (
    <svg className="lpd-tick" viewBox="0 0 16 16" aria-hidden="true">
      <path
        className="lpd-tick-path"
        d="M3.5 8.6 6.6 11.7 12.5 5"
        pathLength={1}
      />
    </svg>
  )
}
