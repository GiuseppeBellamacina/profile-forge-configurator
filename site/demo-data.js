// Deterministic demo profile, same shape as fetchProfile() in src/github.js. Used until the user loads their own data.
export function demoProfile() {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const today = new Date().toISOString().slice(0, 10);
  const days = [];
  for (let d = new Date("2016-03-01T00:00:00Z"); d.toISOString().slice(0, 10) <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    const busy = Math.sin(d.getTime() / 86_400_000 / 40) > -0.6;
    const n = busy && rnd() > (wd === 0 || wd === 6 ? 0.6 : 0.12) ? Math.floor(rnd() * rnd() * 14) + 1 : 0;
    days.push([d.toISOString().slice(0, 10), n]);
  }
  days[days.length - 1][1] = 3;
  const L = (name, color, size) => ({ name, color, size });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7aa2f7"/><stop offset="1" stop-color="#bb9af7"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="82" r="36" fill="#fff" fill-opacity=".9"/><path d="M30 200c6-48 40-68 70-68s64 20 70 68z" fill="#fff" fill-opacity=".9"/></svg>`;
  return {
    name: "Ada Demo", login: "ada-demo", avatar: `data:image/svg+xml;base64,${btoa(svg)}`,
    createdAt: "2016-03-01T00:00:00Z", earliest: "2016-03-01T00:00:00Z",
    followers: 128, organizations: 3, prs: 214, issues: 63, contributedTo: 41, repoCount: 37, stars: 486,
    commits: 5230, commitsByYear: { 2024: 640, 2025: 710, 2026: 520 }, reviews: 58,
    mergedPrs: 171, discussionsStarted: 12, discussionsAnswered: 9,
    repos: [
      { name: "forge-api", stars: 210, isFork: false, languages: [L("Python", "#3572A5", 820_000), L("Shell", "#89e051", 12_000)] },
      { name: "web-ui", stars: 120, isFork: false, languages: [L("TypeScript", "#3178c6", 610_000), L("CSS", "#563d7c", 90_000), L("HTML", "#e34c26", 40_000)] },
      { name: "fast-core", stars: 96, isFork: false, languages: [L("Rust", "#dea584", 420_000)] },
      { name: "tooling", stars: 40, isFork: false, languages: [L("Go", "#00ADD8", 260_000), L("Python", "#3572A5", 60_000)] },
      { name: "notebooks", stars: 20, isFork: false, languages: [L("Jupyter Notebook", "#DA5B0B", 900_000), L("Python", "#3572A5", 80_000)] },
      { name: "engine", stars: 0, isFork: false, languages: [L("C++", "#f34b7d", 180_000), L("JavaScript", "#f1e05a", 70_000)] },
    ],
    days,
  };
}
