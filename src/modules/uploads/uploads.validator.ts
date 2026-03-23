import { presignAvatarUploadSchema } from "./uploads.schema";
import { createJsonSchemaValidator } from "../../utils/create-json-schema-validator";

export const presignAvatarUploadValidator = createJsonSchemaValidator(
  presignAvatarUploadSchema,
);
