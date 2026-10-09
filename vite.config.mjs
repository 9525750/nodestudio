import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    server: {
        proxy: {
            '/api': {
                target: 'https://api.kie.ai',
                changeOrigin: true,
                secure: false
            }
        }
    }
});
