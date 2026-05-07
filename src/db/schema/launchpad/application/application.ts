import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "../../user";
import { launchpad } from "../launchpad";
import { launchpadRole } from "../roles/roles";

export const launchpadApplicationStatusEnum = pgEnum(
  "launchpad_application_status",
  ["SUBMITTED", "PASSED", "CONFIRMED", "REJECTED", "COMPLETED", "WITHDRAWN"],
);

const launchpadApplication = pgTable(
  "launchpad_application",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    launchpadId: uuid("launchpad_id")
      .notNull()
      .references(() => launchpad.id, {
        onDelete: "cascade",
      }),
    launchpadRoleId: uuid("launchpad_role_id")
      .notNull()
      .references(() => launchpadRole.id, {
        onDelete: "cascade",
      }),
    motivation: varchar("motivation", { length: 2000 }).notNull(),
    portfolio: varchar("portfolio", { length: 255 }).notNull(),
    status: launchpadApplicationStatusEnum("status")
      .default("SUBMITTED")
      .notNull(),
    documentKeys: jsonb("document_keys")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    documentNames: jsonb("document_names")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("launchpad_application_launchpad_id_idx").using(
      "btree",
      table.launchpadId,
    ),
    index("launchpad_application_launchpad_role_id_idx").using(
      "btree",
      table.launchpadRoleId,
    ),
    index("launchpad_application_created_by_idx").using(
      "btree",
      table.createdBy,
    ),
  ],
);

const launchpadApplicationLog = pgTable(
  "launchpad_application_log",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    launchpadApplicationId: uuid("launchpad_application_id")
      .notNull()
      .references(() => launchpadApplication.id, {
        onDelete: "cascade",
      }),
    status: launchpadApplicationStatusEnum("status")
      .default("SUBMITTED")
      .notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("launchpad_application_log_application_id_idx").using(
      "btree",
      table.launchpadApplicationId,
    ),
    index("launchpad_application_log_created_by_idx").using(
      "btree",
      table.createdBy,
    ),
  ],
);

export const launchpadApplicationRelations = relations(
  launchpadApplication,
  ({ one }) => ({
    launchpad: one(launchpad, {
      fields: [launchpadApplication.launchpadId],
      references: [launchpad.id],
    }),
    role: one(launchpadRole, {
      fields: [launchpadApplication.launchpadRoleId],
      references: [launchpadRole.id],
    }),
  }),
);

export const launchpadApplicationLogRelations = relations(
  launchpadApplicationLog,
  ({ one }) => ({
    application: one(launchpadApplication, {
      fields: [launchpadApplicationLog.launchpadApplicationId],
      references: [launchpadApplication.id],
    }),
  }),
);

export { launchpadApplication, launchpadApplicationLog };
