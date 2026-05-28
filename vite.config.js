import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  base: '/SillyTavern-Preset-Editor-main/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '/src': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 8153,
    host: '127.0.0.1'
  }
});
