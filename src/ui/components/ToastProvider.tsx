import { Toaster } from "sonner"

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--surface)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)",
          fontFamily: "var(--font-body)",
          fontSize: 14,
        },
      }}
    />
  )
}
