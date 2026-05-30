import "server-only";

import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  getAdminAuthConfig,
  isAdminAuthConfigured,
  verifyAdminSessionToken,
} from "./admin-auth-core";

export { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_SECONDS };

export function getConfiguredAdminAuth() {
  return getAdminAuthConfig(process.env);
}

export function isAdminConfigured(): boolean {
  return isAdminAuthConfigured(getConfiguredAdminAuth());
}

export async function isAdmin(): Promise<boolean> {
  const config = getConfiguredAdminAuth();
  if (!isAdminAuthConfigured(config)) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token, config.cookieSecret);
}

export function createCurrentAdminSessionToken(): string {
  const config = getConfiguredAdminAuth();
  if (!config.cookieSecret) throw new Error("ADMIN_COOKIE_SECRET is not configured");
  return createAdminSessionToken(config.cookieSecret);
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  };
}

export function expiredAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
