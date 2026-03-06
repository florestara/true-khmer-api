import { Hono } from "hono";
import { requireAccessTokenAllowIncompleteOnboarding } from "../auth/middleware";
import { handlePresignAvatarUpload } from "./handler";
import { presignAvatarUploadValidator } from "./validator";

const uploadRoute = new Hono();

uploadRoute.use("*", requireAccessTokenAllowIncompleteOnboarding);
uploadRoute.post("/avatar/presign", presignAvatarUploadValidator, async (c) => {
  const payload = c.req.valid("json");
  return handlePresignAvatarUpload(c, payload);
});

export default uploadRoute;
