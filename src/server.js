const { app } = require('./app');
const { port } = require('./config/env');
const { startReminderScheduler } = require('./services/reminders/scheduler');

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  startReminderScheduler();
});

