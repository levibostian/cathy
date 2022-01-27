import { githubAuthToken } from "./_.test"
import { v4 as uuid } from "uuid"
import { comment } from "./comment"

describe("comment", () => {
  const repoSlug = "levibostian/cathy"

  it(`given unique comment id, expect create new comment`, async () => {
    const updateId = uuid()

    const actual = await comment(`AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}`, {
      githubToken: githubAuthToken,
      githubRepo: repoSlug,
      githubIssue: 2,
      updateExisting: true,
      updateID: updateId
    })

    expect(actual.updatedPreviousComment).toBe(false)
  })
  it(`given non-unique comment id, expect update comment`, async () => {
    const updateId = uuid()

    let actual = await comment(`RANDOM AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}\n\n${uuid()}`, {
      githubToken: githubAuthToken,
      githubRepo: repoSlug,
      githubIssue: 2,
      updateExisting: true,
      updateID: updateId
    })

    expect(actual.updatedPreviousComment).toBe(false)

    actual = await comment(`RANDOM AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}\n\n${uuid()}`, {
      githubToken: githubAuthToken,
      githubRepo: repoSlug,
      githubIssue: 2,
      updateExisting: true,
      updateID: updateId
    })

    expect(actual.updatedPreviousComment).toBe(true)
  })
})
