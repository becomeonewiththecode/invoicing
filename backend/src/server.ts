import app from './app';
import { ensureSchema } from './config/database';
import { startReminderJob, startRecurrenceJob } from './jobs/reminders';

const PORT = process.env.PORT || 3001;

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startReminderJob();
      startRecurrenceJob();
    });
  })
  .catch((err) => {
    console.error('Failed to ensure database schema', err);
    process.exit(1);
  });
