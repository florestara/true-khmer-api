import type { Context } from "hono";
import { findReportingTypes } from "./reportingType.query";

export async function handleReportingTypes(c: Context) {
  try {
    const result = await findReportingTypes();

    if (!result.reportingTypes || result.reportingTypes.length === 0) {
      return c.json({ ok: false, reportingTypes: [] }, 404);
    }
    return c.json({ ok: true, reportingTypes: result.reportingTypes }, 200);
  } catch (error) {
    console.error("Failed to get reporting types", error);
    return c.json({ ok: false, reportingTypes: [] }, 500);
  }
}
