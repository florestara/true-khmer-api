import { Hono } from "hono";
import { communityForumFeature } from "../community/forum/categories";
import { communityForumQuestionFeature } from "../community/forum/questions";
import eventRoute from "./event";
import authRoute from "../auth";

const routes = new Hono();

routes.route("/forum/category", communityForumFeature);
routes.route("/forum/question", communityForumQuestionFeature);
routes.route("/events", eventRoute);
routes.route("/auth", authRoute);

export default routes;
