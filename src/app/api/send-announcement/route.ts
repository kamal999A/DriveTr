import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: process.env.BREVO_SMTP_USER!,
    pass: process.env.BREVO_SMTP_KEY!,
  },
});

export async function POST(req: NextRequest) {
  const { title, content } = await req.json();

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('email')
    .not('email', 'is', null);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  const emails = profiles.map((p: any) => p.email).filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json({ error: 'No users to email' }, { status: 400 });
  }

  try {
    await transporter.sendMail({
      from: '"DriveTR" <noreply@drivetr.com>',
      bcc: emails,
      subject: title,
      html: `
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
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: emails.length });
}
