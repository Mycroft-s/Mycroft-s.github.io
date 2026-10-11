import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { renderSite } from './build-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check')) throw new Error('Usage: node scripts/build.mjs [--check]');
  const { pages, files = {} } = await renderSite(root);
  const outputs = { ...Object.fromEntries(Object.entries(pages).map(([name, page]) => [name, page.html])), ...files };
  if (args.includes('--check')) {
    for (const [name, html] of Object.entries(outputs)) {
      let current;
      try { current = (await readFile(join(root, name), 'utf8')).replace(/\r\n/g, '\n'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (current !== html) throw new Error(`${name} is out of date. Run npm run build and include the generated file.`);
    }
  } else {
    // Render and validate every page before writing any generated output.
    for (const [name, html] of Object.entries(outputs)) await writeFile(join(root, name), html);
  }
  for (const [name, { stats }] of Object.entries(pages)) {
    const status = args.includes('--check') ? `${name} is current` : `Built ${name}`;
    console.log(`${status}; ${stats.translations} translation keys and ${stats.assets} local assets checked.`);
  }
  if (Object.keys(files).length) console.log(`Validated ${Object.keys(files).join(', ')}.`);
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
}
