import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { title, content } = await req.json();

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('email, name')
    .not('email', 'is', null);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  const recipients = profiles
    .filter((p: any) => p.email)
    .map((p: any) => ({ email: p.email, name: p.name || p.email }));

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No users to email' }, { status: 400 });
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY!,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'DriveTR', email: 'kamalhuseynov578@gmail.com' },
      to: recipients,
      subject: title,
      htmlContent: `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e8e8e8;">
          <div style="background: #ae050a; padding: 28px 32px;">
            <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">DriveTR</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">Platform Announcement</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="margin: 0 0 16px; font-size: 20px; color: #0f172a;">${title}</h2>
            <p style="margin: 0; font-size: 15px; color: #444; line-height: 1.7; white-space: pre-wrap;">${content}</p>
          </div>
          <div style="padding: 20px 32px; border-top: 1px solid #f0f0f0; background: #fafafa;">
            <p style="margin: 0; font-size: 12px; color: #aaa;">You received this because you are registered on <a href="https://drive-tr.vercel.app" style="color: #ae050a;">DriveTR</a>.</p>
          </div>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: err.message || 'Failed to send emails' }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: recipients.length });
}
