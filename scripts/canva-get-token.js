/**
 * Script para gerar Access Token do Canva Connect API
 *
 * Como usar:
 * 1. Preencha CANVA_CLIENT_ID e CANVA_CLIENT_SECRET abaixo
 * 2. Execute: node scripts/canva-get-token.js
 * 3. Autorize no navegador
 * 4. O token sera exibido no terminal
 */

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import { exec } from "node:child_process";
import { URL } from "node:url";

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

function printAuthUrl() {
  const authUrlText = authUrl.toString();
  console.log("\n========================================");
  console.log("COPIE ESTE LINK SE O NAVEGADOR NAO ABRIR");
  console.log("========================================");
  console.log(authUrlText);
  console.log("========================================\n");

  try {
    fs.writeFileSync(".canva-auth-url.txt", `${authUrlText}\n`);
    console.log("URL salva em .canva-auth-url.txt\n");
  } catch (error) {
    console.warn("Nao foi possivel salvar .canva-auth-url.txt:", error.message);
  }
}

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
      console.log(`CANVA_REFRESH_TOKEN=${tokenData.refresh_token}`);
      console.log(`CANVA_CLIENT_ID=${CANVA_CLIENT_ID}`);
      console.log(`Expira em: ${tokenData.expires_in} segundos`);
      console.log("\n========================================");
      console.log("Copie CANVA_ACCESS_TOKEN e CANVA_REFRESH_TOKEN acima e cole no .env");
      console.log("========================================\n");

      try {
        const expiresAt = Date.now() + ((Number(tokenData.expires_in) || 0) * 1000);
        fs.writeFileSync(
          ".canva-oauth.json",
          JSON.stringify({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          }, null, 2)
        );
        console.log("Cache local salvo em .canva-oauth.json");
      } catch (cacheError) {
        console.warn("Nao foi possivel salvar .canva-oauth.json:", cacheError.message);
      }

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
  printAuthUrl();

  const platform = process.platform;
  const targetUrl = authUrl.toString();

  if (platform === "darwin") {
    exec(`open "${targetUrl}"`, (error) => {
      if (error) console.warn("Falha ao abrir navegador automaticamente:", error.message);
    });
  } else if (platform === "win32") {
    exec(`start "" "${targetUrl}"`, (error) => {
      if (error) console.warn("Falha ao abrir navegador automaticamente:", error.message);
    });
  } else {
    exec(`xdg-open "${targetUrl}"`, (error) => {
      if (error) console.warn("Falha ao abrir navegador automaticamente:", error.message);
    });
  }
});
