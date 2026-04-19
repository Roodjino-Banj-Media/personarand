const { Resend } = require('resend');

let resendClient = null;
function getClient() {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

function fromAddress() {
  const name = process.env.RESEND_FROM_NAME || 'Newsletter';
  const email = process.env.RESEND_FROM_EMAIL;
  if (!email) return null;
  return `${name} <${email}>`;
}

function publicBaseUrl() {
  return process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
}

// Send a single email. Returns { id, delivered, reason }.
// If Resend is not configured, logs to console and returns a stub id \u2014 callers
// still insert into newsletter_engagement so the UI works while you finish ESP setup.
async function sendEmail({ to, subject, html, text, tags = [] }) {
  const client = getClient();
  const from = fromAddress();

  if (!client || !from) {
    console.log('[email:stub] would send to:', to, '| subject:', subject);
    return { id: `stub-${Date.now()}`, delivered: false, reason: 'RESEND_API_KEY or RESEND_FROM_EMAIL not set' };
  }

  try {
    const result = await client.emails.send({
      from,
      to,
      subject,
      html,
      text: text || undefined,
      tags: tags.length ? tags.map((t) => ({ name: 'category', value: t })) : undefined,
    });
    if (result.error) {
      return { id: null, delivered: false, reason: result.error.message };
    }
    return { id: result.data?.id || null, delivered: true, reason: null };
  } catch (err) {
    return { id: null, delivered: false, reason: err.message };
  }
}

// Send to many recipients. Resend allows up to 50 per batch call.
async function sendBatch(recipients) {
  const client = getClient();
  const from = fromAddress();
  if (!client || !from) {
    console.log(`[email:stub] would batch-send ${recipients.length} emails`);
    return recipients.map((r, i) => ({ to: r.to, id: `stub-${Date.now()}-${i}`, delivered: false, reason: 'RESEND not configured' }));
  }

  const chunks = [];
  for (let i = 0; i < recipients.length; i += 50) chunks.push(recipients.slice(i, i + 50));
  const results = [];
  for (const chunk of chunks) {
    try {
      const res = await client.batch.send(
        chunk.map((r) => ({
          from,
          to: r.to,
          subject: r.subject,
          html: r.html,
          text: r.text || undefined,
          tags: r.tags || undefined,
          headers: r.headers || undefined,
        }))
      );
      if (res.error) {
        for (const r of chunk) results.push({ to: r.to, id: null, delivered: false, reason: res.error.message });
      } else {
        const ids = res.data?.data || [];
        chunk.forEach((r, idx) => {
          results.push({ to: r.to, id: ids[idx]?.id || null, delivered: true, reason: null });
        });
      }
    } catch (err) {
      for (const r of chunk) results.push({ to: r.to, id: null, delivered: false, reason: err.message });
    }
  }
  return results;
}

function isConfigured() {
  return Boolean(getClient() && fromAddress());
}

module.exports = { sendEmail, sendBatch, publicBaseUrl, isConfigured };
