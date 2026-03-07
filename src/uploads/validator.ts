import { presignAvatarUploadSchema } from "./schema";
import { createJsonSchemaValidator } from "../utils/create-json-schema-validator";

export const presignAvatarUploadValidator = createJsonSchemaValidator(
  presignAvatarUploadSchema,
);
