import { Hono } from "hono";
import { communityForumFeature } from "../community/forum/categories";
import { communityForumQuestionFeature } from "../community/forum/questions";
import authRoute from "../auth";
import onboardingRoute from "../onboarding";
import uploadRoute from "../uploads";

const routes = new Hono();

routes.route("/forum/category", communityForumFeature);
routes.route("/forum/question", communityForumQuestionFeature);
routes.route("/auth", authRoute);
routes.route("/onboarding", onboardingRoute);
routes.route("/uploads", uploadRoute);

export default routes;
