import { NextResponse } from "next/server";
import { Resend } from "resend";

// Contact-form delivery via Resend. Sends from Resend's shared onboarding
// sender (no verified domain needed) to the site owner, with the visitor's
// address as reply-to so replies go straight back to them.
const TO_EMAIL = "evandaenuwy@gmail.com";
const FROM_EMAIL = "TaxBuddy Contact <onboarding@resend.dev>";

interface ContactRequestBody {
  name?: string;
  email?: string;
  message?: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email isn't configured on the server." }, { status: 500 });
  }

  const { name, email, message } = (await request.json()) as ContactRequestBody;
  if (!message || !message.trim()) {
    return NextResponse.json({ error: "A message is required." }, { status: 400 });
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [TO_EMAIL],
    replyTo: email && email.trim() ? email.trim() : undefined,
    subject: `TaxBuddy — message from ${name?.trim() || email?.trim() || "a visitor"}`,
    text: `${message.trim()}\n\n— ${name?.trim() || "(no name given)"}${email?.trim() ? ` (${email.trim()})` : ""}`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
