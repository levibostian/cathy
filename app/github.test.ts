import * as github from "../app/github"
import { githubAuthToken } from "./_.test"

describe("findPreviousComment", () => {
  const repoSlug = "fastlane/fastlane"

  it(`given issue without given comment, expect undefined`, async () => {
    const actual = await github.findPreviousComment(githubAuthToken, repoSlug, 18750, "foo")

    expect(actual).toBeUndefined()
  })
  it(`given issue comment that starts with given input, expect comment id`, async () => {
    const actual = await github.findPreviousComment(
      githubAuthToken,
      repoSlug,
      18750,
      "This issue will be auto-closed because there hasn't been any activity for a few months"
    )

    expect(actual).toEqual({
      id: 900496146, 
      body: "This issue will be auto-closed because there hasn't been any activity for a few months. Feel free to [open a new one](https://github.com/fastlane/fastlane/issues/new) if you still experience this problem :+1:"
    })
  })
  it(`given issue comment that contains given input, expect comment id`, async () => {
    const actual = await github.findPreviousComment(
      githubAuthToken,
      repoSlug,
      18750,
      "Feel free to [open a new one](https://github.com/fastlane/fastlane/issues/new)"
    )

    expect(actual).toEqual({
      id: 900496146, 
      body: "This issue will be auto-closed because there hasn't been any activity for a few months. Feel free to [open a new one](https://github.com/fastlane/fastlane/issues/new) if you still experience this problem :+1:"
    })
  })
})
