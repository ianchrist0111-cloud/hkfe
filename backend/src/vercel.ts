import { createApp } from './app';

// Vercel invokes this Express app for incoming HTTP requests.
// Do not call app.listen() or start persistent background services here.
const app = createApp();

export default app;
