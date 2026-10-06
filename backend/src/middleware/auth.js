const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Fetch full user to get isAdmin flag
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, isAdmin: true },
    });
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Like authMiddleware, but never rejects: if a valid Bearer token is present it
// populates req.user / req.userId; otherwise the request continues as anonymous.
// Used by endpoints that serve both logged-in users (trust the token) and
// anonymous/demo callers (fall back to a device fingerprint).
async function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, isAdmin: true },
      });
      if (user) {
        req.user = user;
        req.userId = user.id;
        req.tokenIssuedAt = decoded.iat || null;
      } else {
        req.authInvalid = true;
      }
    } catch (err) {
      // Invalid/expired token → treat as anonymous, don't reject. But remember the
      // client THINKS it is signed in: endpoints that can say so (license check)
      // tell it, so an expired session is never shown as "you're on the free plan".
      // Only a token the server genuinely rejects counts — a database hiccup during
      // the user lookup must never sign a customer out.
      const tokenRejected = ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(err && err.name);
      if (tokenRejected) req.authInvalid = true;
    }
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware, optionalAuthMiddleware };
