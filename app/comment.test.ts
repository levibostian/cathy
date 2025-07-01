import { githubAuthToken } from "./_.test"
import { v4 as uuid } from "uuid"
import { comment, deleteComment, getMessageHeader } from "./comment"
import { findPreviousComment, findPreviousComments } from "./github"

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
    const actualComments = await findPreviousComments(githubAuthToken, githubRepo, githubIssue, getMessageHeader("default"))

    expect(actualComments.some(comment => comment.body.includes(message))).toBe(true)
  })
  it(`given do not update existing, expect multiple comments created`, async () => {
    const messages = [
      `First message, update existing false ${uuid()}`,
      `Second message, update existing false ${uuid()}`
    ]
    const updateID = uuid()

    const actual = await comment(messages[0], {
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      updateID: updateID,
      updateExisting: false
    })
    expect(actual.updatedPreviousComment).toBe(false)

    const actual2 = await comment(messages[1], {
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      updateID: updateID,
      updateExisting: false
    })
    expect(actual2.updatedPreviousComment).toBe(false)

    const actualComments = await findPreviousComments(githubAuthToken, githubRepo, githubIssue, getMessageHeader(updateID))
    expect(actualComments.length).toBe(2)

    expect(actualComments.some(comment => comment.body.includes(messages[0]))).toBe(true)
    expect(actualComments.some(comment => comment.body.includes(messages[1]))).toBe(true)
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

  // Test reproducing "## Update/append over multiple CI runs" section in README. 
  it("given append message true, given previous comment from old CI run, expect replace contents with new message", async () => {
    const updateId1 = uuid()
    const updateId2 = uuid()

    // Let's say the CI runs on a pull request and makes this comment. 
    await comment(`AUTOMATED MESSAGE WITH UPDATE ID: ${updateId1}`, {
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      appendToExisting: true,
      updateID: ['test-coverage', `test-coverage-${updateId1}`]
    })

    // Now, let's say the CI runs again. The updateID is unique for this run. 
    await comment(`AUTOMATED MESSAGE WITH UPDATE ID: ${updateId2}`, {
      githubToken: githubAuthToken,
      githubRepo,
      githubIssue,
      appendToExisting: true,
      updateID: ['test-coverage', `test-coverage-${updateId2}`]
    })

    // We expect that we no longer can find the comment from the first CI run because it was replaced with the second CI run's comment.
    expect(await findPreviousComment(githubAuthToken, githubRepo, githubIssue, getMessageHeader(`test-coverage-${updateId1}`))).toBeUndefined()

    const expectComment = await findPreviousComment(githubAuthToken, githubRepo, githubIssue, getMessageHeader(`test-coverage-${updateId2}`))
    expect(expectComment).toBeDefined()
    expect(expectComment?.body.includes(`AUTOMATED MESSAGE WITH UPDATE ID: ${updateId2}`)).toBe(true)
    expect(expectComment?.body.includes(getMessageHeader(`test-coverage`))).toBe(true)
    expect(expectComment?.body.includes(getMessageHeader(`test-coverage-${updateId1}`))).toBe(false)
    expect(expectComment?.body.includes(getMessageHeader(`test-coverage-${updateId2}`))).toBe(true)
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
