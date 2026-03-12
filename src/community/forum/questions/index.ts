import { Hono } from "hono";
import {
  handleCreateQuestion,
  handleGetQuestion,
  handleGetQuestions,
  handleGetQuestionsPage,
} from "./handler";
import { requireAccessToken } from "../../../auth/middleware";
import {
  createQuestionValidator,
  getQuestionParamsValidator,
  getQuestionsPageQueryValidator,
} from "./validator";

export const communityForumQuestionFeature = new Hono();

communityForumQuestionFeature.use("*", requireAccessToken);

communityForumQuestionFeature.get("/get-questions", async (c) => {
  return handleGetQuestions(c);
});

communityForumQuestionFeature.get(
  "/get-questions-page",
  getQuestionsPageQueryValidator,
  async (c) => {
    const query = c.req.valid("query");
    return handleGetQuestionsPage(c, query);
  }
);

communityForumQuestionFeature.get(
  "/get-question/:questionId",
  getQuestionParamsValidator,
  async (c) => {
    const params = c.req.valid("param");
    return handleGetQuestion(c, params);
  }
);

communityForumQuestionFeature.post(
  "/create-question",
  createQuestionValidator,
  async (c) => {
    const data = c.req.valid("json");
    return handleCreateQuestion(c, data);
  }
);
