import app from './app';
import { startReminderJob, startRecurrenceJob } from './jobs/reminders';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startReminderJob();
  startRecurrenceJob();
});
