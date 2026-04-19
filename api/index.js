// Vercel serverless entry — wraps the Express app as a single function.
// All /api/* routes flow through here. Static client files are served
// by Vercel directly from the Vite build output (configured in vercel.json).
module.exports = require('../server/app');
