import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "../../user";
import { launchpad } from "../launchpad";
import { relations, sql } from "drizzle-orm";

export const launchpadRole = pgTable(
  "launchpad_role",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    launchpadId: uuid("launchpad_id")
      .notNull()
      .references(() => launchpad.id, {
        onDelete: "cascade",
      }),
    title: varchar("title", { length: 120 }).notNull(),
    capacity: integer("capacity").default(1).notNull(),
    description: text("description"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: uuid("updated_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("launchpad_role_title_unique_idx").using(
      "btree",
      table.launchpadId,
      sql`lower(${table.title})`,
    ),
  ],
);

export const launchpadRoleRelations = relations(launchpadRole, ({ one }) => ({
  launchpad: one(launchpad, {
    fields: [launchpadRole.launchpadId],
    references: [launchpad.id],
  }),
  createdBy: one(user, {
    fields: [launchpadRole.createdBy],
    references: [user.id],
  }),
  updatedBy: one(user, {
    fields: [launchpadRole.updatedBy],
    references: [user.id],
  }),
}));
