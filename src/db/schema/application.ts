import { pgEnum } from "drizzle-orm/pg-core";

export const applicationDeclinedByEnum = pgEnum("application_declined_by", [
  "POSTER",
  "APPLICANT",
  "SYSTEM",
]);
