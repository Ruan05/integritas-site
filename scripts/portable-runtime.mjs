import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const runtime = path.join(root, '.sites-runtime');
mkdirSync(runtime, { recursive: true });
const mode = process.argv[2];
if (!['install', 'build'].includes(mode)) throw new Error('Expected install or build');
const lock = path.join(runtime, mode + '.portable-lock');
mkdirSync(lock); // atomic exclusion; do not overlap installs or builds
const command = mode === 'install' ? 'npm' : process.execPath;
const args = mode === 'install'
  ? ['ci', '--no-audit', '--no-fund']
  : [path.join(root, 'node_modules/.bin/vinext'), 'build'];
if (mode === 'build') rmSync(path.join(root, 'dist'), { recursive: true, force: true });
const child = spawn(command, args, { stdio: 'inherit', cwd: root,
  env: { ...process.env, WRANGLER_LOG_PATH: path.join(root, '.wrangler/wrangler.log') } });
const timer = setTimeout(() => child.kill('SIGTERM'), mode === 'install' ? 480000 : 240000);
child.on('error', (error) => { clearTimeout(timer); rmSync(lock, { recursive: true }); throw error; });
child.on('exit', (code) => {
  clearTimeout(timer); rmSync(lock, { recursive: true });
  if (code === 0 && mode === 'install') {
    if (!existsSync(path.join(root, 'node_modules/.bin/vinext'))) throw new Error('Vinext missing after install');
    const sha = createHash('sha256').update(readFileSync(path.join(root, 'package-lock.json'))).digest('hex');
    writeFileSync(path.join(root, 'node_modules/.sites-install.json'), JSON.stringify({ lockfile_sha256: sha }));
  }
  process.exitCode = code ?? 1;
});
