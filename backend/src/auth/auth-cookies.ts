import type { Response } from 'express';

export const isProduction = process.env.NODE_ENV === 'production';

export const COOKIE_OPTS_ACCESS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 1000, // 1h — aligné sur JWT_EXPIRES_IN
  path: '/',
};

export const COOKIE_OPTS_REFRESH = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30j — aligné sur refreshTokenExpires
  path: '/',
};

/**
 * Pose les 2 cookies httpOnly (access + refresh).
 * Les tokens restent aussi dans le body pour backward compat avec le frontend js-cookie.
 */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookie('token', accessToken, COOKIE_OPTS_ACCESS);
  res.cookie('refresh_token', refreshToken, COOKIE_OPTS_REFRESH);
}
