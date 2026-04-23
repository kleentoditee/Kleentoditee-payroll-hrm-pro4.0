import type { Role } from "@kleentoditee/db";
import { sign, verify } from "hono/jwt";
import { requireEnv } from "../env.js";

const TOKEN_TTL_SEC = 60 * 60 * 24 * 7; // 7 days (dev-friendly)
const JWT_ALGORITHM = "HS256" as const;

export type JwtPayload = {
  sub: string;
  roles: Role[];
  exp: number;
};

export async function signSessionToken(userId: string, roles: Role[]): Promise<string> {
  const secret = requireEnv("JWT_SECRET");
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  return sign({ sub: userId, roles, exp }, secret, JWT_ALGORITHM);
}

export async function verifySessionToken(token: string): Promise<JwtPayload> {
  const secret = requireEnv("JWT_SECRET");
  const payload = await verify(token, secret, JWT_ALGORITHM);
  const sub = payload.sub as string;
  const roles = payload.roles as Role[];
  const exp = payload.exp as number;
  if (!sub || !Array.isArray(roles) || typeof exp !== "number") {
    throw new Error("Invalid token payload");
  }
  return { sub, roles, exp };
}
