import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { assetWorkbenchPlugin } from './scripts/assets/workbenchPlugin';

const assetFoundryHomePlugin = () => ({
  name: 'asset-foundry-home',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/' || req.url === '') {
        res.statusCode = 302;
        res.setHeader('location', '/tools/asset-foundry/');
        res.end();
        return;
      }
      next();
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3010,
      host: '0.0.0.0',
    },
    publicDir: path.resolve(__dirname, 'public'),
    plugins: [assetFoundryHomePlugin(), solidPlugin(), tailwindcss(), assetWorkbenchPlugin({ root: __dirname, env })],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist-asset-foundry',
      rollupOptions: {
        input: path.resolve(__dirname, 'tools/asset-foundry/index.html'),
      },
    },
  };
});
