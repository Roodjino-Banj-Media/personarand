const { marked } = require('marked');

marked.setOptions({ gfm: true, breaks: true });

// Minimal, email-client-safe HTML wrapper. Uses tables and inline styles
// because Gmail/Outlook/Apple Mail all strip modern CSS.
function renderNewsletterHtml({ title, markdown, subscriberEmail, unsubscribeUrl, trackingPixelUrl }) {
  const bodyHtml = marked.parse(markdown || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#ffffff; border-radius:6px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:28px 40px 12px 40px; border-bottom:1px solid #eee;">
              <div style="font-size:11px; letter-spacing:0.15em; text-transform:uppercase; color:#888; font-weight:600;">Roodjino Chérilus</div>
              <h1 style="margin:8px 0 0 0; font-size:26px; line-height:1.25; font-weight:700; color:#1a1a1a;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px 40px; font-size:16px; line-height:1.65; color:#2a2a2a;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 24px 40px; border-top:1px solid #eee; background:#fafafa; font-size:12px; line-height:1.5; color:#777;">
              <p style="margin:0 0 8px 0;"><strong>Banj Media</strong> · Haiti · Media systems + strategy</p>
              <p style="margin:0;">
                You're reading this at <span style="color:#444;">${escapeHtml(subscriberEmail || '')}</span>.
                ${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#777; text-decoration:underline;">Unsubscribe</a>` : ''}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${trackingPixelUrl ? `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;">` : ''}
</body>
</html>`;
}

function renderPlainText({ title, markdown }) {
  // Crude but functional — strip markdown syntax for a plain-text fallback.
  const stripped = (markdown || '')
    .replace(/[#*_`~]/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^\s*>\s?/gm, '')
    .trim();
  return `${title}\n\n${stripped}`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { renderNewsletterHtml, renderPlainText };
