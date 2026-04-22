<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <link rel="icon" type="${properties.favIconType!'image/svg+xml'}" href="${resourceUrl}${properties.favIcon!'/favicon.svg'}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light${darkMode?then(' dark', '')}">
    <meta name="description" content="${properties.description!'The Keycloak Administration Console is a web-based interface for managing Keycloak.'}">
    <title>${properties.title!'CloudTech Administration Console'}</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }

      body {
        margin: 0;
        background: #080b18;
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      }

      body, #app {
        height: 100%;
      }
      .container {
        padding: 0;
        margin: 0;
        width: 100%;
      }

      /* ── Loading screen ── */
      .keycloak__loading-container {
        height: 100vh;
        width: 100%;
        background: #080b18;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 24px;
        margin: 0;
      }

      /* Logo above spinner */
      .keycloak__loading-logo {
        height: 40px;
        width: auto;
        margin-bottom: 8px;
      }

      /* Custom cyan spinner */
      .ct-spinner {
        width: 48px;
        height: 48px;
        border: 3px solid rgba(110, 231, 247, 0.15);
        border-top-color: #6ee7f7;
        border-radius: 50%;
        animation: ct-spin 0.75s linear infinite;
      }

      @keyframes ct-spin {
        to { transform: rotate(360deg); }
      }

      /* Loading text + subtext */
      #loading-text {
        font-size: 1rem;
        font-weight: 600;
        color: #e2e8f0;
        letter-spacing: 0.01em;
        margin: 0;
      }

      #loading-subtext {
        font-size: 0.8rem;
        color: #ffffff;
        margin: 0;
      }
    </style>
    <script type="importmap">
      {
        "imports": {
          "react": "${resourceCommonUrl}/vendor/react/react.production.min.js",
          "react/jsx-runtime": "${resourceCommonUrl}/vendor/react/react-jsx-runtime.production.min.js",
          "react-dom": "${resourceCommonUrl}/vendor/react-dom/react-dom.production.min.js"
        }
      }
    </script>
    <#if darkMode>
      <script type="module" async blocking="render">
          const DARK_MODE_CLASS = "${properties.kcDarkModeClass}";
          const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

          updateDarkMode(mediaQuery.matches);
          mediaQuery.addEventListener("change", (event) => updateDarkMode(event.matches));

          function updateDarkMode(isEnabled) {
            const { classList } = document.documentElement;

            if (isEnabled) {
              classList.add(DARK_MODE_CLASS);
            } else {
              classList.remove(DARK_MODE_CLASS);
            }
          }
      </script>
    </#if>
    <#if !isSecureContext>
      <script type="module" src="${resourceCommonUrl}/vendor/web-crypto-shim/web-crypto-shim.js"></script>
    </#if>
    <#if devServerUrl?has_content>
      <script type="module">
        import { injectIntoGlobalHook } from "${devServerUrl}/@react-refresh";
        injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
      </script>
      <script type="module">
        import { inject } from "${devServerUrl}/@vite-plugin-checker-runtime";
        inject({
          overlayConfig: {},
          base: "/",
        });
      </script>
      <script type="module" src="${devServerUrl}/@vite/client"></script>
      <script type="module" src="${devServerUrl}/src/main.tsx"></script>
    </#if>
    <#if entryStyles?has_content>
      <#list entryStyles as style>
        <link rel="stylesheet" href="${resourceUrl}/${style}">
      </#list>
    </#if>
    <#if properties.styles?has_content>
      <#list properties.styles?split(' ') as style>
        <link rel="stylesheet" href="${resourceUrl}/${style}">
      </#list>
    </#if>
    <#if entryScript?has_content>
      <script type="module" src="${resourceUrl}/${entryScript}"></script>
    </#if>
    <#if properties.scripts?has_content>
      <#list properties.scripts?split(' ') as script>
        <script type="module" src="${resourceUrl}/${script}"></script>
      </#list>
    </#if>
    <#if entryImports?has_content>
      <#list entryImports as import>
        <link rel="modulepreload" href="${resourceUrl}/${import}">
      </#list>
    </#if>
  </head>
  <body data-page-id="admin">
    <div id="app">
      <main class="container">
        <div class="keycloak__loading-container">
          <img class="keycloak__loading-logo" src="${resourceUrl}/img/logo.svg" alt="CloudTech Solutions" onerror="this.style.display='none'" />
          <div class="ct-spinner"></div>
          <div style="text-align:center;">
            <p id="loading-text">Loading the CloudTech Administration Console</p>
            <p id="loading-subtext">Please wait…</p>
          </div>
        </div>
      </main>
    </div>
    <noscript>JavaScript is required to use the Administration Console.</noscript>
    <script id="environment" type="application/json">
      {
        "serverBaseUrl": "${serverBaseUrl}",
        "adminBaseUrl": "${adminBaseUrl}",
        "authUrl": "${authUrl}",
        "authServerUrl": "${authServerUrl}",
        "realm": "${loginRealm!"master"}",
        "clientId": "${clientId}",
        "resourceUrl": "${resourceUrl}",
        "logo": "${properties.logo!""}",
        "logoUrl": "${properties.logoUrl!""}",
        "consoleBaseUrl": "${consoleBaseUrl}",
        "masterRealm": "${masterRealm}",
        "resourceVersion": "${resourceVersion}"
      }
    </script>
  </body>
</html>
