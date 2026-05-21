// api/send-email.js — Vercel Serverless Function with busboy
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');
const { buildAttachments } = require('./attachments');

const DEFAULT_SUPABASE_URL = 'https://egzmtpkkrljolfqfxoph.supabase.co';
function resolveSupabaseUrl() {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  return /^https?:\/\/.+\.supabase\.co/i.test(url) ? url : DEFAULT_SUPABASE_URL;
}

// Supabase client (server‑only, uses service role key)
const db = createClient(
  resolveSupabaseUrl(),
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnem10cGtrcmxqb2xmcWZ4b3BoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM1MjcwMiwiZXhwIjoyMDk0OTI4NzAyfQ.qP4H_g6cN3VK1fC2kdg4S7Ef85ALhPSzbHiK8T5iT4A'
);

/**
 * Parse multipart/form-data request using busboy.
 * Returns a Promise that resolves to an object containing all fields and files.
 */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const fields = {};
    const files = {};

    busboy.on('field', (fieldname, value) => {
      fields[fieldname] = value;
    });

    busboy.on('file', (fieldname, file, { filename, encoding, mimeType }) => {
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {
        files[fieldname] = {
          filename,
          content: Buffer.concat(chunks),
          mimeType,
        };
      });
    });

    busboy.on('error', (err) => reject(err));
    busboy.on('finish', () => resolve({ fields, files }));

    req.pipe(busboy);
  });
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fields, files } = await parseMultipart(req);

    const credentialId = fields.credentialId;
    const to = fields.to;
    const toName = fields.toName;
    const subject = fields.subject;
    const body = fields.body;
    if (!credentialId || !to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch SMTP credential from Supabase
    const { data: cred, error: credErr } = await db
      .from('credentials')
      .select('*')
      .eq('id', credentialId)
      .single();

    if (credErr || !cred) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    // Create Nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: cred.smtp_host,
      port: cred.smtp_port,
      secure: cred.smtp_port === 465,
      auth: {
        user: cred.email,
        pass: cred.app_password,
      },
    });

    const attachments = await buildAttachments(files, fields);

    const senderName = (cred.display_name || cred.label || '').trim();
    const from = senderName
      ? { name: senderName, address: cred.email }
      : cred.email;

    const mailOptions = {
      from,
      to: toName ? `"${toName}" <${to}>` : to,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    };
    if (attachments.length) {
      mailOptions.attachments = attachments;
    }

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Send error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};