import { Hono } from "hono";
import {
  handleCreateQuestion,
  handleGetQuestion,
  handleGetQuestions,
} from "./handler";
import { requireAccessToken } from "../../../auth/middleware";
import {
  createQuestionValidator,
  getQuestionParamsValidator,
  getQuestionsQueryValidator,
} from "./validator";

export const communityForumQuestionFeature = new Hono();

communityForumQuestionFeature.use("*", requireAccessToken);

communityForumQuestionFeature.get(
  "/",
  getQuestionsQueryValidator,
  async (c) => {
    const query = c.req.valid("query");
    return handleGetQuestions(c, query);
  },
);

communityForumQuestionFeature.get(
  "/:questionId",
  getQuestionParamsValidator,
  async (c) => {
    const params = c.req.valid("param");
    return handleGetQuestion(c, params);
  },
);

communityForumQuestionFeature.delete(
  "/:questionId",
  getQuestionParamsValidator,
  async (c) => {
    const params = c.req.valid("param");
    return handleGetQuestion(c, params);
  },
);

communityForumQuestionFeature.post("/", createQuestionValidator, async (c) => {
  const data = c.req.valid("json");
  return handleCreateQuestion(c, data);
});
