import { Context, Env } from "hono";
import type { AuthContext } from "../modules/auth/lib/types";

export type AppBindings = {
  Variables: {
    auth: AuthContext;
  };
};

export type HonoContext = Context<
  Env & AppBindings,
  "/",
  {
    in: {
      json: {
        name: string;
        slug: string;
        description?: string | undefined;
      };
    };
    out: {
      json: {
        name: string;
        slug: string;
        description?: string | undefined;
      };
    };
  }
>;
