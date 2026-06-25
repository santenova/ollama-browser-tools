import { defineConfig } from 'vite'
import { createServer } from 'http'
import react from '@vitejs/plugin-react'
import path from 'path'
import { errorOverlayPlugin } from './vite-plugins/error-overlay-plugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {

    plugins: [
    react(),
    ],
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // Treat import errors as fatal errors
          if (
            warning.code === "UNRESOLVED_IMPORT" ||
            warning.code === "MISSING_EXPORT"
          ) {
            throw new Error(`Build failed: ${warning.message}`);
          }
          // Use default for other warnings
          warn(warning);
        },
      },
    },
    server: {
      host: '0.0.0.0', // Bind to all interfaces for container access
      port: 5174,
      strictPort: true,
      // Allow all hosts - essential for Modal tunnel URLs
      allowedHosts: true,
      watch: {
        // Enable polling for better file change detection in containers
        usePolling: true,
        interval: 100, // Check every 100ms for responsive HMR
      },
        proxy: {
        '/proxy': {
          target: process.env.VITE_PROXY_TARGET_OLLAMA || 'http://localhost:11434', // Replace with the actual Ollama API URL
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/proxy/, ''),
        },
        '/custom': {
          target: process.env.VITE_PROXY_TARGET_NGROK || 'https://christy-ramentaceous-verbatim.ngrok-free.dev', // ngrog ollama proxy
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/custom/, ''),
        },
        '/db': {
          target: process.env.VITE_PROXY_TARGET_ELASTICSEARCH || 'http://localhost:9200', // local elasticsearch
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/db/, ''),
        },
        '/api': {
          target: process.env.VITE_PROXY_TARGET_NGROK || 'https://christy-ramentaceous-verbatim.ngrok-free.dev', // local elasticsearch
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      }
    },
     test: {
        globals: true,
        environment: 'jsdom',
        css: true,
        setupFiles: './vitest.setup.ts'
        
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    }
  }
});
