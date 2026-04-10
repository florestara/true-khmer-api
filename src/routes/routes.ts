import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../lib/types";
import { authRouter } from "../modules/auth/auth.router";
import { answersRouter } from "../modules/forum/answers/answers.router";
import { categoriesRouter } from "../modules/forum/categories/categories.router";
import { questionsRouter } from "../modules/forum/questions/questions.router";
import { onboardingRouter } from "../modules/onboarding/onboarding.router";
import { uploadsRouter } from "../modules/uploads/uploads.router";
import { postVolunteerRouter } from "../modules/volunteer/post-volunteer/post-volunteer.router";
import { publicPostVolunteerRouter } from "../modules/volunteer/post-volunteer/public.post-volunteer.router";
import { publicQuestionsRouter } from "../modules/forum/questions/public.questions.router";
import { publicCategoriesRouter } from "../modules/forum/categories/public.categories.router";
import { publicAnswersRouter } from "../modules/forum/answers/public.answers.router";
import { reportingTypeRouter } from "../modules/forum/reportingType/reportingType.router";
import { reportingRouter } from "../modules/forum/reporting/reporting.router";

const routes = new OpenAPIHono<AppBindings>();

routes.route("/auth", authRouter);
routes.route("/onboarding", onboardingRouter);
routes.route("/uploads", uploadsRouter);
routes.route("/forum/category", categoriesRouter);
routes.route("/forum/questions", questionsRouter);
routes.route("/forum/answer", answersRouter);
routes.route("/volunteer", postVolunteerRouter);
routes.route("/volunteer/public", publicPostVolunteerRouter);
routes.route("/forum/public/questions", publicQuestionsRouter);
routes.route("/forum/public/category", publicCategoriesRouter);
routes.route("/forum/public/answer", publicAnswersRouter);
routes.route("/forum/public/reporting-type", reportingTypeRouter);
routes.route("/forum/public/reporting", reportingRouter);

export default routes;
