import { spawnSync } from "node:child_process";
const suites = [
  "engine",
  "foods",
  "photo",
  "store",
  "smoke",
  "pwa-surface",
  "service-worker",
];
for (const name of suites) {
  const result = spawnSync(process.execPath, [`tests/${name}.mjs`], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`PASS all ${suites.length} test suites`);
