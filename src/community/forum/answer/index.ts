import { Hono } from "hono";
import { requireAccessToken } from "../../../auth/middleware";
import {
  handleCreateAnswer,
  handleDeleteAnswer,
  handleEditAnswer,
  handleGetAnswers,
  handleVoteAnswer,
} from "./handler";
import {
  answerIdParamsValidator,
  createAnswerValidator,
  questionIdParamsValidator,
  updateAnswerValidator,
  voteAnswerValidator,
} from "./validator";

export const communityForumAnswerFeature = new Hono();

communityForumAnswerFeature.use("*", requireAccessToken);

communityForumAnswerFeature.get(
  "/get-answers/:questionId",
  questionIdParamsValidator,
  async (c) => {
    const params = c.req.valid("param");
    return handleGetAnswers(c, params);
  },
);

communityForumAnswerFeature.post("/create-answer", createAnswerValidator, async (c) => {
  const data = c.req.valid("json");
  return handleCreateAnswer(c, data);
});

communityForumAnswerFeature.patch(
  "/edit-answer/:answerId",
  answerIdParamsValidator,
  updateAnswerValidator,
  async (c) => {
    const params = c.req.valid("param");
    const data = c.req.valid("json");
    return handleEditAnswer(c, params, data);
  },
);

communityForumAnswerFeature.delete(
  "/delete-answer/:answerId",
  answerIdParamsValidator,
  async (c) => {
    const params = c.req.valid("param");
    return handleDeleteAnswer(c, params);
  },
);

communityForumAnswerFeature.post(
  "/vote-answer/:answerId",
  answerIdParamsValidator,
  voteAnswerValidator,
  async (c) => {
    const params = c.req.valid("param");
    const data = c.req.valid("json");
    return handleVoteAnswer(c, params, data);
  },
);
