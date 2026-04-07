import type { Context } from "hono";
import { findReportingTypes } from "./reportingType.query";

export async function handleReportingTypes(c: Context) {
  try {
    const reportingType = await findReportingTypes();

    if (!reportingType) {
      return c.json({ ok: false, error: "Reporting type not found" }, 404);
    }
    return c.json({ ok: true, reportingType }, 200);
  } catch (error) {
    console.error("Failed to get reporting types", error);
    return c.json({ ok: false, error: "Failed to get reporting types" }, 500);
  }
}
