import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface PortalAuthRequest extends Request {
  portalClientId?: string;
  portalVendorUserId?: string;
  portalLoginMethod?: 'token' | 'email';
}

export function authenticatePortal(req: PortalAuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as {
      type?: string;
      clientId?: string;
      vendorUserId?: string;
      loginMethod?: 'token' | 'email';
    };
    if (payload.type !== 'portal' || !payload.clientId || !payload.vendorUserId) {
      return res.status(401).json({ error: 'Invalid portal token' });
    }
    req.portalClientId = payload.clientId;
    req.portalVendorUserId = payload.vendorUserId;
    req.portalLoginMethod = payload.loginMethod;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
