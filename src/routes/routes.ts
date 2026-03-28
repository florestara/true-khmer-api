import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../lib/types";
import { authRouter } from "../modules/auth/auth.router";
import { answersRouter } from "../modules/forum/answers/answers.router";
import { categoriesRouter } from "../modules/forum/categories/categories.router";
import { questionsRouter } from "../modules/forum/questions/questions.router";
import { onboardingRouter } from "../modules/onboarding/onboarding.router";
import { uploadsRouter } from "../modules/uploads/uploads.router";
import { postVolunteerRouter } from "../modules/volunteer/post-volunteer/post-volunteer.router";

const routes = new OpenAPIHono<AppBindings>();

routes.route("/auth", authRouter);
routes.route("/onboarding", onboardingRouter);
routes.route("/uploads", uploadsRouter);
routes.route("/forum/category", categoriesRouter);
routes.route("/forum/questions", questionsRouter);
routes.route("/forum/answer", answersRouter);
routes.route("/volunteer", postVolunteerRouter);

export default routes;
