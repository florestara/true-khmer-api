import { Hono } from "hono";
import {
  handleCreateQuestion,
  handleDeleteQuestion,
  handleGetQuestion,
  handleGetQuestions,
  handleVoteQuestion,
} from "./handler";
import { requireAccessToken } from "../../../auth/middleware";
import {
  createQuestionValidator,
  getQuestionParamsValidator,
  getQuestionsQueryValidator,
  voteQuestionValidator,
} from "./validator";

export const communityForumQuestionFeature = new Hono();

communityForumQuestionFeature.use("*", requireAccessToken);

communityForumQuestionFeature.get(
  "/",
  getQuestionsQueryValidator,
  async (c) => {
    const query = c.req.valid("query");
    return handleGetQuestions(c, query);
  }
);

communityForumQuestionFeature.get(
  "/:questionId",
  getQuestionParamsValidator,
  async (c) => {
    const params = c.req.valid("param");
    return handleGetQuestion(c, params);
  }
);

communityForumQuestionFeature.post(
  "/",
  createQuestionValidator,
  async (c) => {
    const data = c.req.valid("json");
    return handleCreateQuestion(c, data);
  }
);

communityForumQuestionFeature.delete(
  "/delete-question/:questionId",
  getQuestionParamsValidator,
  async (c) => {
    const params = c.req.valid("param");
    return handleDeleteQuestion(c, params);
  },
);

communityForumQuestionFeature.post(
  "/vote-question/:questionId",
  getQuestionParamsValidator,
  voteQuestionValidator,
  async (c) => {
    const params = c.req.valid("param");
    const data = c.req.valid("json");
    return handleVoteQuestion(c, params, data);
  },
);
