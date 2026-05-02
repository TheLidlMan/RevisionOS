import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core vendor libraries – always needed
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // State management
          if (id.includes('node_modules/zustand') || id.includes('node_modules/@tanstack/react-query')) {
            return 'vendor-state';
          }
          // Animation / rich UI libraries (large, not needed immediately)
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-framer';
          }
          // KaTeX math rendering (large, only used in review)
          if (id.includes('node_modules/katex')) {
            return 'vendor-katex';
          }
          // Icon sets
          if (id.includes('node_modules/@phosphor-icons') || id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // Lazy-loaded pages – each gets its own chunk
          if (id.includes('/pages/QuizMode')) return 'page-quiz';
          if (id.includes('/pages/KnowledgeGraph')) return 'page-knowledge-graph';
          if (id.includes('/pages/CurriculumPage')) return 'page-curriculum';
          if (id.includes('/pages/ForgettingCurve')) return 'page-forgetting-curve';
          if (id.includes('/pages/AchievementsPage')) return 'page-achievements';
        },
      },
    },
  },
})
