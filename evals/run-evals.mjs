#!/usr/bin/env node
/** LLM output-quality evals (L3/L9/L10). Judge = gpt-4o-mini via llmProxy.
 *  Run: npm run evals   (needs dev creds; ~7 small LLM calls) */
import fs from "fs";
const F = JSON.parse(fs.readFileSync(new URL("./fixtures.json", import.meta.url)));
const KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_2-p_Y-4CVibcDK1b_g_X_g_ZcqbY_OO";
const URL_ = process.env.VITE_SUPABASE_URL || "https://bwjfglerixssibenkjse.supabase.co";

const auth = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: "POST",
  headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.RX_ADMIN_EMAIL, password: process.env.RX_ADMIN_PASSWORD }) }).then(r => r.json());
const AT = auth.access_token;

async function llm(prompt, system, json = true) {
  const r = await fetch(`${URL_}/functions/v1/llmProxy`, { method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${AT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, system, response_format: json ? "json" : "text", task: "eval" }) }).then(r => r.json());
  if (r.error) throw new Error(`llmProxy: ${String(r.error).slice(0, 120)}`);
  return json ? r.parsed : r.text;
}

process.on("unhandledRejection", (e) => { console.error("PROVIDER ERROR:", e.message); process.exit(2); });
let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`); ok ? pass++ : fail++; };

// 1. Matching: model scores; assert calibration (good >> bad, correct bands)
const scores = {};
for (const m of F.match) {
  const out = await llm(`JOB:\n${m.job}\n\nCANDIDATE:\n${m.candidate}`,
    'Score candidate fit for the job 0-100. Return JSON {"score": <int>, "reason": "<short>"}');
  scores[m.id] = out?.score ?? -1;
  check(`match/${m.id} scored ${out?.score}`, m.expect === "high" ? out?.score >= 70 : out?.score <= 40, out?.reason?.slice(0, 60));
}
check("match/calibration good>bad by 30+", scores["good-fit"] - scores["bad-fit"] >= 30, `${scores["good-fit"]} vs ${scores["bad-fit"]}`);

// 2. Drafting: generate then judge against rubric
const d = F.draft[0];
const draft = await llm(`Write a recruiter outreach email.\nROLE: ${d.job}\nCANDIDATE: ${d.candidate}`,
  "You write concise professional recruiter outreach emails.", false);
const judged = await llm(`RUBRIC: ${d.rubric}\n\nEMAIL:\n${draft}`,
  'Judge the email against the rubric. Return JSON {"score": <1-5>, "violations": ["..."]}');
check(`draft/${d.id} judge=${judged?.score}/5`, (judged?.score ?? 0) >= 4, (judged?.violations || []).join("; ").slice(0, 80));

// 3. Classification: matches _shared/classifier.ts contract
for (const c of F.classify) {
  const out = await llm(`Classify this message:\n\n${c.text}`,
    'Classify as one of "job" | "resume" | "reply" | "spam" | "unknown". Return JSON {"classification": "..."}');
  check(`classify/${c.id} → ${out?.classification}`, out?.classification === c.expect);
}

console.log(`\nEVALS: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
