import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Files the offline copy can do without: other alphabets of the fonts are fetched when a page first needs them. */
const optional = (file: string): boolean => /\.woff2$/.test(file) && !/-latin-wght-/.test(file);

/**
 * Writes `sw.js` next to the built game. The service worker is told which
 * files make up this build, and is given a fingerprint of their contents so
 * that a new build replaces the copy saved on a player's device.
 */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'geometry-rush-service-worker',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, entry.name);
          if (entry.isDirectory()) walk(path);
          else files.push(relative(outDir, path).split(sep).join('/'));
        }
      };
      walk(outDir);
      const built = files.filter((f) => f !== 'sw.js').sort();
      const hash = createHash('sha256');
      for (const f of built) hash.update(f).update(readFileSync(join(outDir, f)));
      const core = ['./', ...built.filter((f) => f !== 'index.html' && !optional(f))];
      const source = readFileSync(new URL('./src/pwa/sw.js', import.meta.url), 'utf8')
        .replace("'__VERSION__'", JSON.stringify(`${pkg.version}-${hash.digest('hex').slice(0, 10)}`))
        .replace('__CORE__', JSON.stringify(core));
      writeFileSync(join(outDir, 'sw.js'), source);
    },
  };
}

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 600 },
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  plugins: [serviceWorker()],
});
