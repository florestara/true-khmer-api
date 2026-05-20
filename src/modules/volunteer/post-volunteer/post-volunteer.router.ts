import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppBindings } from "../../../lib/types";
import {
  requireAdmin,
  requireAccessToken,
} from "../../../middlewares/auth.middleware";
import { authProtectedErrorResponseSchema } from "../../auth/auth.schema";
import {
  createVolunteerApplicationBatchResponseSchema,
  createVolunteerApplicationResponseSchema,
  createVolunteerApplicationBatchSchema,
  createVolunteerApplicationSchema,
  createVolunteerCategoryResponseSchema,
  createVolunteerCategorySchema,
  createVolunteerOpportunitySchema,
  createVolunteerOpportunityResponseSchema,
  getVolunteerCategoriesResponseSchema,
  getVolunteerLocationsResponseSchema,
  getVolunteerOpportunityParamsSchema,
  getVolunteerOpportunityResponseSchema,
  getVolunteerOpportunitiesResponseSchema,
  getVolunteerOpportunitiesQuerySchema,
  getSavedVolunteerOpportunitiesQuerySchema,
  presignVolunteerApplicationDocumentUploadResponseSchema,
  presignVolunteerApplicationDocumentUploadSchema,
  presignVolunteerOpportunityCoverUploadResponseSchema,
  presignVolunteerOpportunityCoverUploadSchema,
  saveVolunteerOpportunityResponseSchema,
  updateVolunteerOpportunitySchema,
  volunteerCategoryValidationErrorResponseSchema,
  volunteerOperationErrorResponseSchema,
  volunteerValidationErrorResponseSchema,
} from "./post-volunteer.schema";
import {
  handleCreateVolunteerApplication,
  handleCreateVolunteerApplicationBatch,
  handleCreateVolunteerCategory,
  handleCreateVolunteerOpportunity,
  handleGetSavedVolunteerOpportunities,
  handleGetVolunteerCategories,
  handleGetVolunteerLocations,
  handleGetVolunteerOpportunity,
  handleGetVolunteerOpportunities,
  handlePresignVolunteerApplicationDocumentUpload,
  handlePresignVolunteerOpportunityCoverUpload,
  handleSaveVolunteerOpportunity,
  handleUnsaveVolunteerOpportunity,
  handleUpdateVolunteerOpportunity,
} from "./post-volunteer.service";

export const postVolunteerRouter = new OpenAPIHono<AppBindings>();

const getVolunteerCategoriesRoute = createRoute({
  method: "get",
  path: "/categories",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of volunteer categories",
      content: {
        "application/json": {
          schema: getVolunteerCategoriesResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const createVolunteerCategoryRoute = createRoute({
  method: "post",
  path: "/categories",
  tags: ["Volunteer Post"],
  middleware: [requireAdmin],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createVolunteerCategorySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Volunteer category created",
      content: {
        "application/json": {
          schema: createVolunteerCategoryResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerCategoryValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Category already exists",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const getVolunteerLocationsRoute = createRoute({
  method: "get",
  path: "/locations",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of volunteer locations in Cambodia",
      content: {
        "application/json": {
          schema: getVolunteerLocationsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const presignVolunteerOpportunityCoverUploadRoute = createRoute({
  method: "post",
  path: "/opportunities/cover-image/presign",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: presignVolunteerOpportunityCoverUploadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Presigned volunteer cover upload URL generated",
      content: {
        "application/json": {
          schema: presignVolunteerOpportunityCoverUploadResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const presignVolunteerApplicationDocumentUploadRoute = createRoute({
  method: "post",
  path: "/applications/document/presign",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: presignVolunteerApplicationDocumentUploadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Presigned volunteer application document upload URL generated",
      content: {
        "application/json": {
          schema: presignVolunteerApplicationDocumentUploadResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Volunteer opportunity not found",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Volunteer application already exists",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const getVolunteerOpportunitiesRoute = createRoute({
  method: "get",
  path: "/opportunities",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    query: getVolunteerOpportunitiesQuerySchema,
  },
  responses: {
    200: {
      description: "List of volunteer opportunities",
      content: {
        "application/json": {
          schema: getVolunteerOpportunitiesResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Related volunteer records were not found",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const getSavedVolunteerOpportunitiesRoute = createRoute({
  method: "get",
  path: "/saved",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    query: getSavedVolunteerOpportunitiesQuerySchema,
  },
  responses: {
    200: {
      description:
        "List of volunteer opportunities saved by the authenticated user",
      content: {
        "application/json": {
          schema: getVolunteerOpportunitiesResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const getVolunteerOpportunityRoute = createRoute({
  method: "get",
  path: "/opportunities/{opportunityId}",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getVolunteerOpportunityParamsSchema,
  },
  responses: {
    200: {
      description: "Volunteer opportunity details",
      content: {
        "application/json": {
          schema: getVolunteerOpportunityResponseSchema,
        },
      },
    },
    400: {
      description: "Bad Request - invalid opportunityId",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Volunteer opportunity not found",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const saveVolunteerOpportunityRoute = createRoute({
  method: "post",
  path: "/save-opportunity/{opportunityId}",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getVolunteerOpportunityParamsSchema,
  },
  responses: {
    200: {
      description: "Volunteer opportunity saved",
      content: {
        "application/json": {
          schema: saveVolunteerOpportunityResponseSchema,
        },
      },
    },
    400: {
      description: "Bad Request - invalid opportunityId",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Volunteer opportunity not found",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const unsaveVolunteerOpportunityRoute = createRoute({
  method: "delete",
  path: "/save-opportunity/{opportunityId}",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getVolunteerOpportunityParamsSchema,
  },
  responses: {
    200: {
      description: "Volunteer opportunity unsaved",
      content: {
        "application/json": {
          schema: saveVolunteerOpportunityResponseSchema,
        },
      },
    },
    400: {
      description: "Bad Request - invalid opportunityId",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Volunteer opportunity not found",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const createVolunteerOpportunityRoute = createRoute({
  method: "post",
  path: "/opportunities",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createVolunteerOpportunitySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Volunteer opportunity created",
      content: {
        "application/json": {
          schema: createVolunteerOpportunityResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Related volunteer records were not found",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const updateVolunteerOpportunityRoute = createRoute({
  method: "patch",
  path: "/opportunities/{opportunityId}",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    params: getVolunteerOpportunityParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: updateVolunteerOpportunitySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Volunteer opportunity updated",
      content: {
        "application/json": {
          schema: createVolunteerOpportunityResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Volunteer opportunity or related record not found",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Volunteer opportunity edit conflict",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const createVolunteerApplicationRoute = createRoute({
  method: "post",
  path: "/applications",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createVolunteerApplicationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Volunteer application submitted",
      content: {
        "application/json": {
          schema: createVolunteerApplicationResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Volunteer role not found",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Duplicate volunteer application",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

const createVolunteerApplicationBatchRoute = createRoute({
  method: "post",
  path: "/applications/batch",
  tags: ["Volunteer Post"],
  middleware: [requireAccessToken],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createVolunteerApplicationBatchSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Volunteer applications submitted",
      content: {
        "application/json": {
          schema: createVolunteerApplicationBatchResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: {
        "application/json": {
          schema: volunteerValidationErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: authProtectedErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Volunteer role not found",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Duplicate volunteer application",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: volunteerOperationErrorResponseSchema,
        },
      },
    },
  },
});

postVolunteerRouter.openapi(getVolunteerCategoriesRoute, async (c) => {
  return handleGetVolunteerCategories(c) as any;
});

postVolunteerRouter.openapi(createVolunteerCategoryRoute, async (c) => {
  const data = c.req.valid("json");
  return handleCreateVolunteerCategory(c, data) as any;
});

postVolunteerRouter.openapi(getVolunteerLocationsRoute, async (c) => {
  return handleGetVolunteerLocations(c) as any;
});

postVolunteerRouter.openapi(
  presignVolunteerOpportunityCoverUploadRoute,
  async (c) => {
    const data = c.req.valid("json");
    return handlePresignVolunteerOpportunityCoverUpload(c, data) as any;
  },
);

postVolunteerRouter.openapi(
  presignVolunteerApplicationDocumentUploadRoute,
  async (c) => {
    const data = c.req.valid("json");
    return handlePresignVolunteerApplicationDocumentUpload(c, data) as any;
  },
);

postVolunteerRouter.openapi(getVolunteerOpportunitiesRoute, async (c) => {
  const query = c.req.valid("query");
  return handleGetVolunteerOpportunities(c, query) as any;
});

postVolunteerRouter.openapi(getSavedVolunteerOpportunitiesRoute, async (c) => {
  const query = c.req.valid("query");
  return handleGetSavedVolunteerOpportunities(c, query) as any;
});

postVolunteerRouter.openapi(getVolunteerOpportunityRoute, async (c) => {
  const params = c.req.valid("param");
  return handleGetVolunteerOpportunity(c, params) as any;
});

postVolunteerRouter.openapi(saveVolunteerOpportunityRoute, async (c) => {
  const params = c.req.valid("param");
  return handleSaveVolunteerOpportunity(c, params) as any;
});

postVolunteerRouter.openapi(unsaveVolunteerOpportunityRoute, async (c) => {
  const params = c.req.valid("param");
  return handleUnsaveVolunteerOpportunity(c, params) as any;
});

postVolunteerRouter.openapi(createVolunteerOpportunityRoute, async (c) => {
  const data = c.req.valid("json");
  return handleCreateVolunteerOpportunity(c, data) as any;
});

postVolunteerRouter.openapi(updateVolunteerOpportunityRoute, async (c) => {
  const params = c.req.valid("param");
  const data = c.req.valid("json");
  return handleUpdateVolunteerOpportunity(c, params, data) as any;
});

postVolunteerRouter.openapi(createVolunteerApplicationRoute, async (c) => {
  const data = c.req.valid("json");
  return handleCreateVolunteerApplication(c, data) as any;
});

postVolunteerRouter.openapi(createVolunteerApplicationBatchRoute, async (c) => {
  const data = c.req.valid("json");
  return handleCreateVolunteerApplicationBatch(c, data) as any;
});
