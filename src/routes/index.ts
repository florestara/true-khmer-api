import { Hono } from "hono";
import usersRoute from "./users";
import eventRoute from "./event";

const routes = new Hono();

routes.route("/users", usersRoute);
routes.route("/event", eventRoute);

export default routes;
