const { app } = require('./app');
const { port } = require('./config/env');

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

