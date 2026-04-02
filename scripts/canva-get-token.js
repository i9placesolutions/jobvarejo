/**
 * Script para gerar Access Token do Canva Connect API
 *
 * Como usar:
 * 1. Preencha CANVA_CLIENT_ID e CANVA_CLIENT_SECRET abaixo
 * 2. Execute: node scripts/canva-get-token.js
 * 3. Autorize no navegador
 * 4. O token sera exibido no terminal
 */

const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");

// ============================================
// PREENCHA COM SUAS CREDENCIAIS
// ============================================
const CANVA_CLIENT_ID = process.env.CANVA_CLIENT_ID || "OC-AZ1OKuz2MVbG";
const CANVA_CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET || "";
// ============================================

const REDIRECT_URI = "http://127.0.0.1:9876/callback";
const SCOPES = [
  "design:content:read",
  "design:content:write",
  "design:meta:read",
  "asset:read",
  "asset:write",
  "profile:read",
  "brandtemplate:meta:read",
  "brandtemplate:content:read",
  "folder:read",
].join(" ");

// Gera code_verifier e code_challenge (PKCE)
const codeVerifier = crypto.randomBytes(64).toString("base64url");
const codeChallenge = crypto
  .createHash("sha256")
  .update(codeVerifier)
  .digest("base64url");

// Monta a URL de autorizacao
const authUrl = new URL("https://www.canva.com/api/oauth/authorize");
authUrl.searchParams.set("code_challenge", codeChallenge);
authUrl.searchParams.set("code_challenge_method", "S256");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("client_id", CANVA_CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);

// Funcao para trocar o code por access token
async function exchangeCodeForToken(code) {
  const credentials = Buffer.from(
    `${CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    "https://api.canva.com/rest/v1/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao gerar token: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Inicia servidor local para capturar o callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:9876`);

  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");

    if (!code) {
      res.writeHead(400);
      res.end("Erro: codigo de autorizacao nao encontrado.");
      return;
    }

    try {
      const tokenData = await exchangeCodeForToken(code);

      console.log("\n========================================");
      console.log("ACCESS TOKEN GERADO COM SUCESSO!");
      console.log("========================================");
      console.log(`\nCANVA_ACCESS_TOKEN=${tokenData.access_token}`);
      console.log(`\nRefresh Token: ${tokenData.refresh_token}`);
      console.log(`Expira em: ${tokenData.expires_in} segundos`);
      console.log("\n========================================");
      console.log("Copie o CANVA_ACCESS_TOKEN acima e cole no .env");
      console.log("========================================\n");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
        <body style="font-family: Arial; text-align: center; padding: 50px; background: #0f0f0f; color: white;">
          <h1>Token gerado com sucesso!</h1>
          <p>Volte ao terminal para copiar o token.</p>
          <p>Voce pode fechar esta aba.</p>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("Erro:", error.message);
      res.writeHead(500);
      res.end(`Erro: ${error.message}`);
    }

    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 2000);
  }
});

server.listen(9876, "127.0.0.1", () => {
  console.log("\n========================================");
  console.log("Canva Token Generator - Job Varejo");
  console.log("========================================");
  console.log("\nServidor local iniciado em http://127.0.0.1:9876");
  console.log("\nAbrindo navegador para autorizacao...");
  console.log(`\nSe o navegador nao abrir, acesse:\n${authUrl.toString()}\n`);

  const { exec } = require("child_process");
  const platform = process.platform;

  if (platform === "darwin") {
    exec(`open "${authUrl.toString()}"`);
  } else if (platform === "win32") {
    exec(`start "" "${authUrl.toString()}"`);
  } else {
    exec(`xdg-open "${authUrl.toString()}"`);
  }
});
