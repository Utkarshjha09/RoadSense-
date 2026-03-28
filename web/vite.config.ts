import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('leaflet') || id.includes('react-leaflet') || id.includes('@react-google-maps')) {
                            return 'map-vendor'
                        }
                        if (id.includes('recharts')) {
                            return 'chart-vendor'
                        }
                        if (id.includes('@supabase/supabase-js')) {
                            return 'supabase-vendor'
                        }
                        if (id.includes('@tanstack/react-query')) {
                            return 'query-vendor'
                        }
                        if (id.includes('react-router-dom')) {
                            return 'router-vendor'
                        }
                    }
                },
            },
        },
        chunkSizeWarningLimit: 700,
    },
    server: {
        port: 3000,
    },
})
