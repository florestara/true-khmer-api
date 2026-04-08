import { z } from "zod";

export const volunteerLocationResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi("VolunteerLocationResponse");

export const getVolunteerLocationsResponseSchema = z
  .object({
    ok: z.literal(true),
    locations: z.array(volunteerLocationResponseSchema),
  })
  .openapi("GetVolunteerLocationsResponse");
