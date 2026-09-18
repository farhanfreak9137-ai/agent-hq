import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Download,
  ExternalLink,
  RefreshCw,
  Folder,
  FileSpreadsheet,
  FileCode,
  Calendar,
  HardDrive,
  Eye,
} from 'lucide-react';

interface WorkspaceFile {
  filename: string;
  relativePath: string;
  sizeBytes: number;
  modifiedAt: number;
  extension: string;
  isBinary: boolean;
  mimeType: string;
}

interface WorkspaceFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkspaceFilesModal: React.FC<WorkspaceFilesModalProps> = ({ isOpen, onClose }) => {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ filename: string; content: string } | null>(null);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/workspace/files');
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.warn('[WorkspaceFilesModal] Failed to fetch workspace files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
      setPreviewFile(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePreview = async (file: WorkspaceFile) => {
    if (file.isBinary) {
      window.open(`http://localhost:3001/api/workspace/files/${encodeURIComponent(file.relativePath)}`, '_blank');
      return;
    }
    try {
      const res = await fetch(`http://localhost:3001/api/workspace/files/${encodeURIComponent(file.relativePath)}`);
      if (res.ok) {
        const text = await res.text();
        setPreviewFile({ filename: file.filename, content: text });
      }
    } catch (err) {
      console.error('Failed to preview file:', err);
    }
  };

  const getFileIcon = (ext: string) => {
    switch (ext) {
      case '.docx':
      case '.doc':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case '.xlsx':
      case '.xls':
      case '.csv':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case '.ts':
      case '.js':
      case '.py':
      case '.json':
      case '.html':
      case '.css':
        return <FileCode className="w-5 h-5 text-amber-400" />;
      default:
        return <FileText className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                Workspace Storage & Output Files
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  workspace/
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Real physical files written, edited, and compiled by Agent HQ agents on your PC.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchFiles}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {previewFile ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 font-mono text-xs text-cyan-300 font-bold">
                  <FileText className="w-4 h-4" />
                  <span>{previewFile.filename}</span>
                </div>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="text-xs text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
                >
                  ← Back to File List
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto select-text">
                {previewFile.content}
              </pre>
            </div>
          ) : files.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-300">No Generated Files Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Delegate a task to write a document, case study, novel chapter, or excel spreadsheet. The generated files will appear here!
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {files.map((file) => (
                <div
                  key={file.relativePath}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 transition gap-3"
                >
                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                    <div className="p-2 rounded-lg bg-slate-800/70 shrink-0">
                      {getFileIcon(file.extension)}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 font-mono truncate">
                          {file.filename}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {file.sizeBytes > 1024 * 1024
                            ? `${(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                            : file.sizeBytes > 1024
                            ? `${(file.sizeBytes / 1024).toFixed(1)} KB`
                            : `${file.sizeBytes} B`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Folder className="w-3 h-3 text-slate-500" />
                          workspace/{file.relativePath}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {new Date(file.modifiedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!file.isBinary && (
                      <button
                        onClick={() => handlePreview(file)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Preview</span>
                      </button>
                    )}
                    <a
                      href={`http://localhost:3001/api/workspace/files/${encodeURIComponent(file.relativePath)}?download=true`}
                      download
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                    <a
                      href={`http://localhost:3001/api/workspace/files/${encodeURIComponent(file.relativePath)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
