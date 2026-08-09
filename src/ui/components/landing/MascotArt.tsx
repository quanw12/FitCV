/* The mascot artwork, inlined and split into moving parts.

   The three sprite files it replaces are not an animation: frame 2 is the whole
   character lifted 4px and frame 3 is the whole character shifted 4px right, so
   cycling them reads as a shuffle no matter how it is timed. The polygons below
   are the geometry of right1.svg regrouped, so the hammer can pivot in the hand
   and the boots can alternate, plus the corner that file never had to draw: it
   only ever posed the character at rest, where the hammer head covers the top
   left of the body, so the fill was cut away under it, the rim around it was
   left open, and the right rim was left three corners short. The swing carries
   the hammer off all of it, so it is closed here.
   Paint order is deliberate: the body first (its fill carries eye-shaped holes
   the black eyes show through), then the hammer over it, then the mitt over the
   haft, then the boots. Every unit added below falls under the hammer at rest,
   so that frame is untouched; mid-swing the order is what lets the head cross in
   front of the torso instead of vanishing behind it, while the fist still reads
   as gripping the handle. */

export default function MascotArt() {
  return (
    <>
      <g className="m-core">
        {/* Sits in the slot the haft is cut out of, so swinging the hammer away
            leaves body colour behind instead of a notch of background. */}
        <rect className="m-edge" x="100" y="128" width="12" height="24" />

        <polygon
          className="m-eye"
          points="140 156 140 160 140 164 140 168 140 172 144 172 148 172 148 168 148 164 148 160 148 156 144 156 140 156"
        />
        <polygon
          className="m-eye"
          points="164 156 160 156 160 160 160 164 160 168 160 172 164 172 168 172 168 168 168 164 168 160 168 156 164 156"
        />

        {/* Square, where right1.svg stepped in to x 140 for the top eight units.
            That step is the shape of the hammer head, not of the character: it
            is the fill the file skipped because nothing could ever see it. */}
        <path
          className="m-skin"
          d="M172,120h-52v60h56v-60h-4ZM168,160v12h-8v-16h8v4ZM140,168v-12h8v16h-8v-4Z"
        />
        <polygon
          className="m-edge"
          points="172 116 168 116 164 116 160 116 156 116 152 116 148 116 144 116 140 116 140 120 144 120 148 120 152 120 156 120 160 120 164 120 168 120 172 120 176 120 176 116 172 116"
        />
        {/* Carries the top rim the rest of the way left, then turns down to meet
            the left rim where it starts at y 128. Both stretches sit inside the
            hammer head's footprint at rest, which is exactly why right1.svg
            never drew them. */}
        <polygon
          className="m-edge"
          points="136 116 132 116 128 116 124 116 120 116 116 116 116 120 116 124 116 128 120 128 120 124 120 120 124 120 128 120 132 120 136 120 140 120 140 116 136 116"
        />
        {/* Runs 116 to 184 rather than 120 to 180: the top and bottom rims stop
            at x 176, so ending this one where they end leaves a 4-unit bite out
            of each corner. */}
        <polygon
          className="m-edge"
          points="176 116 176 120 176 124 176 128 176 132 176 136 176 140 176 144 176 148 176 152 176 156 176 160 176 164 176 168 176 172 176 176 176 180 176 184 180 184 180 180 180 176 180 172 180 168 180 164 180 160 180 156 180 152 180 148 180 144 180 140 180 136 180 132 180 128 180 124 180 120 180 116 176 116"
        />
        <polygon
          className="m-edge"
          points="168 180 164 180 160 180 156 180 152 180 148 180 144 180 140 180 136 180 132 180 128 180 124 180 120 180 120 176 120 172 120 168 120 164 120 160 120 156 120 152 120 148 120 144 120 140 120 136 120 132 120 128 116 128 112 128 112 132 112 136 112 140 112 144 112 148 116 148 116 152 116 156 116 160 112 160 112 164 108 164 104 164 100 164 96 164 92 164 88 164 88 160 88 156 88 152 88 148 92 148 96 148 96 152 100 152 100 148 100 144 100 140 100 136 100 132 100 128 96 128 92 128 88 128 84 128 84 132 84 136 84 140 84 144 84 148 84 152 84 156 84 160 84 164 84 168 84 172 84 176 84 180 88 180 88 184 92 184 96 184 100 184 104 184 108 184 112 184 116 184 120 184 124 184 128 184 132 184 136 184 140 184 144 184 148 184 152 184 156 184 160 184 164 184 168 184 172 184 176 184 176 180 172 180 168 180"
        />
        <g className="m-hammer">
          <polygon
            className="m-wedge"
            points="108 96 104 96 100 96 96 96 92 96 88 96 84 96 84 100 80 100 80 104 76 104 76 108 72 108 72 112 68 112 68 116 64 116 64 120 60 120 60 124 60 128 64 128 68 128 72 128 76 128 80 128 84 128 88 128 92 128 96 128 100 128 104 128 108 128 112 128 112 124 112 120 112 116 112 112 112 108 112 104 112 100 112 96 108 96"
          />
          <polygon
            className="m-head"
            points="136 96 132 96 128 96 124 96 120 96 116 96 112 96 112 100 112 104 112 108 112 112 112 116 112 120 112 124 112 128 116 128 120 128 124 128 128 128 132 128 136 128 140 128 140 124 140 120 140 116 140 112 140 108 140 104 140 100 140 96 136 96"
          />
          <polygon
            className="m-haft"
            points="104 128 100 128 100 132 100 136 100 140 100 144 100 148 104 148 104 152 104 148 108 148 108 144 108 140 108 136 108 132 108 128 104 128"
          />
          <polygon
            className="m-haft"
            points="100 160 100 164 104 164 108 164 108 160 104 160 100 160"
          />
          <polygon
            className="m-grip"
            points="108 128 108 132 108 136 108 140 108 144 108 148 112 148 112 144 112 140 112 136 112 132 112 128 108 128"
          />
          <rect className="m-grip" x="108" y="160" width="4" height="4" />

          {/* Fist lives here now, not as a sibling after m-hammer, so it
              inherits the swing's rotation and stays clamped over the grip
              instead of getting left behind at the rest-pose coordinates. It
              is still the last thing drawn in this group, so paint order still
              puts it on top of the wedge/head/haft/grip beneath it. */}
          <polygon
            className="m-deep"
            points="96 164 100 164 100 160 104 160 108 160 112 160 116 160 116 156 116 152 116 148 112 148 108 148 104 148 104 152 100 152 96 152 96 148 92 148 88 148 88 152 88 156 88 160 88 164 92 164 96 164"
          />
        </g>
      </g>

      {/* Boots live outside the body group so they stay planted while it dips. */}

      <g className="m-foot-l">
        <polygon
          className="m-deep"
          points="120 192 116 192 112 192 112 188 112 184 108 184 104 184 104 188 104 192 100 192 96 192 96 196 92 196 92 200 96 200 100 200 104 200 108 200 112 200 116 200 120 200 124 200 124 196 120 196 120 192"
        />
      </g>

      <g className="m-foot-r">
        <polygon
          className="m-deep"
          points="172 196 172 192 168 192 164 192 160 192 160 188 160 184 156 184 152 184 152 188 152 192 148 192 148 196 144 196 144 200 148 200 152 200 156 200 160 200 164 200 168 200 172 200 176 200 176 196 172 196"
        />
      </g>
    </>
  )
}