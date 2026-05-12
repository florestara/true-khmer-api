const docsAccessTokenKey = "scalar_docs_access_token";
const docsRefreshTokenKey = "scalar_docs_refresh_token";
const docsEmailKey = "scalar_docs_email";
const docsLoginPath = "/v1/auth/login";
const docsRefreshPath = "/v1/auth/refresh";

export function scalarDocsPageHtml() {
  return `<!doctype html>
<html>
  <head>
    <title>TrueKhmer API Docs</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style type="text/css">
      :root {
        color-scheme: dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      body {
        margin: 0;
        background: #0f1014;
      }

      .docs-auth {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        color: #f5f5f5;
        background: #16181d;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      }

      .docs-auth form {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin: 0;
      }

      .docs-auth input {
        width: min(260px, 70vw);
        min-height: 34px;
        box-sizing: border-box;
        padding: 7px 10px;
        color: #f5f5f5;
        background: #22252c;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 6px;
      }

      .docs-auth button {
        min-height: 34px;
        padding: 7px 12px;
        color: #f5f5f5;
        background: #e36002;
        border: 0;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
      }

      .docs-auth button.secondary {
        background: #2d3038;
      }

      .docs-auth-status {
        min-width: 96px;
        color: rgba(255, 255, 255, 0.72);
        font-size: 14px;
      }

      #app {
        height: calc(100vh - 59px);
      }

      @media (max-width: 720px) {
        .docs-auth,
        .docs-auth form {
          align-items: stretch;
          flex-direction: column;
        }

        .docs-auth input,
        .docs-auth button {
          width: 100%;
        }

        #app {
          height: calc(100vh - 193px);
        }
      }
    </style>
  </head>
  <body>
    <section class="docs-auth" aria-label="API docs authentication">
      <form id="docs-login-form">
        <input id="docs-email" name="email" type="email" autocomplete="username" placeholder="Email" required />
        <input id="docs-password" name="password" type="password" autocomplete="current-password" placeholder="Password" required />
        <button id="docs-auth-action" type="button">Login for API Docs</button>
      </form>
      <span id="docs-auth-status" class="docs-auth-status" role="status" aria-live="polite">Not logged in</span>
    </section>
    <div id="app"></div>
    <script type="text/javascript">
      (() => {
        const accessTokenKey = ${JSON.stringify(docsAccessTokenKey)};
        const refreshTokenKey = ${JSON.stringify(docsRefreshTokenKey)};
        const emailKey = ${JSON.stringify(docsEmailKey)};
        const loginPath = ${JSON.stringify(docsLoginPath)};
        const refreshPath = ${JSON.stringify(docsRefreshPath)};
        const refreshLeewaySeconds = 60;
        let refreshPromise = null;
        let scalarReferenceInstance = null;

        function setStatus(message) {
          const status = document.getElementById("docs-auth-status");
          if (status) {
            status.textContent = message;
          }
        }

        function isDocsLoggedIn() {
          return Boolean(getStoredAccessToken() && getStoredRefreshToken());
        }

        function getStoredEmail() {
          try {
            return localStorage.getItem(emailKey);
          } catch {
            return null;
          }
        }

        function storeDocsEmail(email) {
          try {
            if (email) {
              localStorage.setItem(emailKey, email);
            }
          } catch {
            // Email persistence is optional convenience only.
          }
        }

        function syncAuthControls() {
          const loggedIn = isDocsLoggedIn();
          const action = document.getElementById("docs-auth-action");
          const emailInput = document.getElementById("docs-email");
          const passwordInput = document.getElementById("docs-password");

          if (action) {
            action.textContent = loggedIn ? "Logout" : "Login for API Docs";
            action.classList.toggle("secondary", loggedIn);
          }

          if (emailInput instanceof HTMLInputElement) {
            emailInput.required = !loggedIn;
          }

          if (passwordInput instanceof HTMLInputElement) {
            passwordInput.required = !loggedIn;
          }
        }

        function hydratePersistedInputs() {
          const emailInput = document.getElementById("docs-email");
          const storedEmail = getStoredEmail();

          if (
            emailInput instanceof HTMLInputElement &&
            storedEmail &&
            !emailInput.value
          ) {
            emailInput.value = storedEmail;
          }
        }

        function getStoredAccessToken() {
          try {
            return localStorage.getItem(accessTokenKey);
          } catch {
            return null;
          }
        }

        function getStoredRefreshToken() {
          try {
            return localStorage.getItem(refreshTokenKey);
          } catch {
            return null;
          }
        }

        function storeDocsTokens(accessToken, refreshToken) {
          try {
            localStorage.setItem(accessTokenKey, accessToken);
            localStorage.setItem(refreshTokenKey, refreshToken);
          } catch {
            clearDocsTokens();
            throw new Error("Unable to store docs tokens");
          }
        }

        function clearDocsTokens() {
          try {
            localStorage.removeItem(accessTokenKey);
            localStorage.removeItem(refreshTokenKey);
          } catch {
            // Storage may be unavailable in private or restricted browser modes.
          }
        }

        function createScalarConfiguration() {
          const accessToken = getStoredAccessToken();

          return {
            url: "/docs/openapi.json",
            theme: "deepSpace",
            layout: "classic",
            persistAuth: false,
            authentication: {
              preferredSecurityScheme: "BearerAuth",
              securitySchemes: {
                BearerAuth: {
                  token: accessToken ?? "",
                },
              },
            },
            onBeforeRequest: async ({ request }) => {
              await window.scalarDocsAuth?.applyAuthorization(request);
            },
            fetch: async (input, init) => {
              const request = new Request(input, init);

              await window.scalarDocsAuth?.applyAuthorization(request);

              return fetch(request);
            },
          };
        }

        function renderScalarApiReference() {
          const app = document.getElementById("app");

          if (!app || !window.Scalar?.createApiReference) {
            return;
          }

          scalarReferenceInstance = window.Scalar.createApiReference(
            "#app",
            createScalarConfiguration(),
          );
        }

        function refreshScalarAuthField() {
          const configuration = createScalarConfiguration();

          try {
            if (scalarReferenceInstance?.updateConfiguration) {
              scalarReferenceInstance.updateConfiguration(configuration);
              return;
            }
          } catch {
            scalarReferenceInstance = null;
          }

          renderScalarApiReference();
        }

        function decodeJwtPayload(token) {
          try {
            const payloadPart = token.split(".")[1];
            if (!payloadPart) {
              return null;
            }

            const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
            const padded = base64.padEnd(
              base64.length + ((4 - (base64.length % 4)) % 4),
              "=",
            );
            const decoded = atob(padded);
            const json = decodeURIComponent(
              Array.from(decoded, (character) =>
                "%" + character.charCodeAt(0).toString(16).padStart(2, "0"),
              ).join(""),
            );
            const payload = JSON.parse(json);

            if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
              return null;
            }

            return payload;
          } catch {
            return null;
          }
        }

        function isAccessTokenExpiringSoon(accessToken) {
          const payload = decodeJwtPayload(accessToken);
          const exp = payload && payload.exp;

          if (typeof exp !== "number" || !Number.isFinite(exp)) {
            return true;
          }

          return exp <= Math.floor(Date.now() / 1000) + refreshLeewaySeconds;
        }

        function extractDocsTokens(payload) {
          const candidates = [payload, payload && payload.result, payload && payload.data];

          for (const candidate of candidates) {
            if (
              candidate &&
              typeof candidate === "object" &&
              typeof candidate.accessToken === "string" &&
              typeof candidate.refreshToken === "string"
            ) {
              return {
                accessToken: candidate.accessToken,
                refreshToken: candidate.refreshToken,
              };
            }
          }

          return null;
        }

        async function refreshDocsToken() {
          const refreshToken = getStoredRefreshToken();

          if (!refreshToken) {
            clearDocsTokens();
            return null;
          }

          if (!refreshPromise) {
            refreshPromise = (async () => {
              try {
                const response = await fetch(refreshPath, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ refreshToken }),
                });

                if (!response.ok) {
                  throw new Error("Token refresh failed");
                }

                const tokens = extractDocsTokens(await response.json());

                if (!tokens) {
                  throw new Error("Token refresh response missing tokens");
                }

                storeDocsTokens(tokens.accessToken, tokens.refreshToken);
                setStatus("Token refreshed");
                syncAuthControls();
                refreshScalarAuthField();
                return tokens.accessToken;
              } catch {
                clearDocsTokens();
                setStatus("Not logged in");
                syncAuthControls();
                refreshScalarAuthField();
                return null;
              } finally {
                refreshPromise = null;
              }
            })();
          }

          return refreshPromise;
        }

        async function getAccessTokenForRequest() {
          const accessToken = getStoredAccessToken();

          if (!accessToken) {
            return null;
          }

          if (!isAccessTokenExpiringSoon(accessToken)) {
            return accessToken;
          }

          return refreshDocsToken();
        }

        async function applyAuthorization(request) {
          const accessToken = await getAccessTokenForRequest();

          if (accessToken) {
            request.headers.set("authorization", "Bearer " + accessToken);
          }
        }

        async function handleLogin(form) {
          const formData = new FormData(form);
          const email = String(formData.get("email") ?? "").trim();
          const password = String(formData.get("password") ?? "");

          setStatus("Not logged in");

          try {
            const response = await fetch(loginPath, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
              throw new Error("Login failed");
            }

            const tokens = extractDocsTokens(await response.json());

            if (!tokens) {
              throw new Error("Login response missing tokens");
            }

            storeDocsEmail(email);
            storeDocsTokens(tokens.accessToken, tokens.refreshToken);
            setStatus("Logged in");
            syncAuthControls();
            refreshScalarAuthField();
          } catch {
            clearDocsTokens();
            setStatus("Login failed");
            syncAuthControls();
            refreshScalarAuthField();
          }
        }

        function handleLogout() {
          clearDocsTokens();
          setStatus("Not logged in");
          syncAuthControls();
          refreshScalarAuthField();
        }

        function handleAuthAction(event) {
          event.preventDefault();

          if (isDocsLoggedIn()) {
            handleLogout();
            return;
          }

          const form = document.getElementById("docs-login-form");

          if (form instanceof HTMLFormElement) {
            if (!form.reportValidity()) {
              return;
            }

            void handleLogin(form);
          }
        }

        hydratePersistedInputs();
        document
          .getElementById("docs-email")
          ?.addEventListener("input", (event) => {
            const target = event.target;

            if (target instanceof HTMLInputElement) {
              storeDocsEmail(target.value.trim());
            }
          });
        document
          .getElementById("docs-login-form")
          ?.addEventListener("submit", handleAuthAction);
        document
          .getElementById("docs-auth-action")
          ?.addEventListener("click", handleAuthAction);
        setStatus(
          isDocsLoggedIn()
            ? "Logged in"
            : "Not logged in",
        );
        syncAuthControls();

        window.scalarDocsAuth = {
          getStoredAccessToken,
          getStoredRefreshToken,
          storeDocsTokens,
          clearDocsTokens,
          decodeJwtPayload,
          isAccessTokenExpiringSoon,
          refreshDocsToken,
          applyAuthorization,
          refreshScalarAuthField,
        };
      })();
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script type="text/javascript">
      window.scalarDocsAuth?.refreshScalarAuthField();
    </script>
  </body>
</html>`;
}
