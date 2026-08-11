import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import BranchTimeline, { type TimelineSpec } from "./BranchTimeline"

const SEEKER_FLOW: TimelineSpec = {
  badge: "LIVE",
  marker: "CV v1 · PDF",
  stages: ["CV uploaded", "Parsed · sections", "JD attached", "Scored · 4 categories"],
  gate: "YOU DECIDE",
  up: {
    badge: "APPLY",
    title: "Send this version",
    note: "Strong match · gaps closed",
    tone: "pass",
    nodes: [
      { label: "Applied", glyph: "check" },
      { label: "Screening", glyph: "dot" },
      { label: "Interview", glyph: "up" },
    ],
    ending: { kind: "rejoin", label: "Offer · tracked" },
  },
  down: {
    badge: "IMPROVE",
    title: "Close the gaps",
    note: "Weak match · keywords missing",
    tone: "loop",
    nodes: [
      { label: "AI suggestions", glyph: "spark" },
      { label: "Saved as v2", glyph: "plus" },
      { label: "Re-scored", glyph: "loop" },
    ],
    ending: { kind: "loop", label: "Same JD · new version · back through the flow" },
  },
}

const HR_FLOW: TimelineSpec = {
  badge: "OPEN",
  marker: "Sr Frontend · 24 CVs",
  stages: ["Role published", "CVs collected", "Parsed · evidence", "Ranked vs JD"],
  gate: "HR DECIDES",
  up: {
    badge: "SHORTLIST",
    title: "Moved to screening",
    note: "Above threshold · reviewed",
    tone: "pass",
    nodes: [
      { label: "Invite drafted", glyph: "mail" },
      { label: "HR approved · sent", glyph: "check" },
      { label: "Offer", glyph: "up" },
    ],
    ending: { kind: "rejoin", label: "Hired" },
  },
  down: {
    badge: "NOT NOW",
    title: "Not moved forward",
    note: "Below threshold · reviewed",
    tone: "fail",
    nodes: [
      { label: "Rejection drafted", glyph: "mail" },
      { label: "HR approved · sent", glyph: "check" },
      { label: "Rejected", glyph: "cross" },
    ],
    ending: { kind: "stop", label: "Stage history kept" },
  },
}

/* Some labels wrap across two tspan lines, so match as a substring rather than
   an exact node. The full phrase still lives in the sr-only ordered list. */

function has(text: string) {
  expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0)
}

function missing(text: string) {
  expect(screen.queryByText(text, { exact: false })).toBeNull()
}

describe("BranchTimeline — job seeker flow", () => {
  beforeEach(() => {
    render(
      <BranchTimeline
        spec={SEEKER_FLOW}
        caption="Job seeker workflow — illustrative flow, not recorded activity"
      />,
    )
  })

  it("renders four trunk stages and the gate", () => {
    has("CV uploaded")
    has("Parsed · sections")
    has("JD attached")
    has("Scored · 4 categories")
    has("YOU DECIDE")
  })

  it("renders the up lane nodes and rejoin outcome", () => {
    has("Applied")
    has("Screening")
    has("Interview")
    has("Offer · tracked")
  })

  it("renders the down lane improvement loop", () => {
    has("AI suggestions")
    has("Saved as v2")
    has("Re-scored")
    has("Same JD · new version · back through the flow")
  })

  it("no longer claims drafts are discarded or unsaved", () => {
    missing("Discarded draft")
    missing("Not saved")
    missing("Below the bar")
  })
})

describe("BranchTimeline — recruiter flow", () => {
  beforeEach(() => {
    render(
      <BranchTimeline
        spec={HR_FLOW}
        caption="Recruiter workflow — the score ranks, HR decides. Illustrative flow, not recorded activity"
      />,
    )
  })

  it("renders four trunk stages and the gate", () => {
    has("Role published")
    has("CVs collected")
    has("Parsed · evidence")
    has("Ranked vs JD")
    has("HR DECIDES")
  })

  it("renders the shortlist lane and hired outcome", () => {
    has("Invite drafted")
    has("HR approved · sent")
    has("Offer")
    has("Hired")
  })

  it("renders the not-moved lane with a terminal stop cap", () => {
    has("Rejection drafted")
    has("Rejected")
    has("Stage history kept")
  })

  it("never lets the score auto-reject", () => {
    missing("Below the bar")
    missing("Discarded draft")
    missing("Not saved")
  })
})
