import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- Add this
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <-- And this
  ],
  base: '/HomeInfusionAnalyticsDashboard/',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})