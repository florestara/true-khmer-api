import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../lib/types";
import { requireAccessTokenAllowIncompleteOnboarding } from "../../middlewares/auth.middleware";
import { handlePresignAvatarUpload } from "./uploads.service";
import {
  presignAvatarUploadResponseSchema,
  presignAvatarUploadSchema,
} from "./uploads.schema";

export const uploadsRouter = new OpenAPIHono<AppBindings>();

const presignRoute = createRoute({
  method: "post",
  path: "/avatar/presign",
  tags: ["Uploads"],
  middleware: [requireAccessTokenAllowIncompleteOnboarding],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: presignAvatarUploadSchema } },
    },
  },
  responses: {
    200: {
      description: "Presigned upload URL generated",
      content: {
        "application/json": {
          schema: presignAvatarUploadResponseSchema,
        },
      },
    },
    400: { description: "Invalid parameters" },
    500: { description: "Internal server error" },
  },
});

uploadsRouter.openapi(presignRoute, (c) => {
  const payload = c.req.valid("json");
  return handlePresignAvatarUpload(c, payload);
});
