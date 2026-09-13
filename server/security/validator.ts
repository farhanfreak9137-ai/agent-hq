import { Request, Response, NextFunction } from 'express';

export class Validator {
  /**
   * Middleware to validate task creation payloads.
   */
  public static validateTaskCreation(req: Request, res: Response, next: NextFunction): void {
    const { title, description, priority } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'Validation Error: "title" is required and must be a non-empty string.' });
      return;
    }

    if (title.length > 200) {
      res.status(400).json({ error: 'Validation Error: "title" exceeds 200 character limit.' });
      return;
    }

    if (description && (typeof description !== 'string' || description.length > 5000)) {
      res.status(400).json({ error: 'Validation Error: "description" must be a string under 5000 characters.' });
      return;
    }

    if (priority && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) {
      res.status(400).json({ error: 'Validation Error: Invalid "priority". Allowed: LOW, MEDIUM, HIGH, CRITICAL.' });
      return;
    }

    next();
  }

  /**
   * Middleware to validate message dispatch.
   */
  public static validateMessage(req: Request, res: Response, next: NextFunction): void {
    const { sourceAgentId, targetAgentId, content } = req.body;

    if (!sourceAgentId || typeof sourceAgentId !== 'string') {
      res.status(400).json({ error: 'Validation Error: "sourceAgentId" is required.' });
      return;
    }

    if (!targetAgentId || typeof targetAgentId !== 'string') {
      res.status(400).json({ error: 'Validation Error: "targetAgentId" is required.' });
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Validation Error: "content" must be a non-empty string.' });
      return;
    }

    if (content.length > 2000) {
      res.status(400).json({ error: 'Validation Error: "content" exceeds 2000 characters.' });
      return;
    }

    next();
  }

  /**
   * Middleware to validate initiative / DAG creation.
   */
  public static validateInitiative(req: Request, res: Response, next: NextFunction): void {
    const { title, nodes } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'Validation Error: Initiative "title" is required.' });
      return;
    }

    if (nodes && !Array.isArray(nodes)) {
      res.status(400).json({ error: 'Validation Error: "nodes" must be an array.' });
      return;
    }

    if (Array.isArray(nodes)) {
      const nodeIds = new Set<string>();
      for (const node of nodes) {
        if (!node.id || typeof node.id !== 'string') {
          res.status(400).json({ error: 'Validation Error: Each DAG node must have a unique string "id".' });
          return;
        }
        if (nodeIds.has(node.id)) {
          res.status(400).json({ error: `Validation Error: Duplicate node id "${node.id}".` });
          return;
        }
        nodeIds.add(node.id);

        if (!node.title || typeof node.title !== 'string') {
          res.status(400).json({ error: `Validation Error: Node "${node.id}" missing string "title".` });
          return;
        }
      }

      // Check for simple self-dependency
      for (const node of nodes) {
        if (Array.isArray(node.dependencies)) {
          if (node.dependencies.includes(node.id)) {
            res.status(400).json({ error: `Validation Error: Node "${node.id}" cannot depend on itself.` });
            return;
          }
        }
      }
    }

    next();
  }
}
