import { Router, Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createProjectSchema, updateProjectSchema } from '../models/validation';

const router = Router();
router.use(authenticate);

/** Express may type params as string | string[] */
function param(v: string | string[] | undefined): string {
  if (v == null) return '';
  return Array.isArray(v) ? v[0] ?? '' : v;
}

async function clientOwnedByUser(userId: string, clientId: string): Promise<boolean> {
  const r = await pool.query('SELECT 1 FROM clients WHERE id = $1 AND user_id = $2', [clientId, userId]);
  return r.rows.length > 0;
}

function milestonesToJson(
  milestones: { title: string; dueDate?: string | null }[] | undefined
): string {
  if (!milestones?.length) return '[]';
  return JSON.stringify(
    milestones.map((m) => ({ title: m.title, due_date: m.dueDate ?? null }))
  );
}

type DbExecutor = Pick<Pool | PoolClient, 'query'>;

type ExternalLinkRow = {
  id: string;
  url: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

async function replaceExternalLinks(
  q: DbExecutor,
  projectId: string,
  links: { url: string; description?: string | null }[] | undefined
): Promise<void> {
  await q.query('DELETE FROM project_external_links WHERE project_id = $1', [projectId]);
  if (!links?.length) return;
  let order = 0;
  for (const item of links) {
    const u = item.url?.trim();
    if (!u) continue;
    await q.query(
      `INSERT INTO project_external_links (project_id, url, description, sort_order) VALUES ($1, $2, $3, $4)`,
      [projectId, u, item.description?.trim() || null, order++]
    );
  }
}

async function attachExternalLinksToProjects<T extends { id: string }>(
  projects: T[]
): Promise<(T & { external_links: ExternalLinkRow[] })[]> {
  if (projects.length === 0) return [];
  const ids = projects.map((p) => p.id);
  const att = await pool.query<ExternalLinkRow & { project_id: string }>(
    `SELECT project_id, id, url, description, sort_order, created_at
     FROM project_external_links WHERE project_id = ANY($1::uuid[]) ORDER BY project_id, sort_order, created_at`,
    [ids]
  );
  const byProject = new Map<string, ExternalLinkRow[]>();
  for (const row of att.rows) {
    const { project_id, ...rest } = row;
    const list = byProject.get(project_id) ?? [];
    list.push(rest);
    byProject.set(project_id, list);
  }
  return projects.map((p) => ({
    ...p,
    external_links: byProject.get(p.id) ?? [],
  }));
}

async function enrichProjectRows<T extends { id: string }>(projects: T[]) {
  return attachExternalLinksToProjects(projects);
}

async function fetchProjectEnriched(projectId: string, userId: string) {
  const pr = await pool.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
  if (pr.rows.length === 0) return null;
  const [row] = await enrichProjectRows([pr.rows[0]]);
  return row;
}

// List projects for a client
router.get('/:clientId/projects', async (req: AuthRequest, res: Response) => {
  try {
    const clientId = param(req.params.clientId);
    if (!(await clientOwnedByUser(req.userId!, clientId))) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const result = await pool.query(
      'SELECT * FROM projects WHERE client_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [clientId, req.userId]
    );
    const rows = await enrichProjectRows(result.rows);
    res.json(rows);
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create project
router.post('/:clientId/projects', validate(createProjectSchema), async (req: AuthRequest, res: Response) => {
  const db = await pool.connect();
  try {
    const clientId = param(req.params.clientId);
    if (!(await clientOwnedByUser(req.userId!, clientId))) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const body = req.body as {
      name: string;
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      status?: string;
      priority?: string;
      externalLinks?: { url: string; description?: string | null }[];
      budget?: number | null;
      hours?: number | null;
      hoursIsMaximum?: boolean;
      dependencies?: string | null;
      milestones?: { title: string; dueDate?: string | null }[];
      teamMembers?: string[];
      tags?: string[];
      notes?: string | null;
    };

    const {
      name,
      description,
      startDate,
      endDate,
      status,
      priority,
      externalLinks,
      budget,
      hours,
      hoursIsMaximum,
      dependencies,
      milestones,
      teamMembers,
      tags,
      notes,
    } = body;

    await db.query('BEGIN');
    const ins = await db.query(
      `INSERT INTO projects (
        client_id, user_id, name, description, start_date, end_date, status, priority,
        budget, hours, hours_is_maximum, dependencies, milestones, team_members, tags, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16)
      RETURNING id`,
      [
        clientId,
        req.userId,
        name,
        description ?? null,
        startDate ?? null,
        endDate ?? null,
        status ?? 'not_started',
        priority ?? 'medium',
        budget ?? null,
        hours ?? null,
        hoursIsMaximum ?? false,
        dependencies ?? null,
        milestonesToJson(milestones),
        teamMembers ?? [],
        tags ?? [],
        notes ?? null,
      ]
    );
    const projectId = ins.rows[0].id as string;
    await replaceExternalLinks(db, projectId, externalLinks);
    await db.query('COMMIT');

    const row = await fetchProjectEnriched(projectId, req.userId!);
    res.status(201).json(row);
  } catch (err) {
    try {
      await db.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    db.release();
  }
});

// Get one project
router.get('/:clientId/projects/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const clientId = param(req.params.clientId);
    const projectId = param(req.params.projectId);
    if (!(await clientOwnedByUser(req.userId!, clientId))) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const row = await fetchProjectEnriched(projectId, req.userId!);
    if (!row || row.client_id !== clientId) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(row);
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update project
router.put('/:clientId/projects/:projectId', validate(updateProjectSchema), async (req: AuthRequest, res: Response) => {
  try {
    const clientId = param(req.params.clientId);
    const projectId = param(req.params.projectId);
    if (!(await clientOwnedByUser(req.userId!, clientId))) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const existing = await pool.query(
      'SELECT id, client_id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    if (existing.rows.length === 0 || existing.rows[0].client_id !== clientId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const body = req.body as Record<string, unknown>;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      startDate: 'start_date',
      endDate: 'end_date',
      status: 'status',
      priority: 'priority',
      budget: 'budget',
      hours: 'hours',
      hoursIsMaximum: 'hours_is_maximum',
      dependencies: 'dependencies',
      notes: 'notes',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        setClauses.push(`${col} = $${i++}`);
        values.push(body[key]);
      }
    }

    if (body.milestones !== undefined) {
      setClauses.push(`milestones = $${i++}::jsonb`);
      values.push(milestonesToJson(body.milestones as { title: string; dueDate?: string | null }[]));
    }
    if (body.teamMembers !== undefined) {
      setClauses.push(`team_members = $${i++}`);
      values.push(body.teamMembers);
    }
    if (body.tags !== undefined) {
      setClauses.push(`tags = $${i++}`);
      values.push(body.tags);
    }

    const hasExternalLinks = Object.prototype.hasOwnProperty.call(body, 'externalLinks');

    if (setClauses.length === 0 && !hasExternalLinks) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (setClauses.length > 0) {
      setClauses.push('updated_at = NOW()');
      values.push(projectId, req.userId);
      await pool.query(
        `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
        values
      );
    } else if (hasExternalLinks) {
      await pool.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1 AND user_id = $2`, [projectId, req.userId]);
    }

    if (hasExternalLinks) {
      await replaceExternalLinks(
        pool,
        projectId,
        body.externalLinks as { url: string; description?: string | null }[] | undefined
      );
    }

    const row = await fetchProjectEnriched(projectId, req.userId!);
    res.json(row);
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete project
router.delete('/:clientId/projects/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const clientId = param(req.params.clientId);
    const projectId = param(req.params.projectId);
    if (!(await clientOwnedByUser(req.userId!, clientId))) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 AND client_id = $3 RETURNING id',
      [projectId, req.userId, clientId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
