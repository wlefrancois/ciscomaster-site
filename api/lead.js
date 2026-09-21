const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const clean = (value, max = 2000) =>
  String(value ?? "").trim().replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, max);

const esc = (value) =>
  clean(value, 5000).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));

async function sendEmail(apiKey, payload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.LEAD_TO_EMAIL || "assessments@ciscomaster.com";
  const fromEmail = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.error("Lead endpoint is missing RESEND_API_KEY or LEAD_FROM_EMAIL");
    return json(res, 503, { ok: false, error: "Lead service is not configured" });
  }

  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const name = clean(b.name, 120);
  const company = clean(b.company, 160);
  const email = clean(b.email, 254);
  const service = clean(b.service, 160);
  const concern = clean(b.concern, 240);
  if (!name || !company || !email || !service || !concern || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { ok: false, error: "Please complete the required fields" });
  }

  const leadId = `CM-${Date.now().toString(36).toUpperCase()}`;
  const fields = {
    "Lead ID": leadId, Name: name, Company: company, Email: email,
    Phone: clean(b.phone, 80) || "Not provided", Service: service,
    "Environment size": clean(b.environment, 160) || "Not specified",
    "CUCM version": clean(b.version, 120) || "Not provided",
    "Primary concern": concern, Timeframe: clean(b.timeframe, 160) || "Not specified",
    "Additional information": clean(b.notes, 4000) || "None provided",
    "UTM source": clean(b.utm_source, 160) || "Direct / unknown",
    "UTM medium": clean(b.utm_medium, 160) || "Not provided",
    "UTM campaign": clean(b.utm_campaign, 200) || "Not provided",
    "UTM content": clean(b.utm_content, 200) || "Not provided",
    "Landing page": clean(b.landing_page, 500) || "Not provided",
    Referrer: clean(b.referrer, 500) || "Not provided"
  };

  const rows = Object.entries(fields).map(([k,v]) =>
    `<tr><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;vertical-align:top">${esc(k)}</td><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${esc(v)}</td></tr>`
  ).join("");

  try {
    const internalDelivery = await sendEmail(apiKey, {
      from: fromEmail, to: [toEmail], reply_to: email,
      subject: `CiscoMaster lead — ${service} — ${company}`,
      html: `<h2>New CiscoMaster request</h2><table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows}</table>`
    });
    console.log("CiscoMaster lead accepted by email provider", { leadId, providerId: internalDelivery?.id || "unknown", to: toEmail, from: fromEmail });

    try {
      const acknowledgement = await sendEmail(apiKey, {
        from: fromEmail, to: [email], reply_to: toEmail,
        subject: "We received your CiscoMaster request",
        html: `<div style="font-family:Arial,sans-serif;max-width:620px"><h2>We received your request.</h2><p>Hi ${esc(name)},</p><p>WDC received your CiscoMaster request for <strong>${esc(service)}</strong>. We’ll review the environment, objective and timing and follow up with the appropriate next step.</p><p><strong>Reference:</strong> ${esc(leadId)}</p><p>Submitting a request does not authorize production changes or commit you to a paid engagement.</p><p>WDC, LLC<br>CiscoMaster</p></div>`
      });
      console.log("CiscoMaster acknowledgement accepted by email provider", { leadId, providerId: acknowledgement?.id || "unknown", to: email, from: fromEmail });
    } catch (ackError) {
      console.error("Lead acknowledgement failed", { leadId, message: ackError?.message || String(ackError) });
    }

    return json(res, 200, { ok: true, leadId, deliveryAccepted: true });
  } catch (error) {
    console.error("Lead delivery failed", error);
    return json(res, 502, { ok: false, error: "Unable to deliver request" });
  }
}
