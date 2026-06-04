import type { Request, Response } from 'express';
import { login as loginUser, getUserById } from './auth.service';
import { bffData } from '../../shared/response/success';
import type { AuthUser } from './auth.types';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username?.trim() || !password?.trim()) {
    res.status(400).json({ success: false, error: 'username and password are required', code: 'BAD_REQUEST' });
    return;
  }

  try {
    const result = await loginUser({ username, password });
    res.json(bffData(result));
  } catch (err) {
    // Only expose known, safe authentication messages to the client.
    // Any other error (e.g. DB connection failure) must NOT leak internal
    // details such as file paths or database credentials — return a generic
    // message and log the real cause server-side.
    const SAFE_AUTH_MESSAGES = new Set(['Invalid credentials', 'Account is not active']);
    const rawMessage = err instanceof Error ? err.message : '';

    if (SAFE_AUTH_MESSAGES.has(rawMessage)) {
      res.status(401).json({ success: false, error: rawMessage, code: 'UNAUTHORIZED' });
      return;
    }

    console.error('[auth.login] Unexpected error during login:', err);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
      code: 'INTERNAL',
    });
  }
}

export async function me(req: Request, res: Response) {
  // req.authUser is set by requireAuth middleware
  const authUser = (req as Request & { authUser?: AuthUser }).authUser;
  if (!authUser) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }
  res.json(bffData(authUser));
}
