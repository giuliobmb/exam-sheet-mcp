import { randomUUID } from "node:crypto";
import type { Response } from "express";
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InvalidRequestError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

/**
 * Minimal OAuth provider that approves every client and every request
 * without a login step. The server has no user accounts and nothing to
 * gate behind auth — this exists solely because Claude.ai's connector flow
 * always attempts OAuth Dynamic Client Registration before connecting, and
 * fails with "Couldn't register with [...] sign-in service" against
 * servers that don't expose OAuth endpoints at all, even when auth is
 * genuinely optional (tracked as anthropics/claude-ai-mcp#402). This gives
 * Claude.ai something to register and authorize against so that bug stops
 * firing; /mcp itself stays ungated so no-auth clients (ChatGPT, curl,
 * MCP Inspector) keep working unchanged.
 */
class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  async getClient(clientId: string) {
    return this.clients.get(clientId);
  }

  async registerClient(client: OAuthClientInformationFull) {
    this.clients.set(client.client_id, client);
    return client;
  }
}

interface CodeEntry {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
}

interface TokenEntry {
  clientId: string;
  scopes: string[];
  expiresAt: number;
}

export class OpenAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new InMemoryClientsStore();
  private codes = new Map<string, CodeEntry>();
  private tokens = new Map<string, TokenEntry>();

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    if (!client.redirect_uris.includes(params.redirectUri)) {
      throw new InvalidRequestError("Unregistered redirect_uri");
    }
    const code = randomUUID();
    this.codes.set(code, { client, params });
    const target = new URL(params.redirectUri);
    target.searchParams.set("code", code);
    if (params.state !== undefined) target.searchParams.set("state", params.state);
    res.redirect(target.toString());
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const entry = this.codes.get(authorizationCode);
    if (!entry) throw new Error("Invalid authorization code");
    return entry.params.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<OAuthTokens> {
    const entry = this.codes.get(authorizationCode);
    if (!entry) throw new Error("Invalid authorization code");
    if (entry.client.client_id !== client.client_id) {
      throw new Error("Authorization code was not issued to this client.");
    }
    this.codes.delete(authorizationCode);
    const token = randomUUID();
    const scopes = entry.params.scopes ?? [];
    this.tokens.set(token, {
      clientId: client.client_id,
      scopes,
      expiresAt: Date.now() + 3_600_000,
    });
    return {
      access_token: token,
      token_type: "bearer",
      expires_in: 3600,
      scope: scopes.join(" "),
    };
  }

  async exchangeRefreshToken(): Promise<OAuthTokens> {
    throw new Error("Refresh tokens are not supported.");
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const entry = this.tokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new Error("Invalid or expired token.");
    }
    return {
      token,
      clientId: entry.clientId,
      scopes: entry.scopes,
      expiresAt: Math.floor(entry.expiresAt / 1000),
    };
  }
}
