import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import AuthScreen from "./AuthScreen"

describe("AuthScreen", () => {
  it("renders the sign-in form from the landing flow", () => {
    render(<AuthScreen onAuth={vi.fn()} onBackToLanding={vi.fn()} />)

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument()
    expect(screen.getByLabelText("Email address")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /^sign in$/i })).toHaveLength(2)
  })
})
