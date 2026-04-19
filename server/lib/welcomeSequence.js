// Three-email welcome sequence. Copy can be edited here without touching code.
// Markdown body \u2014 rendered through the same newsletterHtml wrapper on send.

const EMAILS = [
  {
    key: 'welcome_1',
    day_offset: 0,
    subject: 'Welcome \u2014 here\u2019s what to expect',
    markdown_body: `Hey {{name}},

Welcome to the list.

Quick on who this is from:

I'm Roodjino Ch\u00e9rilus, Managing Director of Banj Media. I write about attention, systems, leverage, and execution \u2014 the four things that actually move markets in a world where AI made speed a commodity and judgment the premium.

The thesis I keep coming back to: **The Architect Problem.** Founder invisibility is a pricing tax on the company. The market doesn't pay premium for faceless competence. It pays for the person it can name.

You'll hear from me most weeks. Sometimes deep-dive essays, sometimes a sharp observation, sometimes a case study from what we're building at Banj.

**What to do next:** hit reply and tell me what you're working on. Two sentences. I read everything.

Roodjino`,
  },
  {
    key: 'welcome_2',
    day_offset: 3,
    subject: 'The frameworks, in one email',
    markdown_body: `Hey {{name}},

Day 3. Here's the orientation I owe you.

**The core frameworks I return to:**

- **The Architect Problem** \u2014 Your company is priced on who the market can name. Invisible founders pay a monthly tax.
- **Distribution > Production** \u2014 The bottleneck shifted. Making content is no longer the edge. Earning attention is.
- **AI exposes weak businesses faster** \u2014 Speed became commodity. Judgment became the premium. If your moat was being faster, you have six months.
- **Legibility vs expertise** \u2014 Expertise alone doesn't move markets. Legibility is what makes expertise commercially operative.
- **Systems over talent** \u2014 Haiti punishes weak systems faster. Build the system that survives the people.

If one of these resonates, that's the one I want you to pull on first.

**Reply with the framework that hit hardest.** I'll send you the two deepest pieces I've written on it.

Roodjino`,
  },
  {
    key: 'welcome_3',
    day_offset: 7,
    subject: 'If this is you, let\u2019s talk',
    markdown_body: `Hey {{name}},

Day 7. Final orientation email, then I\u2019ll just show up with the newsletter.

Quick filter \u2014 most of what I write is relevant if you\u2019re one of these:

- You run or lead a company that needs its founder to become the primary revenue engine, not a back-office operator.
- You\u2019re trying to build distribution-led positioning from a market most investors underestimate.
- You\u2019re watching AI collapse your time-to-parity advantage and need to find the new defensibility.
- You\u2019re building media infrastructure, not just content.

If any of that is you, here\u2019s what\u2019s on offer:

- **You stay on the list.** Free. Most of what matters goes out here.
- **You reply to this email.** I'll look at what you're building and tell you what I'd do if I were in your seat. No pitch.
- **You want to go deeper.** Banj Media does communication-infrastructure retainers for a small number of clients. If you want to explore that, reply "tell me more" and we'll set up 20 minutes.

Either way \u2014 glad you're here.

Roodjino`,
  },
];

function personalize(md, subscriber) {
  const name = (subscriber.name || '').split(' ')[0] || 'friend';
  return md.replace(/\{\{name\}\}/g, name);
}

module.exports = { EMAILS, personalize };
