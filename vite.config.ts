import { defineConfig } from "vite"

import react from "@vitejs/plugin-react"

import tailwindcss from "@tailwindcss/vite"

import path from "node:path"

// Vite config — https://vitejs.dev/config/

export default defineConfig({
  plugins: [
    react(),

    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },

  build: {
    // Keep vendor chunks cacheable and parallel-loadable. The heavy libraries
    // below are split out of the main app chunk so the entry shrinks and can
    // be cached independently of feature code.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor"
          }

          if (
            id.includes("/recharts/") ||
            id.includes("/d3-") ||
            id.includes("/victory")
          ) {
            return "recharts-vendor"
          }

          if (
            id.includes("/framer-motion/") ||
            id.includes("/motion-dom/") ||
            id.includes("/motion-utils/") ||
            id.includes("/motion-react/") ||
            (id.includes("/motion/") && !id.includes("/promotion/"))
          ) {
            return "motion-vendor"
          }

          if (id.includes("/lucide-react/")) return "lucide-vendor"

          if (id.includes("/@dnd-kit/")) return "dndkit-vendor"

          if (id.includes("/gsap/") || id.includes("/@gsap/")) return "gsap-vendor"

          if (id.includes("/mermaid/")) return "mermaid-vendor"

          if (id.includes("/sonner/")) return "sonner-vendor"

          if (id.includes("/flint-chart/")) return "flint-vendor"

          return undefined
        },
      },
    },
  },

  server: {
    host: "0.0.0.0",

    port: 5173,

    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
      },

      "/uploads": {
        target: "http://127.0.0.1:8000",
      },
    },
  },
})
