import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Runs the Vercel functions in /api during `npm run dev`, so live widgets work
 * locally too. Put keys in `.env.local` (see .env.example).
 */
function devApi(): Plugin {
  return {
    name: 'slvrr:dev-api',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))
      server.middlewares.use(async (req, res, next) => {
        const name = req.url?.match(/^\/api\/([\w-]+)(?:\?|$)/)?.[1]
        if (!name) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          const response: Response = await mod.GET(
            new Request(new URL(req.url!, 'http://localhost')),
          )
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    { enforce: 'pre', ...mdx({ providerImportSource: '@mdx-js/react' }) },
    react({ include: /\.(mdx|jsx|tsx)$/ }),
    tailwindcss(),
    devApi(),
  ],
  build: {
    // The lazily loaded Three.js scene chunk is ~1 MB by design.
    chunkSizeWarningLimit: 1200,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
