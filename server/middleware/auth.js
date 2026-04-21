const { validateJwt } = require('../lib/supabase');

// Paths that stay public (webhooks, signup pages, unsubscribe, static files)
const PUBLIC_PREFIXES = [
  '/api/health',
  '/api/webhooks/',
  '/api/signup/submit/',
  '/api/signup/page/',
  '/api/subscribers/unsubscribe/',
  '/api/cron/',
  '/s/',
  '/assets/',      // vite-built static assets in prod
  '/favicon',
];

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isPublic(path) {
  if (path === '/' || path === '/index.html') return true;
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

async function authMiddleware(req, res, next) {
  // Fail-closed in production: if SUPABASE_URL is missing (env dropped on a
  // redeploy, promotion from preview without the var, etc.) the whole app
  // would otherwise become open to the internet. Better to 503 loudly.
  if (!process.env.SUPABASE_URL) {
    if (process.env.NODE_ENV === 'production') {
      // Public paths (health, webhooks, unsubscribe, static) still pass — we
      // don't want a broken env to break Resend callbacks or the signup page.
      if (isPublic(req.path) || !req.path.startsWith('/api')) return next();
      return res.status(503).json({
        error: 'Auth not configured — SUPABASE_URL is missing in this deploy',
      });
    }
    // Local dev without Supabase configured — allow all so the app is usable.
    return next();
  }

  if (isPublic(req.path)) return next();

  // Serve the index.html itself without auth (the React app handles its own sign-in).
  // The React app won't render protected content without a valid session anyway,
  // and the APIs are gated below.
  if (!req.path.startsWith('/api')) return next();

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized — sign in required' });

  const user = await validateJwt(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes((user.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'Email not authorized for this app' });
  }

  req.user = user;
  next();
}

module.exports = { authMiddleware };
