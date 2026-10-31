import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://moran-tech.github.io/f8-crm/ on GitHub Pages.
export default defineConfig({
  base: '/f8-crm/',
  plugins: [react()],
})
