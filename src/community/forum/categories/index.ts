// App Entry Point for Community Forum Feature

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { handleCreateCategory } from "./handler";

// Placeholder until real auth middleware is integrated in this service.
const requireAdmin: MiddlewareHandler = async (_, next) => {
  await next();
};

export const communityForumFeature = new Hono();

communityForumFeature.post("/create-category", requireAdmin, handleCreateCategory);
