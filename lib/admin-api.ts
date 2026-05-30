import "server-only";

import { NextResponse } from "next/server";
import { isAdmin, isAdminConfigured } from "./admin-auth";

export async function requireAdminApi(): Promise<NextResponse | null> {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin auth is not configured" },
      { status: 503 },
    );
  }

  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin required" }, { status: 401 });
  }

  return null;
}
