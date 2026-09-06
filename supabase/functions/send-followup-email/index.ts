const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RequestBody = {
  to?: string;
  name?: string | null;
  company?: string | null;
  requestType?: "demo" | "human" | string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  timezone?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as RequestBody;
    const to = body.to?.trim();

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
      return json({ error: "A valid recipient email is required" }, 400);
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FOLLOWUP_FROM_EMAIL");

    if (!apiKey || !fromEmail) {
      return json(
        {
          configured: false,
          sent: false,
          error:
            "Email is not configured. Set RESEND_API_KEY and FOLLOWUP_FROM_EMAIL as Supabase secrets.",
        },
        503,
      );
    }

    const requestLabel = body.requestType === "demo" ? "product demo" : "human sales follow-up";
    const name = body.name?.trim() || "there";
    const company = body.company?.trim() || "your organization";
    const when = [body.preferredDate, body.preferredTime].filter(Boolean).join(" at ") || "a time still to be confirmed";
    const timezone = body.timezone?.trim() || "timezone to be confirmed";

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h1 style="color: #0369a1;">NexaVoice</h1>
        <p>Give Sales a Voice</p>
        <p>Hi ${escapeHtml(name)},</p>
        <p>Thank you for speaking with Emily. Your ${escapeHtml(requestLabel)} request has been recorded for ${escapeHtml(company)}.</p>
        <p><strong>Requested time:</strong> ${escapeHtml(when)} (${escapeHtml(timezone)})</p>
        <p>Our sales team can contact you at the requested time. This message confirms that the request was recorded. It does not confirm that an appointment is booked.</p>
        <p>— The NexaVoice team</p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: "NexaVoice follow-up request received",
        html,
      }),
    });

    if (!response.ok) {
      return json(
        {
          configured: true,
          sent: false,
          error: "The email provider rejected the confirmation email.",
        },
        502,
      );
    }

    return json({ configured: true, sent: true });
  } catch {
    return json(
      {
        sent: false,
        error: "The confirmation email could not be sent. The follow-up request was still recorded.",
      },
      500,
    );
  }
});
