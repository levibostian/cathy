#!/usr/bin/env -S deno run --quiet --allow-all --no-lock

import $ from "jsr:@david/dax"
import * as decafSdk from "jsr:@levibostian/decaf-sdk";

const input = decafSdk.getDeployStepInput()

await $`npm ci`.printCommand()

// update the package.json version before we build as build will define the package we push. 
await $`npm version ${input.nextVersionName} --no-git-tag-version`.printCommand()
await $`npm run compile`.printCommand()

console.log(`Testing npm authentication...`)
await $`npm config set //registry.npmjs.org/:_authToken $NPM_TOKEN`
await $`npm whoami`.printCommand()

// https://github.com/dsherret/dax#providing-arguments-to-a-command
const argsToPushToNpm = [
  `publish`,
  `dist/`
]

if (input.testMode) {
  console.log("Running in test mode. dry-running publish.")
  argsToPushToNpm.push(`--dry-run`)
} 

if ((await $`npx is-it-deployed --package-manager npm --package-name cathy --package-version ${input.nextVersionName}`.noThrow()).code === 0) {
  console.log(`npm package ${input.nextVersionName} is already deployed. Skipping pushing to npm`)  
} else {
  await $`npm ${argsToPushToNpm}`.printCommand()
}

const argsToCreateGithubRelease = [
  `release`,
  `create`,
  input.nextVersionName,
  `--generate-notes`,
  `--latest`,
  `--target`,
  "main",
]

if (input.testMode) {
  console.log("Running in test mode, skipping creating GitHub release.")
  console.log(`Command to create GitHub release: gh ${argsToCreateGithubRelease.join(" ")}`)
} else {
  await $`gh ${argsToCreateGithubRelease}`.printCommand()
}