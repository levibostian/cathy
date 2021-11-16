import * as github from "../app/github"
import { githubAuthToken } from "./_.test"

describe("findPreviousComment", () => {
  const repoSlug = "fastlane/fastlane"

  it(`given issue without given comment, expect undefined`, async () => {
    const actual = await github.findPreviousComment(githubAuthToken, repoSlug, 18750, "foo")

    expect(actual).toBeUndefined()
  })
  it(`given issue with given comment, expect comment id`, async () => {
    const actual = await github.findPreviousComment(
      githubAuthToken,
      repoSlug,
      18750,
      "This issue will be auto-closed because there hasn't been any activity for a few months"
    )

    expect(actual).toBe(900496146)
  })
  it(`given issue that contains comment but does not start with given comment, expect false`, async () => {
    const actual = await github.findPreviousComment(
      githubAuthToken,
      repoSlug,
      18750,
      "Feel free to open a new one if you still experience this problem"
    )

    expect(actual).toBeUndefined()
  })
})
