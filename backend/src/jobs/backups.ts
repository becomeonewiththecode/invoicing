import cron from 'node-cron';
import { runAutomatedBackups } from '../services/adminBackup';

export function startBackupJob() {
  // Run automated backups daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[backup] Starting automated backup run...');
    try {
      const results = await runAutomatedBackups();
      const success = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      console.log(`[backup] Completed: ${success} succeeded, ${failed} failed`);
      if (failed > 0) {
        for (const r of results.filter((r) => !r.success)) {
          console.error(`[backup] Failed for user ${r.userId}: ${r.error}`);
        }
      }
    } catch (err) {
      console.error('[backup] Automated backup run failed:', err);
    }
  });

  console.log('[backup] Backup job scheduled (daily at 2 AM)');
}
