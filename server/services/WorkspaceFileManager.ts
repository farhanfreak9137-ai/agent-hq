import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export interface WorkspaceFileMeta {
  filename: string;
  relativePath: string;
  sizeBytes: number;
  modifiedAt: number;
  extension: string;
  isBinary: boolean;
  mimeType: string;
}

export interface FileWriteOptions {
  relativePath: string;
  content: string;
  format?: 'text' | 'csv' | 'xlsx' | 'docx' | 'json';
  action?: 'create' | 'overwrite' | 'append';
}

export class WorkspaceFileManager {
  private static workspaceRoot: string = path.resolve(process.cwd(), 'workspace');

  public static getWorkspaceRoot(): string {
    if (!fs.existsSync(this.workspaceRoot)) {
      fs.mkdirSync(this.workspaceRoot, { recursive: true });
    }
    return this.workspaceRoot;
  }

  /**
   * Safely sanitize and resolve path within workspace directory.
   */
  public static resolveSafePath(targetRelativePath: string): string {
    const root = this.getWorkspaceRoot();
    // Normalize path and strip leading slash or workspace prefix if provided
    let clean = targetRelativePath.trim().replace(/^workspace[\\\/]/i, '');
    clean = path.normalize(clean).replace(/^(\.\.[\/\\])+/, '');
    const resolved = path.resolve(root, clean);
    if (!resolved.startsWith(root)) {
      throw new Error(`Directory traversal attempt detected: ${targetRelativePath}`);
    }
    return resolved;
  }

  /**
   * List all files in the workspace.
   */
  public static listFiles(): WorkspaceFileMeta[] {
    const root = this.getWorkspaceRoot();
    const results: WorkspaceFileMeta[] = [];

    function scan(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (entry.isFile()) {
            if (entry.name === 'README.md' && dir === root) {
              // keep readme visible as reference or include it
            }
            const stat = fs.statSync(fullPath);
            const rel = path.relative(root, fullPath).replace(/\\/g, '/');
            const ext = path.extname(entry.name).toLowerCase();
            const isBinary = ['.xlsx', '.xls', '.docx', '.pdf', '.png', '.jpg', '.zip'].includes(ext);

            let mimeType = 'text/plain';
            if (ext === '.md') mimeType = 'text/markdown';
            else if (ext === '.json') mimeType = 'application/json';
            else if (ext === '.csv') mimeType = 'text/csv';
            else if (ext === '.xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            else if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            else if (ext === '.html') mimeType = 'text/html';

            results.push({
              filename: entry.name,
              relativePath: rel,
              sizeBytes: stat.size,
              modifiedAt: stat.mtimeMs,
              extension: ext,
              isBinary,
              mimeType,
            });
          }
        }
      } catch (err) {
        console.warn(`[WorkspaceFileManager] Scan error for ${dir}:`, err);
      }
    }

    scan(root);
    return results.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  /**
   * Read file content.
   */
  public static readFile(relativePath: string): { content?: string; buffer?: Buffer; meta: WorkspaceFileMeta } {
    const fullPath = this.resolveSafePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }
    const stat = fs.statSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const isBinary = ['.xlsx', '.xls', '.docx', '.pdf', '.png', '.jpg', '.zip'].includes(ext);
    const meta: WorkspaceFileMeta = {
      filename: path.basename(fullPath),
      relativePath: path.relative(this.getWorkspaceRoot(), fullPath).replace(/\\/g, '/'),
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs,
      extension: ext,
      isBinary,
      mimeType: isBinary ? 'application/octet-stream' : 'text/plain; charset=utf-8',
    };

    if (isBinary) {
      const buffer = fs.readFileSync(fullPath);
      return { buffer, meta };
    } else {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return { content, meta };
    }
  }

  /**
   * Write or edit a file in the workspace.
   */
  public static async writeFile(opts: FileWriteOptions): Promise<WorkspaceFileMeta> {
    const fullPath = this.resolveSafePath(opts.relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const format = opts.format || (ext === '.docx' ? 'docx' : ext === '.xlsx' ? 'xlsx' : 'text');

    // 1. DOCX Generation
    if (format === 'docx' || ext === '.docx') {
      const docBuffer = await this.convertMarkdownToDocxBuffer(opts.content, path.basename(fullPath, ext));
      fs.writeFileSync(fullPath, docBuffer);
    }
    // 2. Excel (XLSX) Generation
    else if (format === 'xlsx' || ext === '.xlsx') {
      const xlsxBuffer = this.convertToExcelBuffer(opts.content);
      fs.writeFileSync(fullPath, xlsxBuffer);
    }
    // 3. Text / Markdown / CSV / Code
    else {
      if (opts.action === 'append' && fs.existsSync(fullPath)) {
        fs.appendFileSync(fullPath, '\n' + opts.content, 'utf-8');
      } else {
        fs.writeFileSync(fullPath, opts.content, 'utf-8');
      }
    }

    const stat = fs.statSync(fullPath);
    return {
      filename: path.basename(fullPath),
      relativePath: path.relative(this.getWorkspaceRoot(), fullPath).replace(/\\/g, '/'),
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs,
      extension: ext,
      isBinary: ext === '.docx' || ext === '.xlsx',
      mimeType: ext === '.docx' 
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : ext === '.xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/plain; charset=utf-8',
    };
  }

  /**
   * Helper to convert structured markdown text into a styled DOCX buffer.
   */
  private static async convertMarkdownToDocxBuffer(markdown: string, defaultTitle: string): Promise<Buffer> {
    const lines = markdown.split(/\r?\n/);
    const paragraphs: Paragraph[] = [];

    // Title / Header
    paragraphs.push(
      new Paragraph({
        text: defaultTitle.replace(/[-_]/g, ' ').toUpperCase(),
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.LEFT,
        spacing: { after: 200 },
      })
    );

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        paragraphs.push(new Paragraph({ text: '' }));
        continue;
      }

      if (trimmed.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: trimmed.replace(/^#\s+/, ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          })
        );
      } else if (trimmed.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: trimmed.replace(/^##\s+/, ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (trimmed.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: trimmed.replace(/^###\s+/, ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 },
          })
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        paragraphs.push(
          new Paragraph({
            text: trimmed.replace(/^[-*]\s+/, ''),
            bullet: { level: 0 },
            spacing: { after: 60 },
          })
        );
      } else if (/^\d+\.\s+/.test(trimmed)) {
        paragraphs.push(
          new Paragraph({
            text: trimmed.replace(/^\d+\.\s+/, ''),
            bullet: { level: 0 },
            spacing: { after: 60 },
          })
        );
      } else {
        // Handle bolding markers **text** simply
        const parts = trimmed.split(/(\*\*.*?\*\*)/g);
        const runs: TextRun[] = [];
        for (const part of parts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
          } else if (part.length > 0) {
            runs.push(new TextRun({ text: part }));
          }
        }
        paragraphs.push(
          new Paragraph({
            children: runs.length > 0 ? runs : [new TextRun(trimmed)],
            spacing: { after: 100 },
          })
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Helper to convert tabular data (CSV or JSON array) into an XLSX workbook buffer.
   */
  private static convertToExcelBuffer(content: string): Buffer {
    let workbook = xlsx.utils.book_new();

    // Check if JSON array
    try {
      const parsed = JSON.parse(content.trim());
      if (Array.isArray(parsed) && parsed.length > 0) {
        const worksheet = xlsx.utils.json_to_sheet(parsed);
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Data');
        return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      }
    } catch {
      // Not JSON, treat as CSV or Markdown table
    }

    // Check if markdown table or CSV
    const lines = content.trim().split(/\r?\n/);
    const rows: string[][] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Skip markdown divider row |---|---|
      if (/^\|?[-:\s|]+\|?$/.test(trimmed)) continue;

      if (trimmed.includes('|')) {
        // Markdown table row
        const cells = trimmed
          .split('|')
          .map((c) => c.trim())
          .filter((c, idx, arr) => (idx === 0 && c === '' ? false : idx === arr.length - 1 && c === '' ? false : true));
        if (cells.length > 0) rows.push(cells);
      } else if (trimmed.includes(',')) {
        // Standard CSV row (simple parse)
        const cells = trimmed.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        rows.push(cells);
      } else if (trimmed.includes('\t')) {
        // TSV
        rows.push(trimmed.split('\t').map((c) => c.trim()));
      }
    }

    if (rows.length > 0) {
      const worksheet = xlsx.utils.aoa_to_sheet(rows);
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }

    // Fallback: single cell or line list
    const worksheet = xlsx.utils.aoa_to_sheet(lines.map((l) => [l]));
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Notes');
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}
