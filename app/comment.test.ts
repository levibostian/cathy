import { githubAuthToken } from "./_.test"
import { v4 as uuid } from "uuid"
import { comment, deleteComment, getMessageHeader } from "./comment"
import { findPreviousComment } from "./github"

const githubRepo = "levibostian/cathy"
const githubIssue = 2

describe("comment", () => {
  it(`given only required options, expect create comment`, async () => {
    const message = `AUTOMATED MESSAGE WITH UPDATE ID: ${uuid()}`

    const actual = await comment(message, {
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue
    })

    expect(actual.updatedPreviousComment).toBe(false)
    const actualComment = await findPreviousComment(githubAuthToken, githubRepo, githubIssue, getMessageHeader("default")) 

    expect(actualComment?.body.includes(message)).toBe(true)
  })

  it(`given unique comment id, expect create new comment`, async () => {
    const updateId = uuid()

    const actual = await comment(`AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}`, {
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      updateExisting: true,
      updateID: updateId
    })

    expect(actual.updatedPreviousComment).toBe(false)
  })
  it(`given non-unique comment id, expect update comment`, async () => {
    const updateId = uuid()

    let actual = await comment(
      `RANDOM AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}\n\n${uuid()}`,
      {
        githubToken: githubAuthToken,
        githubRepo,
        githubIssue,
        updateExisting: true,
        updateID: updateId
      }
    )

    expect(actual.updatedPreviousComment).toBe(false)

    actual = await comment(`RANDOM AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}\n\n${uuid()}`, {
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      updateExisting: true,
      updateID: updateId
    })

    expect(actual.updatedPreviousComment).toBe(true)
  })
  it("given append message true, given no previous comment, expect new comment", async () => {
    const updateId = uuid()

    const actual = await comment(`AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}`, {
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      appendToExisting: true,
      updateID: updateId
    })

    expect(actual.updatedPreviousComment).toBe(false)
    const actualComment = await findPreviousComment(githubAuthToken, githubRepo, githubIssue, getMessageHeader(updateId))

    expect(actualComment?.body.includes(`AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}`)).toBe(true)
  })
  it("given append message true, given previous comment, expect new comment with previous message", async () => {
    const updateId = uuid()

    await comment(`AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}`, {
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      updateExisting: true,
      updateID: updateId
    })

    const actual = await comment(`APPENDED AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}`, {
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      appendToExisting: true,
      updateID: updateId
    })    
    expect(actual.updatedPreviousComment).toBe(true)

    const actualComment = await findPreviousComment(githubAuthToken, githubRepo, githubIssue, getMessageHeader(updateId))
    expect(actualComment?.body.includes(`AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}`)).toBe(true)
    expect(actualComment?.body.includes(`APPENDED AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}`)).toBe(true)
  })
})

describe("deleteComment", () => {
  it(`given a previous comment, expect it get deleted`, async () => {
    const updateId = uuid()

    await comment(`AUTOMATED MESSAGE WITH UPDATE ID: ${updateId}`, {
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      updateExisting: true,
      updateID: updateId
    })
  
    expect(await findPreviousComment(githubAuthToken, githubRepo, githubIssue, getMessageHeader(updateId))).toBeDefined()

    await deleteComment({
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      updateID: updateId
    })

    expect(await findPreviousComment(githubAuthToken, githubRepo, githubIssue, getMessageHeader(updateId))).toBeUndefined()  
  })

  it(`given comment does not exist, expect no errors`, async () => {
    const updateId = uuid()

    expect(await findPreviousComment(githubAuthToken, githubRepo, githubIssue, getMessageHeader(updateId))).toBeUndefined()      

    await deleteComment({
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      updateID: updateId
    })

    expect(await findPreviousComment(githubAuthToken, githubRepo, githubIssue, getMessageHeader(updateId))).toBeUndefined()  
  })
})
