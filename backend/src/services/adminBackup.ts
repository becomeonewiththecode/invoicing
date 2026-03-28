import fs from 'fs/promises';
import path from 'path';
import pool from '../config/database';
import { exportUserData, importUserDataReplace } from './dataPort';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

async function ensureBackupDir(userId: string): Promise<string> {
  const dir = path.join(BACKUP_DIR, userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function createBackupForUser(userId: string, isAutomated = false) {
  const data = await exportUserData(userId);
  const json = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = await ensureBackupDir(userId);
  const filePath = path.join(dir, `${timestamp}.json`);

  await fs.writeFile(filePath, json, 'utf-8');
  const stats = await fs.stat(filePath);

  const result = await pool.query(
    `INSERT INTO backup_snapshots (user_id, file_path, file_size_bytes, is_automated)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, filePath, stats.size, isAutomated]
  );

  return result.rows[0];
}

export async function restoreBackup(snapshotId: string) {
  const snap = await pool.query('SELECT * FROM backup_snapshots WHERE id = $1', [snapshotId]);
  if (snap.rows.length === 0) throw new Error('Snapshot not found');

  const snapshot = snap.rows[0];
  const json = await fs.readFile(snapshot.file_path, 'utf-8');
  const data = JSON.parse(json);

  await importUserDataReplace(snapshot.user_id, data);
  return snapshot;
}

export async function verifyBackup(snapshotId: string) {
  const snap = await pool.query('SELECT * FROM backup_snapshots WHERE id = $1', [snapshotId]);
  if (snap.rows.length === 0) throw new Error('Snapshot not found');

  const snapshot = snap.rows[0];
  try {
    const json = await fs.readFile(snapshot.file_path, 'utf-8');
    const data = JSON.parse(json);

    // Basic structural verification
    const valid =
      (data.version === 1 || data.version === 2) &&
      typeof data.exportedAt === 'string' &&
      data.profile &&
      Array.isArray(data.clients) &&
      Array.isArray(data.invoices) &&
      (data.version !== 2 ||
        (Array.isArray(data.projects) && Array.isArray(data.project_external_links)));

    await pool.query(
      'UPDATE backup_snapshots SET verified = $1, verified_at = NOW() WHERE id = $2',
      [valid, snapshotId]
    );

    return { verified: valid, snapshotId };
  } catch (err) {
    await pool.query(
      'UPDATE backup_snapshots SET verified = FALSE, verified_at = NOW() WHERE id = $1',
      [snapshotId]
    );
    return { verified: false, snapshotId, error: String(err) };
  }
}

export async function deleteBackupSnapshot(snapshotId: string) {
  const snap = await pool.query('SELECT * FROM backup_snapshots WHERE id = $1', [snapshotId]);
  if (snap.rows.length === 0) throw new Error('Snapshot not found');

  try {
    await fs.unlink(snap.rows[0].file_path);
  } catch {
    // File may already be deleted
  }

  await pool.query('DELETE FROM backup_snapshots WHERE id = $1', [snapshotId]);
}

export async function getBackupSnapshots(page: number, limit: number, userId?: string) {
  const offset = (page - 1) * limit;
  const conditions = userId ? 'WHERE bs.user_id = $3' : '';
  const params: unknown[] = userId ? [limit, offset, userId] : [limit, offset];

  const [data, total] = await Promise.all([
    pool.query(
      `SELECT bs.*, u.email AS user_email
       FROM backup_snapshots bs
       JOIN users u ON u.id = bs.user_id
       ${conditions}
       ORDER BY bs.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM backup_snapshots ${userId ? 'WHERE user_id = $1' : ''}`,
      userId ? [userId] : []
    ),
  ]);

  return {
    data: data.rows,
    pagination: { page, limit, total: Number(total.rows[0].count) },
  };
}

export async function getBackupPolicies() {
  const result = await pool.query(
    `SELECT bp.*, u.email AS user_email
     FROM backup_policies bp
     LEFT JOIN users u ON u.id = bp.user_id
     ORDER BY bp.created_at`
  );
  return result.rows;
}

export async function updateBackupPolicy(
  policyId: string,
  updates: {
    retention_days?: number;
    max_snapshots?: number;
    is_enabled?: boolean;
    cron_expression?: string;
  }
) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (updates.retention_days !== undefined) {
    fields.push(`retention_days = $${idx++}`);
    params.push(updates.retention_days);
  }
  if (updates.max_snapshots !== undefined) {
    fields.push(`max_snapshots = $${idx++}`);
    params.push(updates.max_snapshots);
  }
  if (updates.is_enabled !== undefined) {
    fields.push(`is_enabled = $${idx++}`);
    params.push(updates.is_enabled);
  }
  if (updates.cron_expression !== undefined) {
    fields.push(`cron_expression = $${idx++}`);
    params.push(updates.cron_expression);
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = NOW()');
  const result = await pool.query(
    `UPDATE backup_policies SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    [...params, policyId]
  );
  return result.rows[0] || null;
}

export async function enforceRetentionPolicy(userId: string) {
  const policy = await pool.query(
    `SELECT * FROM backup_policies WHERE user_id = $1 AND is_enabled = TRUE
     UNION ALL
     SELECT * FROM backup_policies WHERE user_id IS NULL AND is_enabled = TRUE
     LIMIT 1`,
    [userId]
  );

  if (policy.rows.length === 0) return;

  const { retention_days, max_snapshots } = policy.rows[0];

  // Delete old snapshots beyond retention
  const old = await pool.query(
    `SELECT id, file_path FROM backup_snapshots
     WHERE user_id = $1 AND created_at < NOW() - INTERVAL '1 day' * $2`,
    [userId, retention_days]
  );
  for (const snap of old.rows) {
    try { await fs.unlink(snap.file_path); } catch {}
    await pool.query('DELETE FROM backup_snapshots WHERE id = $1', [snap.id]);
  }

  // Keep only max_snapshots most recent
  const excess = await pool.query(
    `SELECT id, file_path FROM backup_snapshots
     WHERE user_id = $1
     ORDER BY created_at DESC
     OFFSET $2`,
    [userId, max_snapshots]
  );
  for (const snap of excess.rows) {
    try { await fs.unlink(snap.file_path); } catch {}
    await pool.query('DELETE FROM backup_snapshots WHERE id = $1', [snap.id]);
  }
}

export async function runAutomatedBackups() {
  // Get all users with enabled policies
  const users = await pool.query(
    `SELECT DISTINCT COALESCE(bp.user_id, u.id) AS user_id
     FROM backup_policies bp
     CROSS JOIN users u
     WHERE bp.is_enabled = TRUE`
  );

  const results: { userId: string; success: boolean; error?: string }[] = [];

  for (const row of users.rows) {
    try {
      await createBackupForUser(row.user_id, true);
      await enforceRetentionPolicy(row.user_id);
      results.push({ userId: row.user_id, success: true });
    } catch (err) {
      results.push({ userId: row.user_id, success: false, error: String(err) });
    }
  }

  return results;
}
