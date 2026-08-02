import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../../src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4174,
  },
})
