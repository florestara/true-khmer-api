// App Entry Point for Community Forum Feature

import { Hono } from "hono";
import { requireAdmin, requireAccessToken } from "../../../auth/middleware";
import { handleCreateCategory, handleGetCategories } from "./handler";


export const communityForumFeature = new Hono();


communityForumFeature.get("/", requireAccessToken, handleGetCategories);
communityForumFeature.post("/", requireAdmin, handleCreateCategory);
