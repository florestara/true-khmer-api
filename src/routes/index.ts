import { Hono } from "hono";
import { communityForumFeature } from "../community/forum/categories";
import usersRoute from "./users";
import eventRoute from "./event";

const routes = new Hono();

routes.route("/forum", communityForumFeature);
routes.route("/users", usersRoute);
routes.route("/event", eventRoute);

export default routes;
