import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { streamSSE } from "hono/streaming";
import type { AppBindings } from "../../lib/types";
import {
  requireAccessToken,
  requireAdmin,
} from "../../middlewares/auth.middleware";
import { getAuthUserId } from "../auth/utils/get-auth";
import { notificationEmitter } from "./notifications.query";
import { authProtectedErrorResponseSchema } from "../auth/auth.schema";
import {
  broadcastSchema,
  listNotificationsQuerySchema,
  markAllReadQuerySchema,
  markReadSchema,
  registerTokenSchema,
  sendToUserSchema,
  unregisterTokenSchema,
} from "./schema/notifications.request.schema";
import {
  errorResponseSchema,
  listNotificationsResponseSchema,
  sendResponseSchema,
  tokenResponseSchema,
} from "./schema/notifications.response.schema";
import {
  handleBroadcast,
  handleListNotifications,
  handleMarkAllRead,
  handleMarkRead,
  handleRegisterToken,
  handleSendToUser,
  handleUnregisterToken,
} from "./notifications.service";

export const notificationsRouter = new OpenAPIHono<AppBindings>();

const registerTokenRoute = createRoute({
  method: "post",
  path: "/tokens",
  tags: ["Notifications"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: registerTokenSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Token registered",
      content: { "application/json": { schema: tokenResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": { schema: authProtectedErrorResponseSchema },
      },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

notificationsRouter.openapi(registerTokenRoute, async (c) => {
  const payload = c.req.valid("json");
  return (await handleRegisterToken(c, payload)) as any;
});

const unregisterTokenRoute = createRoute({
  method: "delete",
  path: "/tokens",
  tags: ["Notifications"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: unregisterTokenSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Token unregistered",
      content: { "application/json": { schema: tokenResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": { schema: authProtectedErrorResponseSchema },
      },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

notificationsRouter.openapi(unregisterTokenRoute, async (c) => {
  const payload = c.req.valid("json");
  return (await handleUnregisterToken(c, payload)) as any;
});

const sendToUserRoute = createRoute({
  method: "post",
  path: "/send/user",
  tags: ["Notifications"],
  middleware: [requireAdmin],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: sendToUserSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Notification sent",
      content: { "application/json": { schema: sendResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": { schema: authProtectedErrorResponseSchema },
      },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

notificationsRouter.openapi(sendToUserRoute, async (c) => {
  const payload = c.req.valid("json");
  return (await handleSendToUser(c, payload)) as any;
});

const broadcastRoute = createRoute({
  method: "post",
  path: "/broadcast",
  tags: ["Notifications"],
  middleware: [requireAdmin],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: broadcastSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Broadcast sent",
      content: { "application/json": { schema: sendResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": { schema: authProtectedErrorResponseSchema },
      },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

notificationsRouter.openapi(broadcastRoute, async (c) => {
  const payload = c.req.valid("json");
  return (await handleBroadcast(c, payload)) as any;
});

const listNotificationsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Notifications"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    query: listNotificationsQuerySchema,
  },
  responses: {
    200: {
      description: "User notification inbox",
      content: {
        "application/json": { schema: listNotificationsResponseSchema },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": { schema: authProtectedErrorResponseSchema },
      },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

notificationsRouter.openapi(listNotificationsRoute, async (c) => {
  const query = c.req.valid("query");
  return (await handleListNotifications(c, query)) as any;
});

const markReadRoute = createRoute({
  method: "patch",
  path: "/read",
  tags: ["Notifications"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: markReadSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Notifications marked as read",
      content: { "application/json": { schema: tokenResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": { schema: authProtectedErrorResponseSchema },
      },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

notificationsRouter.openapi(markReadRoute, async (c) => {
  const payload = c.req.valid("json");
  return (await handleMarkRead(c, payload)) as any;
});

const markAllReadRoute = createRoute({
  method: "patch",
  path: "/read/all",
  tags: ["Notifications"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    query: markAllReadQuerySchema,
  },
  responses: {
    200: {
      description: "All notifications marked as read",
      content: { "application/json": { schema: tokenResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": { schema: authProtectedErrorResponseSchema },
      },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

notificationsRouter.openapi(markAllReadRoute, async (c) => {
  const query = c.req.valid("query");
  return (await handleMarkAllRead(c, query)) as any;
});

notificationsRouter.get("/stream", requireAccessToken, (c) => {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  return streamSSE(c, async (stream) => {
    const listener = (data: object) => {
      stream
        .writeSSE({ event: "notification", data: JSON.stringify(data) })
        .catch(() => {});
    };

    notificationEmitter.on(`notify:${userId}`, listener);

    try {
      while (!stream.aborted) {
        await stream.sleep(30_000);
        await stream.writeSSE({ event: "ping", data: "" });
      }
    } finally {
      notificationEmitter.off(`notify:${userId}`, listener);
    }
  });
});
