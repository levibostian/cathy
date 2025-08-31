#!/usr/bin/env -S deno run --quiet --allow-all --no-lock

import $ from "jsr:@david/dax"
import * as decafSdk from "jsr:@levibostian/decaf-sdk";

const input = decafSdk.getLatestReleaseStepInput()

// It's a good idea to handle when there have not yet been a github release made, 
// indicating the code has never been deployed before. 
// But this existing project has been deployed so we only handle that. 
const latestRelease: {
  isLatest: boolean
  isPrerelease: boolean
  name: string
  tagName: string
} = JSON.parse(await $`gh release list --exclude-drafts --order desc --json name,isLatest,isPrerelease,tagName --jq '.[0]'`
  .text())

const latestReleaseVersionName = latestRelease.name
console.log(`Latest release version found on GitHub Releases: ${latestReleaseVersionName}, tag: ${latestRelease.tagName}`)

// Find the commit that matches the github release made. this tells decaf how to find the commits that have been created since 
// last deployment. This is important in case there is a failed deployment and we want to re-run the deployment to try again. 
const commitMatchingLatestRelease = input.gitCommitsAllLocalBranches["main"]?.find(commit => commit.tags?.includes(latestRelease.tagName))

console.log(`Commit matching latest release found: ${commitMatchingLatestRelease?.sha} - ${commitMatchingLatestRelease?.messageLines[0]}`)

decafSdk.setLatestReleaseStepOutput({
  versionName: latestReleaseVersionName,
  commitSha: commitMatchingLatestRelease!.sha
})