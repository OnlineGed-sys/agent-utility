import { execFileSync } from "node:child_process";
import fs from "node:fs";
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const problems = [];
for (const file of files) {
  if (
    /(^|\/)(\.env(?:\..*)?|\.dev\.vars(?:\..*)?|private)(\/|$)/.test(file) &&
    !file.endsWith(".env.example")
  )
    problems.push(`${file}: secret filename`);
  const body = fs.readFileSync(file, "utf8");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(body))
    problems.push(`${file}: private key`);
  if (/(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/.test(body))
    problems.push(`${file}: GitHub credential`);
  if (
    /(?:PRIVATE_KEY|API_KEY|HMAC_SECRET)\s*[:=]\s*["']?(?:0x[0-9a-f]{64}|[A-Za-z0-9_-]{32,})["']?\s*[,;\n]/i.test(
      body,
    )
  )
    problems.push(`${file}: possible embedded secret`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Secret-pattern scan passed for ${files.length} tracked files. This is a heuristic, not a guarantee.`,
  );
