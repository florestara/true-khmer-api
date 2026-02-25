import { Hono } from "hono";
import { communityForumFeature } from "../community/forum/categories";
import authRoute from "../auth";

const routes = new Hono();

routes.route("/forum/category", communityForumFeature);
routes.route("/auth", authRoute);

export default routes;
