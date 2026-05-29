import type { BlogPost } from "./index";

export const post: BlogPost = {
  slug: "reporadar-2nd-place-generative-ui-hackathon",
  title: "RepoRadar took 2nd in the Generative UI Global Hackathon",
  date: "2026-05-28",
  summary:
    "RepoRadar placed 2nd out of 302 teams across all 17 cities in the AI Tinkerers Generative UI Global Hackathon. Here is what we built and what it won.",
  linkedinEmbedUrl:
    "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7462949071473905664",
  linkedinEmbedHeight: 1404,
  body: `
RepoRadar took **2nd place** in the AI Tinkerers Generative UI Global Hackathon, finishing second out of 302 teams across all 17 host cities.

![Craig and Christo building RepoRadar together in San Francisco](/blog-assets/team-building-reporadar.jpg "Craig, Christo, Priyanshu (remote), and Claude. Brainstorming, deciding, planning, designing, building, shipping, iterating. Five to six hours nonstop, a mile a minute.")

The challenge ran on May 9, 2026: one synchronized six-hour build session worldwide, presented by AI Tinkerers with Google DeepMind, CopilotKit, Manufact, LangChain, and Daytona. The brief was blunt. For three years, most "AI-powered" apps have been a chatbot in a trench coat, text in and text out. This one asked for the opposite: agents that render complete, interactive interfaces on the fly. Forms, dashboards, approval flows, whole applications generated from agent output. The open stack was A2UI from Google DeepMind, AG-UI and CopilotKit, and MCP Apps.

We built RepoRadar in those six hours in San Francisco, and it is still live and growing at [reporadar.io](https://reporadar.io).

![The Generative UI Hackathon in San Francisco during demos](/blog-assets/genui-hackathon-sf-room.jpg "Show and tell in the San Francisco room, one of 17 cities building at once.")

## Why it placed

The organizers described it as the most engineering ambition delivered in the cohort, and a real workflow unlock rather than a demo. In their words: generative UI for discovering the top 10,000 GitHub repos, multi-modal navigation, deployed sub-apps via Gemini-emitted A2UI, and all three hackathon protocols shipped. Under the hood that is:

- **Four interconnected Cloudflare Workers** handling scoring, deploys, chat, and data.
- **All three named protocols in production code**: A2UI for agent-rendered surfaces, AG-UI and CopilotKit for agent-to-frontend transport, and MCP Apps via mcp-use.
- **Multi-modal navigation**: tune your results with the decagon radar, the sliders, or your voice.

For the longer story of how the scoring and the AI-rendered surfaces work, see [why we built RepoRadar](/blog/why-we-built-reporadar).

## Built by three

RepoRadar was an even three-way effort. Christo Roberts, Priyanshu Harshbodhi, and Craig Latta each took an equal share and co-led the build, and Craig was central to it the whole way, from the livecoding instincts to the systems thinking.

One thing to set straight: the official winners announcement names only Christo and Priyanshu. Craig was left off, and he should not have been. He is an equal co-founder and co-lead of RepoRadar, and we have asked the organizers to add him back. You can meet all three of us in [meet the founders](/blog/meet-the-founders).

## What it won

- Meta Ray-Bans, one pair for each of the three of us.
- $5,000 in Google Cloud credits.
- $1,000 in LangSmith credits.
- Sponsor swag.

![Hudson wearing Ray-Ban Meta glasses at the hackathon](/blog-assets/hudson-raybans.jpg "Hudson trying on Ray-Ban Metas for the first time, borrowed from someone from Meta we met at the event. We had no idea we would win a pair each as the runner-up prize.")

## The announcement

AI Tinkerers announced the three winners on LinkedIn. You can [read the full post here](https://www.linkedin.com/posts/genuihackathon-ugcPost-7462949071473905664-KPtY).

Thanks to AI Tinkerers and the sponsors who powered it (Google DeepMind, CopilotKit, Manufact, LangChain, and Daytona), and to every team that shipped on May 9. Out of 302 teams and 198 projects that made the buzzer, landing in the top three still feels surreal. We are just getting started.
`.trim(),
};
