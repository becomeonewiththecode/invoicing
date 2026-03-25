import app from './app';
import { ensureSchema } from './config/database';
import { startReminderJob, startRecurrenceJob } from './jobs/reminders';
import { startBackupJob } from './jobs/backups';

const PORT = Number(process.env.PORT) || 3001;
/** In Docker, listen on all interfaces so published ports (e.g. 3001:3001) reach the process. */
const HOST = process.env.LISTEN_HOST || '0.0.0.0';

ensureSchema()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Server listening on http://${HOST}:${PORT}`);
      startReminderJob();
      startRecurrenceJob();
      startBackupJob();
    });
  })
  .catch((err) => {
    console.error('Failed to ensure database schema', err);
    process.exit(1);
  });
