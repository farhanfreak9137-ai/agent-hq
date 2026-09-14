# Agent HQ Workspace Folder

Drop any files, codebases, documents, or manuscripts you want the agents to inspect into this `workspace/` directory.

### How to use:
1. **Drop files or folders here**: e.g., `workspace/chapter1.txt`, `workspace/my-novel.md`, or a source code folder `workspace/my-project/`.
2. **Mention the file in your mission**:
   - Example: *"Review chapter1.txt for character pacing and dialogue"*
   - Or: *"Audit workspace/src/auth.ts for security vulnerabilities and refactor it"*
3. **Automatic Content Attachment**:
   - The backend automatically detects the file mention, reads its contents from disk, and feeds the full text directly into the agent's prompt (NOVA, ATLAS, ECHO, etc.).
   - You can also specify any absolute path on your PC (e.g. `C:\Users\RCP\Desktop\notes.txt`).
