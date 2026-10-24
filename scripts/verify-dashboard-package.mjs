import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
async function files(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
const built=await files('dist');
if(built.some(f=>path.basename(f).startsWith('.dev.vars')))throw Error('Test-only environment file exists in deployment output');
const dev=await readFile('.dev.vars','utf8').catch(()=>''),dummy=dev.match(/^CRM_SESSION_SECRET\s*=\s*["']?([^"'\n]+)["']?$/m)?.[1];
for(const f of built){const b=await readFile(f);if(dummy&&b.includes(Buffer.from(dummy)))throw Error('Disposable preview key appears in output');if(b.includes(Buffer.from('6e1da86a18a75826153d19605fa91cb3d89a3b36faa7fd4363fb13fcc5f19fd4')))throw Error('Private prospect dossier leaked into Site output');if(b.includes(Buffer.from('/workspace/sites/integritas-business/.vinext/fonts')))throw Error('Broken absolute font URL in output');}
process.stdout.write('Dashboard package guard PASS: no test environment, dummy key, private dossier or broken absolute font paths.\n');
