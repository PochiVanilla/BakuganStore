import { jwtVerify, SignJWT } from 'jose';

const ISSUER = 'td-bakugan';
/** Access token sống ngắn; hết hạn thì web tự gọi /auth/refresh (refresh token nằm trong cookie). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

export async function signAccessToken(claims: AccessClaims, secret: Uint8Array): Promise<string> {
  return new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

/** Chỉ nhận HS256 và đúng nơi phát hành; sai chữ ký hay hết hạn thì trả null. */
export async function verifyAccessToken(
  token: string,
  secret: Uint8Array,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], issuer: ISSUER });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}
