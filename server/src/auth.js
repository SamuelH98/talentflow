import jwt from 'jsonwebtoken';
import { getDb } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-me';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[TalentFlow] WARNING: Running in production without JWT_SECRET set. Set a strong, random JWT_SECRET now.');
}

// Tracks a recruiter/system action in the audit log. Never stores candidate
// PII beyond ids/emails already in the request; detail is a short string.
export function logAudit({ user = null, action, detail = null, db }) {
  const target = db || getDb();
  target
    .prepare(
      `INSERT INTO audit_log (company_id, user_id, user_email, action, detail)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      user?.company_id ?? null,
      user?.id ?? null,
      user?.email ?? null,
      action,
      detail
    );
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, company_id: user.company_id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}