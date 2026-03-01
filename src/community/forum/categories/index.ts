// App Entry Point for Community Forum Feature

import { Hono } from "hono";
import { requireAdmin } from "../../../auth/middleware";
import { handleCreateCategory } from "./handler";

export const communityForumFeature = new Hono();

communityForumFeature.post("/create-category", requireAdmin, handleCreateCategory);
