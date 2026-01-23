import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      ssr: {
        noExternal: ['use-sync-external-store', 'swr']
      },
      optimizeDeps: {
        include: [
          'use-sync-external-store/shim', 
          'swr',
          'react',
          'react-dom',
          '@clerk/clerk-react',
          'lucide-react'
        ],
        // Safari-specific optimizations
        exclude: ['@clerk/clerk-react'], // Force bundling to avoid CDN issues
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        target: 'es2015',
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'clerk': ['@clerk/clerk-react'],
              'ui': ['lucide-react', 'class-variance-authority', 'clsx']
            }
          }
        },
        // Safari compatibility improvements
        sourcemap: false,
        minify: true,
      },
      define: {
        global: 'globalThis',
      },
      esbuild: {
        // Safari 26.2 compatible target
        target: 'es2015'
      }
    };
});