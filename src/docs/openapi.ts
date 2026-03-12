const defaultBaseUrl =
  process.env.DEFAULT_BASE_URL?.trim() ||
  `http://localhost:${process.env.PORT ?? "3000"}`;

export const openApiDoc = {
  openapi: "3.0.3",
  info: {
    title: "TrueKhmer API",
    version: "1.0.0",
    description: "API documentation for True Khmer.",
  },
  servers: [{ url: defaultBaseUrl }],
  tags: [
    { name: "System" },
    { name: "Auth" },
    { name: "Forum Category" },
    { name: "Forum Question" },
    { name: "Onboarding" },
    { name: "Uploads" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      HealthCheckResponse: {
        type: "object",
        required: ["message", "version"],
        properties: {
          message: { type: "string", example: "TrueKhmer API is running 🚀" },
          version: { type: "string", example: "1.0.0" },
        },
      },
      OpenApiDocumentResponse: {
        type: "object",
        description: "OpenAPI document object.",
        additionalProperties: true,
      },
      InvalidJsonBodyErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "string", example: "Invalid JSON body" },
        },
      },
      SimpleErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "string", example: "Unauthorized" },
        },
      },
      InternalServerErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "string",
            enum: ["Internal Server Error"],
            example: "Internal Server Error",
          },
        },
      },
      OkFalseErrorResponse: {
        type: "object",
        required: ["ok", "error"],
        properties: {
          ok: { type: "boolean", enum: [false], example: false },
          error: { type: "string", example: "Validation failed" },
        },
      },
      OkFalseValidationIssuesResponse: {
        type: "object",
        required: ["ok", "error", "issues"],
        properties: {
          ok: { type: "boolean", enum: [false], example: false },
          error: { type: "string", enum: ["Validation failed"], example: "Validation failed" },
          issues: {
            type: "array",
            items: { type: "string" },
            example: ["name is required and must be 1..120 characters"],
          },
        },
      },
      OnboardingRequiredErrorResponse: {
        type: "object",
        required: ["error", "code"],
        properties: {
          error: { type: "string", enum: ["Onboarding required"], example: "Onboarding required" },
          code: { type: "string", enum: ["ONBOARDING_REQUIRED"], example: "ONBOARDING_REQUIRED" },
        },
      },
      AuthValidationErrorResponse: {
        type: "object",
        required: ["error", "message"],
        properties: {
          error: { type: "string", enum: ["Validation failed"], example: "Validation failed" },
          message: { type: "string", example: "email must be a valid email" },
          fieldErrors: {
            type: "object",
            additionalProperties: { type: "string" },
            example: {
              email: "email must be a valid email",
            },
          },
        },
      },
      AuthProviderErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "string", example: "Login failed" },
          details: {
            type: "object",
            nullable: true,
            additionalProperties: true,
          },
        },
      },
      AuthUser: {
        type: "object",
        required: ["id", "email", "emailVerified", "name", "createdAt", "updatedAt"],
        additionalProperties: true,
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          emailVerified: { type: "boolean", example: false },
          name: { type: "string", example: "Socheata Mean" },
          image: { type: "string", nullable: true, format: "uri" },
          firstName: { type: "string", example: "Socheata" },
          lastName: { type: "string", example: "Mean" },
          gender: { type: "string", enum: ["male", "female", "other"], example: "female" },
          occupation: { type: "string", example: "Strategist" },
          role: { type: "string", example: "user" },
          onboardingStep: { type: "integer", example: 0 },
          onboardingCompletedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AuthTokenResponse: {
        type: "object",
        required: ["accessToken", "refreshToken", "user"],
        properties: {
          accessToken: { type: "string", minLength: 1 },
          refreshToken: { type: "string", minLength: 1 },
          user: { $ref: "#/components/schemas/AuthUser" },
        },
      },
      RegisterSuccessResponse: {
        type: "object",
        required: ["success", "message", "otpSent", "user"],
        properties: {
          success: { type: "boolean", enum: [true], example: true },
          message: {
            type: "string",
            example: "Registration successful. OTP code sent to email.",
          },
          otpSent: { type: "boolean", example: true },
          user: { $ref: "#/components/schemas/AuthUser" },
        },
      },
      ResendRegisterOtpResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", enum: [true], example: true },
          message: {
            type: "string",
            example: "If this email is eligible, we sent an OTP code. Please check your inbox.",
          },
        },
      },
      LoginEmailNotVerifiedResponse: {
        type: "object",
        required: ["error", "code", "otpSent", "message"],
        properties: {
          error: { type: "string", enum: ["Email not verified"], example: "Email not verified" },
          code: { type: "string", enum: ["EMAIL_NOT_VERIFIED"], example: "EMAIL_NOT_VERIFIED" },
          otpSent: { type: "boolean", example: true },
          message: {
            type: "string",
            example: "OTP sent. Please use it to verify your email.",
          },
        },
      },
      RefreshSuccessResponse: {
        type: "object",
        required: ["accessToken", "refreshToken"],
        properties: {
          accessToken: { type: "string", minLength: 1 },
          refreshToken: { type: "string", minLength: 1 },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["firstName", "lastName", "gender", "occupation", "email", "password"],
        properties: {
          firstName: {
            type: "string",
            minLength: 2,
            maxLength: 100,
            // This pattern uses Unicode property escapes (\\p{L} and \\p{M}) to match letters and combining marks, allowing international names.
            pattern: "^[\\p{L}\\p{M}]+(?:[\\s'-][\\p{L}\\p{M}]+)*$",
            example: "Socheata",
          },
          lastName: {
            type: "string",
            minLength: 2,
            maxLength: 100,
            pattern: "^[\\p{L}\\p{M}]+(?:[\\s'-][\\p{L}\\p{M}]+)*$",
            example: "Mean",
          },
          gender: { type: "string", enum: ["male", "female", "other"], example: "female" },
          occupation: { type: "string", minLength: 1, maxLength: 120, example: "Strategist" },
          email: { type: "string", format: "email", example: "user@example.com" },
          password: {
            // Password must be at least 8 characters long, contain no whitespace,
            // include at least one lowercase letter, one uppercase letter, and one special character.
            type: "string",
            minLength: 8,
            pattern: "^(?=\\S+$)(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9\\s]).{8,}$",
            example: "StrongP@ssw0rd",
          },
        },
      },
      VerifyOtpRequest: {
        type: "object",
        required: ["email", "otp"],
        properties: {
          email: { type: "string", format: "email", example: "user@example.com" },
          otp: { type: "string", minLength: 6, maxLength: 6, example: "123456" },
        },
      },
      ResendOtpRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", example: "user@example.com" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "user@example.com" },
          password: { type: "string", minLength: 1, example: "StrongP@ssw0rd" },
        },
      },
      RefreshRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: { type: "string", minLength: 1, example: "refresh_token_here" },
        },
      },
      CreateCategoryRequest: {
        type: "object",
        required: ["name", "slug"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120, example: "General" },
          slug: { type: "string", minLength: 1, maxLength: 255, example: "general" },
          description: {
            type: "string",
            maxLength: 1000,
            nullable: true,
            example: "General discussion topics.",
          },
        },
      },
      ForumCategory: {
        type: "object",
        required: [
          "id",
          "name",
          "slug",
          "description",
          "displayOrder",
          "status",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt",
          "archivedAt",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", maxLength: 255 },
          slug: { type: "string", maxLength: 255 },
          description: { type: "string", nullable: true },
          displayOrder: { type: "integer", example: 0 },
          status: { type: "string", enum: ["ACTIVE", "ARCHIVED", "HIDDEN"], example: "ACTIVE" },
          createdBy: { type: "string", format: "uuid" },
          updatedBy: { type: "string", format: "uuid", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          archivedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      CreateCategorySuccessResponse: {
        type: "object",
        required: ["ok", "category"],
        properties: {
          ok: { type: "boolean", enum: [true], example: true },
          category: { $ref: "#/components/schemas/ForumCategory" },
        },
      },
      CreateQuestionRequest: {
        type: "object",
        required: ["categoryId", "title", "body"],
        properties: {
          categoryId: {
            type: "string",
            format: "uuid",
            example: "f28e0170-a5b2-4e69-b4f8-e9dc450ab322",
          },
          title: {
            type: "string",
            minLength: 1,
            maxLength: 300,
            example: "How can I start learning Khmer effectively?",
          },
          body: {
            type: "string",
            minLength: 1,
            maxLength: 10000,
            example: "I can read basic script but I struggle with listening and speaking.",
          },
          tags: {
            oneOf: [
              {
                type: "array",
                maxItems: 5,
                items: { type: "string", minLength: 1, maxLength: 30 },
              },
              {
                type: "string",
                description: "Comma-separated tags; max 5 tags.",
                example: "khmer,language,learning",
              },
            ],
          },
          status: {
            type: "string",
            enum: ["PUBLISHED"],
            example: "PUBLISHED",
          },
        },
      },
      ForumQuestion: {
        type: "object",
        required: [
          "id",
          "categoryId",
          "authorId",
          "title",
          "body",
          "status",
          "answerCount",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          categoryId: { type: "string", format: "uuid" },
          authorId: { type: "string", format: "uuid" },
          title: { type: "string", maxLength: 300 },
          body: { type: "string" },
          status: { type: "string", enum: ["PUBLISHED", "CLOSED", "DELETED"], example: "PUBLISHED" },
          answerCount: { type: "integer", example: 0 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateQuestionSuccessResponse: {
        type: "object",
        required: ["ok", "question"],
        properties: {
          ok: { type: "boolean", enum: [true], example: true },
          question: { $ref: "#/components/schemas/ForumQuestionWithTags" },
        },
      },
      ForumQuestionWithTags: {
        allOf: [
          { $ref: "#/components/schemas/ForumQuestion" },
          {
            type: "object",
            required: ["tags"],
            properties: {
              tags: {
                type: "array",
                items: { type: "string" },
                example: ["khmer", "language", "learning"],
              },
            },
          },
        ],
      },
      GetQuestionSuccessResponse: {
        type: "object",
        required: ["ok", "question"],
        properties: {
          ok: { type: "boolean", enum: [true], example: true },
          question: { $ref: "#/components/schemas/ForumQuestionWithTags" },
        },
      },
      GetQuestionsSuccessResponse: {
        type: "object",
        required: ["ok", "questions"],
        properties: {
          ok: { type: "boolean", enum: [true], example: true },
          questions: {
            type: "array",
            items: { $ref: "#/components/schemas/ForumQuestionWithTags" },
          },
        },
      },
      GetQuestionsPageSuccessResponse: {
        type: "object",
        required: ["ok", "questions", "pagination"],
        properties: {
          ok: { type: "boolean", enum: [true], example: true },
          questions: {
            type: "array",
            items: { $ref: "#/components/schemas/ForumQuestionWithTags" },
          },
          pagination: {
            type: "object",
            required: ["limit", "hasMore", "nextCursor"],
            properties: {
              limit: { type: "integer", minimum: 1, maximum: 50, example: 10 },
              hasMore: { type: "boolean", example: true },
              nextCursor: {
                type: "string",
                nullable: true,
                description:
                  "Opaque cursor for the next page. Pass it back as `cursor` query param.",
                example:
                  "eyJjcmVhdGVkQXQiOiIyMDI2LTAzLTEyVDEwOjAyOjAwLjAwMFoiLCJpZCI6IjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMSJ9",
              },
            },
          },
        },
      },
      OnboardingProfileStepRequest: {
        type: "object",
        required: ["countryId", "cityId"],
        properties: {
          bio: { type: "string", maxLength: 1000 },
          countryId: { type: "string", format: "uuid", example: "ff135e82-26a5-4117-b1bf-9f1ef54d1ee8" },
          cityId: { type: "string", format: "uuid", example: "2d8b8b6a-e172-4bd7-8b2f-cf5beac0f95f" },
          avatarKey: { type: "string", minLength: 1, maxLength: 600, example: "avatars/user-1.png" },
        },
      },
      OnboardingInterestsStepRequest: {
        type: "object",
        required: ["interestIds"],
        properties: {
          interestIds: {
            type: "array",
            minItems: 2,
            maxItems: 20,
            items: { type: "string", format: "uuid" },
          },
        },
      },
      OnboardingContributionsStepRequest: {
        type: "object",
        minProperties: 1,
        description:
          "Each contribution field is optional, but at least one selected field must be true.",
        properties: {
          community_member: { type: "boolean", example: true },
          find_volunteers: { type: "boolean", example: false },
          launch_project: { type: "boolean", example: true },
          organize_event: { type: "boolean", example: false },
        },
        additionalProperties: false,
      },
      OnboardingProfile: {
        type: "object",
        required: [
          "id",
          "userId",
          "displayName",
          "avatarKey",
          "avatarUrl",
          "bio",
          "countryId",
          "cityId",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          displayName: { type: "string", nullable: true },
          avatarKey: { type: "string", nullable: true },
          avatarUrl: { type: "string", nullable: true, format: "uri" },
          bio: { type: "string", nullable: true },
          countryId: { type: "string", nullable: true, format: "uuid" },
          cityId: { type: "string", nullable: true, format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      OnboardingTier: {
        type: "object",
        required: ["id", "slug", "name", "rankOrder", "minPoints"],
        properties: {
          id: { type: "string", format: "uuid" },
          slug: { type: "string", example: "bronze" },
          name: { type: "string", example: "Bronze" },
          rankOrder: { type: "integer", example: 1 },
          minPoints: { type: "integer", example: 0 },
        },
      },
      OnboardingStateResponse: {
        type: "object",
        required: ["ok", "state"],
        properties: {
          ok: { type: "boolean", enum: [true], example: true },
          state: {
            type: "object",
            required: [
              "user",
              "profile",
              "selectedInterestIds",
              "selectedContributionKeys",
              "progress",
            ],
            properties: {
              user: {
                type: "object",
                required: ["id", "email", "role", "onboardingStep", "onboardingCompletedAt"],
                properties: {
                  id: { type: "string", format: "uuid" },
                  email: { type: "string", format: "email" },
                  role: { type: "string", example: "user" },
                  onboardingStep: { type: "integer", example: 2 },
                  onboardingCompletedAt: {
                    type: "string",
                    nullable: true,
                    format: "date-time",
                  },
                },
              },
              profile: {
                allOf: [{ $ref: "#/components/schemas/OnboardingProfile" }],
                nullable: true,
              },
              selectedInterestIds: {
                type: "array",
                items: { type: "string", format: "uuid" },
              },
              selectedContributionKeys: {
                type: "array",
                items: {
                  type: "string",
                  enum: [
                    "community_member",
                    "find_volunteers",
                    "launch_project",
                    "organize_event",
                  ],
                },
              },
              progress: {
                type: "object",
                required: ["totalPoints", "tier"],
                properties: {
                  totalPoints: { type: "integer", example: 0 },
                  tier: {
                    allOf: [{ $ref: "#/components/schemas/OnboardingTier" }],
                    nullable: true,
                  },
                },
              },
            },
          },
        },
      },
      OnboardingOptionsResponse: {
        type: "object",
        required: ["ok", "options"],
        properties: {
          ok: { type: "boolean", example: true },
          options: {
            type: "object",
            required: ["interests", "contributions", "tiers"],
            properties: {
              interests: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "slug", "label", "icon"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    slug: { type: "string", example: "technology" },
                    label: { type: "string", example: "Technology" },
                    icon: { type: "string", example: "💻" },
                  },
                },
              },
              contributions: {
                type: "array",
                items: {
                  type: "object",
                  required: ["key"],
                  properties: {
                    key: {
                      type: "string",
                      enum: [
                        "community_member",
                        "find_volunteers",
                        "launch_project",
                        "organize_event",
                      ],
                    },
                  },
                },
              },
              tiers: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "slug", "name", "rankOrder", "minPoints", "description"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    slug: { type: "string", example: "bronze" },
                    name: { type: "string", example: "Bronze" },
                    rankOrder: { type: "integer", example: 1 },
                    minPoints: { type: "integer", example: 0 },
                    description: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
      OnboardingInterestsResponse: {
        type: "object",
        required: ["ok", "interests"],
        properties: {
          ok: { type: "boolean", example: true },
          interests: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "slug", "label", "icon"],
              properties: {
                id: { type: "string", format: "uuid" },
                slug: { type: "string", example: "technology" },
                label: { type: "string", example: "Technology" },
                icon: { type: "string", example: "💻" },
              },
            },
          },
        },
      },
      OnboardingContributionsResponse: {
        type: "object",
        required: ["ok", "contributions"],
        properties: {
          ok: { type: "boolean", example: true },
          contributions: {
            type: "array",
            items: {
              type: "object",
              required: ["key"],
              properties: {
                key: {
                  type: "string",
                  enum: [
                    "community_member",
                    "find_volunteers",
                    "launch_project",
                    "organize_event",
                  ],
                },
              },
            },
          },
        },
      },
      CountryListResponse: {
        type: "object",
        required: ["ok", "countries"],
        properties: {
          ok: { type: "boolean", example: true },
          countries: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "name", "iso2"],
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string", example: "Cambodia" },
                iso2: { type: "string", nullable: true, example: "KH" },
              },
            },
          },
        },
      },
      CityListResponse: {
        type: "object",
        required: ["ok", "cities"],
        properties: {
          ok: { type: "boolean", example: true },
          cities: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "countryId", "name"],
              properties: {
                id: { type: "string", format: "uuid" },
                countryId: { type: "string", format: "uuid" },
                name: { type: "string", example: "Phnom Penh" },
              },
            },
          },
        },
      },
      PresignAvatarUploadRequest: {
        type: "object",
        required: ["fileName", "contentType", "fileSize"],
        properties: {
          fileName: {
            // This pattern restricts file names to alphanumeric characters, dots, underscores, and hyphens for security purposes.
            type: "string",
            minLength: 1,
            maxLength: 120,
            pattern: "^[A-Za-z0-9._-]+$",
            example: "avatar.png",
          },
          contentType: {
            type: "string",
            enum: ["image/jpeg", "image/png", "image/webp"],
            example: "image/png",
          },
          fileSize: {
            type: "integer",
            minimum: 1,
            maximum: 5242880,
            example: 245760,
          },
        },
      },
      PresignAvatarUploadResponse: {
        type: "object",
        required: ["ok", "upload"],
        properties: {
          ok: { type: "boolean", enum: [true], example: true },
          upload: {
            type: "object",
            required: [
              "uploadUrl",
              "method",
              "requiredHeaders",
              "avatarKey",
              "publicUrl",
              "expiresInSeconds",
            ],
            properties: {
              uploadUrl: { type: "string", format: "uri" },
              method: { type: "string", enum: ["PUT"], example: "PUT" },
              requiredHeaders: {
                type: "object",
                required: ["Content-Length", "Content-Type"],
                properties: {
                  "Content-Length": { type: "string", example: "245760" },
                  "Content-Type": { type: "string", example: "image/png" },
                },
              },
              avatarKey: { type: "string", example: "avatars/user-id/123-abc.png" },
              publicUrl: {
                type: "string",
                format: "uri",
                nullable: true,
              },
              expiresInSeconds: { type: "number", example: 600 },
            },
          },
        },
      },
    },
  },
  paths: {
    "/": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          "200": {
            description: "API is running",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthCheckResponse" },
              },
            },
          },
        },
      },
    },
    "/docs/openapi.json": {
      get: {
        tags: ["System"],
        summary: "Get OpenAPI JSON document",
        responses: {
          "200": {
            description: "OpenAPI JSON document",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OpenApiDocumentResponse" },
              },
            },
          },
        },
      },
    },
    "/docs": {
      get: {
        tags: ["System"],
        summary: "Swagger UI",
        responses: {
          "200": {
            description: "Swagger UI HTML page",
            content: {
              "text/html": {
                schema: { type: "string" },
              },
            },
          },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Registration successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegisterSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Invalid JSON body or validation failed",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/InvalidJsonBodyErrorResponse" },
                    { $ref: "#/components/schemas/AuthValidationErrorResponse" },
                    { $ref: "#/components/schemas/AuthProviderErrorResponse" },
                  ],
                },
              },
            },
          },
          "409": {
            description: "Registration conflict (for example, email already exists)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthProviderErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/AuthProviderErrorResponse" },
                    { $ref: "#/components/schemas/InternalServerErrorResponse" },
                  ],
                },
              },
            },
          },
          default: {
            description: "Authentication provider error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthProviderErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/register/verify-otp": {
      post: {
        tags: ["Auth"],
        summary: "Verify registration OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VerifyOtpRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OTP verified and tokens returned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthTokenResponse" },
              },
            },
          },
          "400": {
            description: "Invalid JSON body or validation failed",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/InvalidJsonBodyErrorResponse" },
                    { $ref: "#/components/schemas/AuthValidationErrorResponse" },
                    { $ref: "#/components/schemas/AuthProviderErrorResponse" },
                  ],
                },
              },
            },
          },
          "401": {
            description: "OTP invalid or expired",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthProviderErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/AuthProviderErrorResponse" },
                    { $ref: "#/components/schemas/InternalServerErrorResponse" },
                  ],
                },
              },
            },
          },
          default: {
            description: "Authentication provider error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthProviderErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/register/resend-otp": {
      post: {
        tags: ["Auth"],
        summary: "Resend registration OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ResendOtpRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Verification code sent if eligible",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ResendRegisterOtpResponse" },
              },
            },
          },
          "400": {
            description: "Invalid JSON body or validation failed",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/InvalidJsonBodyErrorResponse" },
                    { $ref: "#/components/schemas/AuthValidationErrorResponse" },
                  ],
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalServerErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful and tokens returned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthTokenResponse" },
              },
            },
          },
          "400": {
            description: "Invalid JSON body or validation failed",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/InvalidJsonBodyErrorResponse" },
                    { $ref: "#/components/schemas/AuthValidationErrorResponse" },
                    { $ref: "#/components/schemas/AuthProviderErrorResponse" },
                  ],
                },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthProviderErrorResponse" },
              },
            },
          },
          "403": {
            description: "Email not verified (OTP may be re-sent)",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/LoginEmailNotVerifiedResponse" },
                    { $ref: "#/components/schemas/AuthProviderErrorResponse" },
                  ],
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/AuthProviderErrorResponse" },
                    { $ref: "#/components/schemas/InternalServerErrorResponse" },
                  ],
                },
              },
            },
          },
          default: {
            description: "Authentication provider error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthProviderErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Access token refreshed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Invalid JSON body or validation failed",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/InvalidJsonBodyErrorResponse" },
                    { $ref: "#/components/schemas/AuthValidationErrorResponse" },
                    { $ref: "#/components/schemas/AuthProviderErrorResponse" },
                  ],
                },
              },
            },
          },
          "401": {
            description: "Invalid refresh token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthProviderErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/AuthProviderErrorResponse" },
                    { $ref: "#/components/schemas/InternalServerErrorResponse" },
                  ],
                },
              },
            },
          },
          "502": {
            description: "Auth provider returned a malformed success response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthProviderErrorResponse" },
              },
            },
          },
          default: {
            description: "Authentication provider error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthProviderErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/forum/category/create-category": {
      post: {
        tags: ["Forum Category"],
        summary: "Create category",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateCategoryRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Category created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateCategorySuccessResponse" },
              },
            },
          },
          "400": {
            description: "Validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseValidationIssuesResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "403": {
            description: "Admin role required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "409": {
            description: "Conflict (duplicate category name)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OkFalseErrorResponse" },
                    { $ref: "#/components/schemas/InternalServerErrorResponse" },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/api/forum/question/create-question": {
      post: {
        tags: ["Forum Question"],
        summary: "Create question",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateQuestionRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Question created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateQuestionSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Validation failed or invalid authenticated user id type",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OkFalseValidationIssuesResponse" },
                    { $ref: "#/components/schemas/OkFalseErrorResponse" },
                  ],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/SimpleErrorResponse" },
                    { $ref: "#/components/schemas/OkFalseErrorResponse" },
                  ],
                },
              },
            },
          },
          "403": {
            description: "Onboarding required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingRequiredErrorResponse" },
              },
            },
          },
          "404": {
            description: "Category not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseErrorResponse" },
              },
            },
          },
          "409": {
            description: "Questions can only be posted to active categories",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OkFalseErrorResponse" },
                    { $ref: "#/components/schemas/InternalServerErrorResponse" },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/api/forum/question/get-question/{questionId}": {
      get: {
        tags: ["Forum Question"],
        summary: "Get question by id",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "questionId",
            required: true,
            description: "Question UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Question found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GetQuestionSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseValidationIssuesResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "403": {
            description: "Onboarding required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingRequiredErrorResponse" },
              },
            },
          },
          "404": {
            description: "Question not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OkFalseErrorResponse" },
                    { $ref: "#/components/schemas/InternalServerErrorResponse" },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/api/forum/question/get-questions": {
      get: {
        tags: ["Forum Question"],
        summary: "Get all questions",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Questions found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GetQuestionsSuccessResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "403": {
            description: "Onboarding required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingRequiredErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OkFalseErrorResponse" },
                    { $ref: "#/components/schemas/InternalServerErrorResponse" },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/api/forum/question/get-questions-page": {
      get: {
        tags: ["Forum Question"],
        summary: "Get questions page (infinite scroll)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "limit",
            required: false,
            description: "How many questions per request (1..50). Default is 10.",
            schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
          },
          {
            in: "query",
            name: "cursor",
            required: false,
            description: "Opaque cursor from previous response `pagination.nextCursor`.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Questions page found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GetQuestionsPageSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseValidationIssuesResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "403": {
            description: "Onboarding required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingRequiredErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OkFalseErrorResponse" },
                    { $ref: "#/components/schemas/InternalServerErrorResponse" },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/api/onboarding/options": {
      get: {
        tags: ["Onboarding"],
        summary: "Get onboarding lookup options",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Onboarding options",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingOptionsResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalServerErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/onboarding/interests": {
      get: {
        tags: ["Onboarding"],
        summary: "Get onboarding interest options",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Interest options",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingInterestsResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalServerErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/onboarding/contributions": {
      get: {
        tags: ["Onboarding"],
        summary: "Get onboarding contribution options",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Contribution role options",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingContributionsResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalServerErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/onboarding/locations/countries": {
      get: {
        tags: ["Onboarding"],
        summary: "Get seeded active countries",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Country list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CountryListResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalServerErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/onboarding/locations/cities": {
      get: {
        tags: ["Onboarding"],
        summary: "Get seeded active cities for a selected country",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "countryId",
            required: false,
            description: "Country UUID. Either countryId or countryName is required.",
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "query",
            name: "countryName",
            required: false,
            description: "Country name. Either countryId or countryName is required.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "City list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CityListResponse" },
              },
            },
          },
          "400": {
            description: "countryId or countryName missing",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseErrorResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalServerErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/onboarding/state": {
      get: {
        tags: ["Onboarding"],
        summary: "Get saved onboarding state for current user",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Onboarding state",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingStateResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalServerErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/onboarding/step-1-profile": {
      put: {
        tags: ["Onboarding"],
        summary: "Save onboarding step 1 (profile)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OnboardingProfileStepRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Profile saved",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingStateResponse" },
              },
            },
          },
          "400": {
            description: "Validation failed",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OkFalseValidationIssuesResponse" },
                    { $ref: "#/components/schemas/OkFalseErrorResponse" },
                  ],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalServerErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/onboarding/step-2-interests": {
      put: {
        tags: ["Onboarding"],
        summary: "Save onboarding step 2 (interests)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OnboardingInterestsStepRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Interests saved",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingStateResponse" },
              },
            },
          },
          "400": {
            description: "Validation failed",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OkFalseValidationIssuesResponse" },
                    { $ref: "#/components/schemas/OkFalseErrorResponse" },
                  ],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalServerErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/onboarding/step-3-contributions": {
      put: {
        tags: ["Onboarding"],
        summary: "Save onboarding step 3 (contributions)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OnboardingContributionsStepRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Contributions saved",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingStateResponse" },
              },
            },
          },
          "400": {
            description: "Validation failed",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OkFalseValidationIssuesResponse" },
                    { $ref: "#/components/schemas/OkFalseErrorResponse" },
                  ],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalServerErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/onboarding/step-4-complete": {
      put: {
        tags: ["Onboarding"],
        summary: "Complete onboarding step 4",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Onboarding completed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OnboardingStateResponse" },
              },
            },
          },
          "400": {
            description: "Onboarding steps 1-3 are not complete",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseErrorResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalServerErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/uploads/avatar/presign": {
      post: {
        tags: ["Uploads"],
        summary: "Get a presigned R2 upload URL for avatar image",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PresignAvatarUploadRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Presigned URL generated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PresignAvatarUploadResponse" },
              },
            },
          },
          "400": {
            description: "Validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkFalseValidationIssuesResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleErrorResponse" },
              },
            },
          },
          "500": {
            description: "Failed to generate upload URL",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/OkFalseErrorResponse" },
                    { $ref: "#/components/schemas/InternalServerErrorResponse" },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
