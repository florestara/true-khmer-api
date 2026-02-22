import { Hono } from "hono";
import {
  handleAuthPassthrough,
  handleLogin,
  handleRefresh,
  handleRegister,
  handleVerifyRegisterOtp,
} from "./handler";

const authRoute = new Hono();

authRoute.post("/register", handleRegister);
authRoute.post("/register/verify-otp", handleVerifyRegisterOtp);
authRoute.post("/login", handleLogin);
authRoute.post("/refresh", handleRefresh);
authRoute.all("/*", handleAuthPassthrough);

export default authRoute;
