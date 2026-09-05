import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-me';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[TalentFlow] WARNING: Running in production without JWT_SECRET set. Set a strong, random JWT_SECRET now.');
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, company_id: user.company_id, role: user.role },
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