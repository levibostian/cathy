#!/usr/bin/env -S deno run --quiet --allow-all --no-lock

import * as decafSdk from "jsr:@levibostian/decaf-sdk";
import * as semver from "jsr:@std/semver";

const input = decafSdk.getNextReleaseVersionStepInput()
const latestReleaseSemver = semver.parse(input.lastRelease!.versionName)

const allPossibleSemanticVersions = input.gitCommitsSinceLastRelease.map(commit => {
  const commitMessage = commit.messageLines[0].slice(0, 50)

  // regex pattern matches <type>!: <description>
  if (commitMessage.match(/[a-z]+!: .*/)) {
    console.log(`major version bump => ${commitMessage}`)
    return semver.increment(latestReleaseSemver, "major")
  } else if (commitMessage.startsWith("feat:")) {
    console.log(`minor version bump => ${commitMessage}`)
    return semver.increment(latestReleaseSemver, "minor")
  } else if (commitMessage.startsWith("fix:")) {
    console.log(`patch version bump => ${commitMessage}`)
    return semver.increment(latestReleaseSemver, "patch")
  } else {
    return undefined
  }
}).filter(Boolean) as semver.SemVer[] // remove undefined

if (allPossibleSemanticVersions.length === 0) {
  console.log(`None of the commits caused a version bump. No release needed!`)
  Deno.exit(0)
}

const nextVersion = semver.maxSatisfying(allPossibleSemanticVersions, semver.parseRange(">=0.0.1"));
const nextVersionString = semver.format(nextVersion!);

console.log(`Next version determined: ${nextVersionString} based on commits since last release.`)

decafSdk.setNextReleaseVersionStepOutput({
  version: nextVersionString
})