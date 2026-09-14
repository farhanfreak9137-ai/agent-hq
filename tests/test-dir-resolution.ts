import path from 'path';
import fs from 'fs';

function scanAndResolveDirectory(dirPath: string, maxDepth: number = 3, maxContentChars: number = 50000): string {
  const IGNORED = new Set(['.git', 'node_modules', 'dist', 'build', '.agents', 'coverage', '.cache', '.system_generated']);
  let totalFiles = 0;
  let totalDirs = 0;
  const treeLines: string[] = [];
  const candidates: { relPath: string; fullPath: string; size: number; priority: number }[] = [];

  function walk(currentDir: string, currentDepth: number) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED.has(entry.name)) continue;
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(dirPath, fullPath);
        const indent = '  '.repeat(currentDepth);

        if (entry.isDirectory()) {
          totalDirs++;
          treeLines.push(`${indent}📁 ${entry.name}/`);
          if (currentDepth < maxDepth) {
            walk(fullPath, currentDepth + 1);
          }
        } else if (entry.isFile()) {
          totalFiles++;
          let size = 0;
          try {
            size = fs.statSync(fullPath).size;
          } catch {}
          const sizeStr = size > 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${(size / 1024).toFixed(1)} KB`;
          treeLines.push(`${indent}📄 ${entry.name} (${sizeStr})`);

          const ext = path.extname(entry.name).toLowerCase();
          const lowerName = entry.name.toLowerCase();

          // Calculate priority for LLM reading
          let priority = 0;
          if (lowerName.includes('readme') || lowerName.includes('index') || lowerName.includes('rules') || lowerName.includes('glossary')) {
            priority = 100;
          } else if (ext === '.md' || ext === '.txt') {
            priority = 80;
          } else if (ext === '.json' || ext === '.yaml' || ext === '.yml' || ext === '.toml') {
            priority = 50;
          } else if (['.ts', '.js', '.py', '.html', '.css'].includes(ext)) {
            priority = 40;
          }

          if (priority > 0) {
            candidates.push({ relPath, fullPath, size, priority });
          }
        }
      }
    } catch (err) {
      treeLines.push(`Error reading ${currentDir}: ${err}`);
    }
  }

  walk(dirPath, 0);

  // Sort candidates by priority desc, then smaller files first so we ingest more variety
  candidates.sort((a, b) => b.priority - a.priority || a.size - b.size);

  let output = `\n\n--- [Attached Directory Scan: ${path.basename(dirPath)} (${dirPath})] ---\n`;
  output += `Directory Statistics: ${totalFiles} files across ${totalDirs} subdirectories\n\n`;
  output += `Directory Hierarchy Tree:\n${treeLines.slice(0, 75).join('\n')}\n`;
  if (treeLines.length > 75) {
    output += `... [${treeLines.length - 75} additional files/folders omitted for brevity]\n`;
  }
  output += `\n--- Ingested Key Files from Directory ---\n`;

  let usedChars = 0;
  let ingestedCount = 0;

  for (const file of candidates) {
    if (usedChars >= maxContentChars) break;
    try {
      const remainingChars = maxContentChars - usedChars;
      let content = fs.readFileSync(file.fullPath, 'utf-8');
      
      // If file is huge (e.g. 2MB JSON), truncate smartly
      if (content.length > 8000) {
        content = content.slice(0, 8000) + `\n... [Truncated ${content.length - 8000} remaining characters of ${file.relPath}]`;
      }
      if (content.length > remainingChars) {
        content = content.slice(0, remainingChars) + `\n... [Truncated to fit context budget]`;
      }

      output += `\n>>> File: ${file.relPath} (${(file.size / 1024).toFixed(1)} KB) <<<\n${content}\n>>> End of ${file.relPath} <<<\n`;
      usedChars += content.length;
      ingestedCount++;
    } catch {
      // ignore
    }
  }

  output += `\n--- End of Ingested Key Files (${ingestedCount} files read, ${usedChars} characters ingested) ---\n`;
  output += `--- [End of Directory Scan: ${path.basename(dirPath)}] ---\n\n`;

  return output;
}

const dirScan = scanAndResolveDirectory('C:\\Novel', 3, 40000);
console.log('Result length:', dirScan.length);
console.log('Sample output (first 1000 chars):');
console.log(dirScan.slice(0, 1000));
console.log('\nSample output (last 500 chars):');
console.log(dirScan.slice(-500));
