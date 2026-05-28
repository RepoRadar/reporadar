import type { BlogPost } from "./index";

export const post: BlogPost = {
  slug: "meet-the-founders",
  title: "Meet the founders",
  date: "2026-05-28",
  summary:
    "RepoRadar was built by three people who teamed up at a hackathon and split the work evenly. Here is who we are.",
  body: `
RepoRadar began as a six-hour hackathon build, but it was made by three people who had never worked together before that morning. We split the work evenly and led it together: three co-founders, three co-leads. One of us lives inside the Cloudflare platform. One builds agentic AI and ships open source. One has been writing code into running systems since before the web existed. The radar you tune is what happens when those three angles point at the same problem.

![Christo and Craig building RepoRadar in San Francisco while Priyanshu joins remotely](/blog-assets/team-building-reporadar.jpg "Christo and Craig heads-down in San Francisco, with Priyanshu building remotely.")

## Christo Roberts

Christo is a Principal Solutions Engineer at Cloudflare with more than 25 years in the field, including seven-plus years at Akamai before this. By day he leads technical strategy on Cloudflare's largest and most complex enterprise accounts. By night he builds AI products by running fleets of autonomous agents that brainstorm, spec, and ship while he sleeps. He builds on the same Cloudflare Developer Platform he sells (Workers, Pages, D1, AI), which makes him an unusually credible guide to it. RepoRadar is one of those builds. So is Blogcast.io, which turns written posts into narrated audio. He also does real security research, with conference talks on account-takeover and proxy-abuse attacks. His motto for all of it: agents all day, every day.

Find him: [letsgochristo.com](https://letsgochristo.com/), [LinkedIn](https://www.linkedin.com/in/christopherbroberts/), [X](https://x.com/letsgochristo/), [YouTube](https://www.youtube.com/@letsgochristo), [Instagram](https://www.instagram.com/letsgochristo/), [TikTok](https://www.tiktok.com/@letsgochristo).

## Priyanshu Harshbodhi

Priyanshu builds agentic AI, the kind that does things rather than just answering. His projects have a habit of being unusually concrete. DroneGPT flies a real Tello drone from plain-language commands. During Google Summer of Code 2025 with Rocket.Chat, he built a natural-language bridge to legacy email so you can run Gmail or Outlook from inside a chat window. He also wrote a GitHub crawler that ingests 100,000 repositories in under ten minutes, which is exactly the kind of systems work a project built on repo data needs. He keeps Paul Graham's line about hackers and painters in his bio, and it shows in how he works. He is an AI engineer at Truxt.ai, based in the Delhi area.

Find him: [LinkedIn](https://www.linkedin.com/in/priyanshu-harshbodhi), [X](https://x.com/priyanhb), [GitHub](https://github.com/priyanshuharshbodhi1).

## Craig Latta

Craig has been writing code live for dynamic systems his whole career. He studied music composition and computer science at UC Berkeley, where he picked up Smalltalk as an improvisation practice, treating code and music as the same act. Around 1990 he founded NetJam, a networked music-collaboration project, and published a paper on it in the Leonardo Music Journal. He plays theremin. He spent years shrinking running Smalltalk systems down to tiny live images, and worked as an AI researcher at the IBM Watson Research Lab. Today he runs Black Page Digital and is building Orbit, an agentic pair-programming agent for livecoding that lets an AI browse and change a running program as if it were a filesystem. He brought the deepest "systems are living things" instinct to the team, plus a standing interest in mechanistic interpretability.

Find him: [GitHub](https://github.com/ccrraaiigg), [thisContext](https://thiscontext.com/), [Black Page Digital](https://blackpagedigital.com/), [LinkedIn](https://www.linkedin.com/in/ccrraaiigg).

## One radar, three builders

We each took an equal share of RepoRadar and we each led it. If you want to talk about repos, agents, livecoding, security, or anything we built, the links above are the best way to reach us.
`.trim(),
};
