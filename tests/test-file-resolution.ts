import path from 'path';
import fs from 'fs';

function resolveFileContext(text: string): string {
  if (!text) return '';
  const potentialPaths: string[] = Array.from(
    text.match(/[a-zA-Z]:\\[^\s"'\n\r<>|*?]+|\.\.?[\\\/][^\s"'\n\r<>|*?]+|workspace[\\\/][^\s"'\n\r<>|*?]+/g) || []
  );

  const workspaceDir = path.resolve(process.cwd(), 'workspace');
  if (fs.existsSync(workspaceDir)) {
    try {
      const workspaceFiles = fs.readdirSync(workspaceDir);
      for (const f of workspaceFiles) {
        if (text.includes(f) && !potentialPaths.includes(f)) {
          potentialPaths.push(path.join(workspaceDir, f));
        }
      }
    } catch {
      // ignore
    }
  }

  let attached = '';
  const visited = new Set<string>();
  for (const rawPath of potentialPaths) {
    try {
      const clean = rawPath.replace(/[,\.;:!?)]+$/, '').trim();
      const resolved = path.isAbsolute(clean) ? clean : path.resolve(process.cwd(), clean);
      if (visited.has(resolved)) continue;
      visited.add(resolved);

      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        const content = fs.readFileSync(resolved, 'utf-8');
        attached += `\n\n--- [Attached File Content: ${path.basename(resolved)}] ---\n${content.slice(0, 40000)}\n--- [End of ${path.basename(resolved)}] ---\n`;
      }
    } catch {
      // ignore
    }
  }
  return attached;
}

const res = resolveFileContext('Please review chapter1.txt for character pacing');
console.log('EXTRACTED CONTEXT:\n', res);

if (!res.includes('Chapter 1: The Quantum Horizon')) {
  throw new Error('Failed to resolve workspace/chapter1.txt');
}
console.log('[PASS] File resolution verified successfully!');
