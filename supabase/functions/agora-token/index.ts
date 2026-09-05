import { RtcRole, RtcTokenBuilder } from "npm:agora-access-token@2.0.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RequestBody = {
  action: "token" | "start" | "stop";
  channelName: string;
  uid?: number;
  browserUid?: number;
  agentId?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function agoraRequest(path: string, init: RequestInit = {}) {
  const customerId = Deno.env.get("AGORA_CUSTOMER_ID");
  const customerSecret = Deno.env.get("AGORA_CUSTOMER_SECRET");
  if (!customerId || !customerSecret) throw new Error("Agora Customer ID/Secret are not configured");
  const auth = btoa(`${customerId}:${customerSecret}`);
  return fetch(`https://api.agora.io${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as RequestBody;
    const channelName = body.channelName?.trim();
    const browserUid = body.uid ?? body.browserUid;
    const appId = Deno.env.get("AGORA_APP_ID");
    const certificate = Deno.env.get("AGORA_APP_CERTIFICATE");
    if (!channelName || !appId || !certificate) {
      return json({ error: "Agora app credentials and channelName are required" }, 503);
    }
    if (body.action !== "stop" && (!Number.isInteger(browserUid) || browserUid <= 0)) {
      return json({ error: "A non-zero browser UID is required" }, 400);
    }

    const configuredUid = Deno.env.get("AGORA_AGENT_UID");
    const configuredAgentUid = configuredUid ? Number(configuredUid) : null;
    if (configuredAgentUid !== null && (!Number.isInteger(configuredAgentUid) || configuredAgentUid <= 0)) {
      return json({ error: "AGORA_AGENT_UID must be a positive integer" }, 503);
    }
    const uid = configuredAgentUid ??
      100000 + Array.from(channelName).reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 900000, 0);
    const agentUid = uid === browserUid ? (uid % 899999) + 1 : uid;
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const userToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      certificate,
      channelName,
      browserUid,
      RtcRole.PUBLISHER,
      expiry,
    );

    if (body.action === "token") return json({ appId, channelName, token: userToken, uid: browserUid });

    if (body.action === "start") {
      const agentToken = RtcTokenBuilder.buildTokenWithUid(
        appId,
        certificate,
        channelName,
        agentUid,
        RtcRole.PUBLISHER,
        expiry,
      );
      const response = await agoraRequest(`/api/conversational-ai-agent/v2/projects/${appId}/join`, {
        method: "POST",
        body: JSON.stringify({
          name: `${Deno.env.get("AGORA_AGENT_NAME") ?? "nexavoice-sales-agent"}-${Date.now()}`,
          ...(Deno.env.get("AGORA_PIPELINE_ID")
            ? { pipeline_id: Deno.env.get("AGORA_PIPELINE_ID") }
            : {}),
          properties: {
            channel: channelName,
            token: agentToken,
            agent_rtc_uid: agentUid,
            remote_rtc_uids: [browserUid],
            enable_string_uid: false,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return json({ error: result.message ?? "Agora agent start failed" }, response.status);
      return json({ agentId: result.agent_id ?? result.agentId });
    }

    if (!body.agentId) return json({ error: "agentId is required to stop an agent" }, 400);
    const response = await agoraRequest(
      `/api/conversational-ai-agent/v2/projects/${appId}/agents/${encodeURIComponent(body.agentId)}/leave`,
      { method: "POST", body: JSON.stringify({}) },
    );
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return json({ error: result.message ?? "Agora agent stop failed" }, response.status);
    }
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
