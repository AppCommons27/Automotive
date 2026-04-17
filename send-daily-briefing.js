// GitHub Actions Daily Email Script
// Runs every day at 8:00 AM Taiwan time (00:00 UTC)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = process.env.TO_EMAIL; // comma-separated for multiple recipients

const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const dateLabel = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

async function fetchNews() {
  const systemPrompt = `You are a senior automotive industry analyst focused on Smart Cockpit and in-vehicle display solutions. Search for today's (${dateStr}) latest automotive industry news and return strict JSON only, no markdown or explanation.

Format: {"news":[{"id":1,"region":"global","type":"new-car","titleEn":"Title in English, max 15 words","titleZh":"標題繁體中文，15字以內","summaryEn":"One sentence summary in English, max 25 words","summaryZh":"一句話摘要，繁體中文，25字以內","source":"Media outlet name","sourceUrl":"https://actual-article-url.com","readMin":4,"report":{"backgroundEn":"Background context in English, 60-80 words","backgroundZh":"背景說明，繁體中文，60-80字","keyPointsEn":["Key point 1","Key point 2","Key point 3"],"keyPointsZh":["重點一","重點二","重點三"],"impactEn":"Industry impact in English, 50-70 words","impactZh":"產業影響，繁體中文，50-70字","cockpitEn":"Smart Cockpit opportunity in English, 40-60 words","cockpitZh":"Smart Cockpit商機，繁體中文，40-60字","tags":["high"]}}]}

Must return exactly 6 news items: 3 with region=global, 3 with region=na. type must be one of: new-car, arch, design. tags: choose 1-2 from high/mid/watch. sourceUrl must be the actual article URL. Return pure JSON only.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: systemPrompt,
      messages: [{ role: 'user', content: `Search and return today's (${dateStr}) 6 latest global and North America automotive industry news, strictly follow JSON format.` }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean.substring(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
}

function buildEmailHTML(news) {
  const tagColor = { high: '#ff6b6b', mid: '#f5a623', watch: '#1fce8a' };
  const tagLabel = { high: 'High Impact', mid: 'Mid Impact', watch: 'Watch' };
  const typeLabel = { 'new-car': 'New Car', arch: 'Architecture', design: 'Design' };

  function newsBlock(arr, sectionTitle) {
    return `<h2 style="font-size:11px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:#555b72;margin:24px 0 16px;border-top:1px solid rgba(255,255,255,0.07);padding-top:20px;font-family:monospace;">${sectionTitle}</h2>` +
      arr.map(n => {
        const tags = (n.report.tags || []).map(t =>
          `<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:${tagColor[t]}22;color:${tagColor[t]};border:1px solid ${tagColor[t]}44;font-family:monospace;">${tagLabel[t] || t}</span>`
        ).join(' ');
        const sourceLink = n.sourceUrl
          ? `<a href="${n.sourceUrl}" style="color:#4a9eff;font-size:11px;font-family:monospace;text-decoration:none;">${n.source} ↗</a>`
          : `<span style="font-size:11px;color:#888;font-family:monospace;">${n.source}</span>`;
        const ptsEN = (n.report.keyPointsEn || []).map(p => `<li style="margin:4px 0;font-size:13px;color:#8a8fa8;line-height:1.6;">${p}</li>`).join('');
        const ptsZH = (n.report.keyPointsZh || []).map(p => `<li style="margin:4px 0;font-size:12px;color:#555b72;line-height:1.6;">${p}</li>`).join('');

        return `
<div style="background:#151820;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:16px;">
  <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
    <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:${n.region === 'global' ? 'rgba(31,206,138,0.12)' : 'rgba(74,158,255,0.12)'};color:${n.region === 'global' ? '#1fce8a' : '#4a9eff'};border:1px solid ${n.region === 'global' ? 'rgba(31,206,138,0.2)' : 'rgba(74,158,255,0.2)'};font-family:monospace;">${n.region === 'global' ? 'Global' : 'North America'}</span>
    <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:rgba(155,127,232,0.12);color:#9b7fe8;border:1px solid rgba(155,127,232,0.2);font-family:monospace;">${typeLabel[n.type] || n.type}</span>
    <span style="font-size:11px;color:#555b72;font-family:monospace;">${n.readMin} min read</span>
  </div>
  <h3 style="font-size:15px;font-weight:500;color:#e8eaf0;margin:0 0 4px;line-height:1.5;">${n.titleEn}</h3>
  <h4 style="font-size:13px;font-weight:400;color:#8a8fa8;margin:0 0 12px;line-height:1.5;">${n.titleZh || ''}</h4>
  <p style="font-size:13px;color:#8a8fa8;margin:0 0 4px;line-height:1.6;">${n.summaryEn}</p>
  <p style="font-size:12px;color:#555b72;margin:0 0 16px;line-height:1.6;">${n.summaryZh || ''}</p>
  <div style="background:#1c2030;border-radius:8px;padding:14px;margin-bottom:10px;">
    <div style="font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#555b72;font-family:monospace;margin-bottom:8px;">Background / 背景</div>
    <p style="font-size:13px;color:#8a8fa8;margin:0 0 8px;line-height:1.7;">${n.report.backgroundEn}</p>
    <p style="font-size:12px;color:#555b72;margin:0;line-height:1.7;">${n.report.backgroundZh || ''}</p>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
    <div style="background:#1c2030;border-radius:8px;padding:14px;">
      <div style="font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#555b72;font-family:monospace;margin-bottom:6px;">Key Points / 重點</div>
      <ul style="margin:0;padding-left:16px;">${ptsEN}</ul>
      <ul style="margin:6px 0 0;padding-left:16px;opacity:0.7;">${ptsZH}</ul>
    </div>
    <div style="background:#1c2030;border-radius:8px;padding:14px;">
      <div style="font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#555b72;font-family:monospace;margin-bottom:6px;">Industry Impact / 影響</div>
      <p style="font-size:13px;color:#8a8fa8;margin:0 0 8px;line-height:1.7;">${n.report.impactEn}</p>
      <p style="font-size:12px;color:#555b72;margin:0;line-height:1.7;">${n.report.impactZh || ''}</p>
    </div>
  </div>
  <div style="background:#1c2030;border-radius:8px;padding:14px;margin-bottom:12px;">
    <div style="font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#555b72;font-family:monospace;margin-bottom:6px;">Smart Cockpit Opportunity / 商機</div>
    <p style="font-size:13px;color:#8a8fa8;margin:0 0 8px;line-height:1.7;">${n.report.cockpitEn}</p>
    <p style="font-size:12px;color:#555b72;margin:0;line-height:1.7;">${n.report.cockpitZh || ''}</p>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">${sourceLink}<div>${tags}</div></div>
</div>`;
      }).join('');
  }

  const global = news.filter(n => n.region === 'global');
  const na = news.filter(n => n.region === 'na');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Automotive Intelligence — ${dateLabel}</title></head>
<body style="margin:0;padding:0;background:#0d0f12;font-family:'DM Sans',system-ui,sans-serif;">
<div style="max-width:680px;margin:0 auto;padding:32px 24px;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
    <div style="width:36px;height:36px;background:#1fce8a;border-radius:8px;display:flex;align-items:center;justify-content:center;">
      <svg width="20" height="20" viewBox="0 0 18 18" fill="none"><rect x="1" y="6" width="16" height="8" rx="3" fill="#0d1a12"/><circle cx="5" cy="14" r="2" fill="#0d1a12"/><circle cx="13" cy="14" r="2" fill="#0d1a12"/><path d="M3 6L5.5 2H12.5L15 6" stroke="#0d1a12" stroke-width="1.5" stroke-linecap="round"/></svg>
    </div>
    <div>
      <div style="font-size:16px;font-weight:600;color:#e8eaf0;">Automotive Intelligence Daily</div>
      <div style="font-size:11px;color:#555b72;font-family:monospace;">${dateLabel}</div>
    </div>
  </div>
  <p style="font-size:13px;color:#555b72;margin:0 0 4px;border-bottom:1px solid rgba(255,255,255,0.07);padding-bottom:16px;line-height:1.6;">Daily Global & North America Automotive Industry Briefing</p>
  <p style="font-size:12px;color:#555b72;margin:0 0 24px;padding-bottom:16px;line-height:1.6;">每日全球與北美車用產業重點新聞 · 由 Claude AI + Web Search 整理</p>
  ${newsBlock(global, 'Global · 全球')}
  ${newsBlock(na, 'North America · 北美')}
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
    <a href="https://appcommons27.github.io/AppCommons/automotive-intelligence.html" style="color:#1fce8a;font-size:12px;text-decoration:none;font-family:monospace;">View in browser ↗</a>
    <p style="font-size:11px;color:#555b72;margin:8px 0 0;">Automotive Intelligence Daily · Powered by Claude AI + Resend</p>
  </div>
</div>
</body></html>`;
}

async function sendEmail(html) {
  const recipients = TO_EMAIL.split(',').map(e => e.trim());

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'Automotive Intelligence <onboarding@resend.dev>',
      to: recipients,
      subject: `🚗 Automotive Intelligence Daily — ${dateLabel}`,
      html: html
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(err));
  }
  return await res.json();
}

async function main() {
  console.log(`[${dateStr}] Fetching automotive news...`);
  const data = await fetchNews();
  console.log(`Fetched ${data.news.length} news items`);

  console.log('Building email...');
  const html = buildEmailHTML(data.news);

  console.log('Sending email...');
  const result = await sendEmail(html);
  console.log('Email sent:', result.id);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
