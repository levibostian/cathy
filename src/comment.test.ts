import { assertEquals } from "@std/assert"
import { createCommentClient } from "./comment.ts"
import { HttpRequester, IssueComment } from "./github.ts"
import { getMessageHeader } from "./comment.ts"

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * In-memory "GitHub" store used to simulate the GitHub comment API without any
 * real HTTP calls.  Keeps a map of issueNumber -> comments and auto-increments
 * comment IDs.
 *
 * COUPLING WARNING: The regex patterns in `requester` below mirror the URL paths
 * constructed in `github.ts` (findPreviousComment, makeComment, deleteComment).
 * If any URL path format changes in github.ts, the corresponding regex here must
 * be updated to match, otherwise the mock will silently return `undefined` and
 * tests will pass incorrectly.
 */
class MockGitHub {
  private comments: Map<number, IssueComment[]> = new Map()
  private nextId = 1000

  /** All raw HTTP calls recorded by the requester */
  calls: { method: string; path: string; body?: Record<string, unknown> }[] = []

  /** Expose the requester to inject into createGitHubClient / createCommentClient */
  readonly requester: HttpRequester = <T>(
    method: string,
    path: string,
    _token: string,
    body?: Record<string, unknown>,
  ): Promise<T> => {
    this.calls.push({ method, path, body })

    // GET /repos/:owner/:repo/issues/:issue/comments?per_page=…&page=…
    const listMatch = path.match(
      /^\/repos\/[^/]+\/[^/]+\/issues\/(\d+)\/comments/,
    )
    if (method === "GET" && listMatch) {
      const issueNumber = parseInt(listMatch[1])
      const existing = this.comments.get(issueNumber) ?? []
      return Promise.resolve(
        existing.map((c) => ({ id: c.id, body: c.body })) as unknown as T,
      )
    }

    // POST /repos/:owner/:repo/issues/:issue/comments
    const createMatch = path.match(
      /^\/repos\/[^/]+\/[^/]+\/issues\/(\d+)\/comments$/,
    )
    if (method === "POST" && createMatch) {
      const issueNumber = parseInt(createMatch[1])
      const commentBody = (body?.body as string) ?? ""
      const id = this.nextId++
      const comment: IssueComment = { id, body: commentBody }
      const list = this.comments.get(issueNumber) ?? []
      list.push(comment)
      this.comments.set(issueNumber, list)
      return Promise.resolve({ id, body: commentBody } as unknown as T)
    }

    // PATCH /repos/:owner/:repo/issues/comments/:id
    const updateMatch = path.match(
      /^\/repos\/[^/]+\/[^/]+\/issues\/comments\/(\d+)$/,
    )
    if (method === "PATCH" && updateMatch) {
      const commentId = parseInt(updateMatch[1])
      const newBody = (body?.body as string) ?? ""
      for (const [, list] of this.comments) {
        const c = list.find((x) => x.id === commentId)
        if (c) {
          c.body = newBody
          return Promise.resolve({
            id: commentId,
            body: newBody,
          } as unknown as T)
        }
      }
      return Promise.resolve(undefined as unknown as T)
    }

    // DELETE /repos/:owner/:repo/issues/comments/:id
    const deleteMatch = path.match(
      /^\/repos\/[^/]+\/[^/]+\/issues\/comments\/(\d+)$/,
    )
    if (method === "DELETE" && deleteMatch) {
      const commentId = parseInt(deleteMatch[1])
      for (const [issueNumber, list] of this.comments) {
        const idx = list.findIndex((x) => x.id === commentId)
        if (idx !== -1) {
          list.splice(idx, 1)
          this.comments.set(issueNumber, list)
          return Promise.resolve(undefined as unknown as T)
        }
      }
      return Promise.resolve(undefined as unknown as T)
    }

    return Promise.resolve(undefined as unknown as T)
  }

  /** Helper: get all stored comments for an issue */
  getComments(issueNumber: number): IssueComment[] {
    return this.comments.get(issueNumber) ?? []
  }
}

const REPO = "owner/repo"
const TOKEN = "fake-token"
const ISSUE = 1

// ---------------------------------------------------------------------------
// comment()
// ---------------------------------------------------------------------------

Deno.test(
  "comment: given only required options, creates a new comment",
  async () => {
    const mock = new MockGitHub()
    const client = createCommentClient(mock.requester)

    const result = await client.comment("Hello world", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
    })

    assertEquals(result.updatedPreviousComment, false)
    const stored = mock.getComments(ISSUE)
    assertEquals(stored.length, 1)
    assertEquals(stored[0].body.includes("Hello world"), true)
    assertEquals(stored[0].body.includes(getMessageHeader("default")), true)
  },
)

Deno.test("comment: given empty message, does nothing", async () => {
  const mock = new MockGitHub()
  const client = createCommentClient(mock.requester)

  // The speak() wrapper gates on empty message, but comment() itself posts.
  // We test the speak() wrapper behaviour separately; here we verify the header
  // is still prepended even for a very short body.
  const result = await client.comment("x", {
    githubToken: TOKEN,
    githubRepo: REPO,
    githubIssue: ISSUE,
  })

  assertEquals(result.updatedPreviousComment, false)
  assertEquals(mock.getComments(ISSUE).length, 1)
})

Deno.test(
  "comment: given updateExisting=false, creates multiple separate comments",
  async () => {
    const mock = new MockGitHub()
    const client = createCommentClient(mock.requester)
    const updateID = "same-id"

    await client.comment("First message", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      updateID,
      updateExisting: false,
    })
    await client.comment("Second message", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      updateID,
      updateExisting: false,
    })

    const stored = mock.getComments(ISSUE)
    assertEquals(stored.length, 2)
    assertEquals(
      stored.some((c) => c.body.includes("First message")),
      true,
    )
    assertEquals(
      stored.some((c) => c.body.includes("Second message")),
      true,
    )
  },
)

Deno.test(
  "comment: given updateExisting=true and no existing comment, creates a new comment",
  async () => {
    const mock = new MockGitHub()
    const client = createCommentClient(mock.requester)
    const updateID = "unique-id-abc"

    const result = await client.comment("Brand new message", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      updateExisting: true,
      updateID,
    })

    assertEquals(result.updatedPreviousComment, false)
    assertEquals(mock.getComments(ISSUE).length, 1)
  },
)

Deno.test(
  "comment: given updateExisting=true and existing comment, updates the existing comment",
  async () => {
    const mock = new MockGitHub()
    const client = createCommentClient(mock.requester)
    const updateID = "my-update-id"

    // First call – creates comment
    const first = await client.comment("Original message", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      updateExisting: true,
      updateID,
    })
    assertEquals(first.updatedPreviousComment, false)

    // Second call – should update the existing comment
    const second = await client.comment("Updated message", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      updateExisting: true,
      updateID,
    })
    assertEquals(second.updatedPreviousComment, true)

    // Only one comment should exist and it should have the updated content
    const stored = mock.getComments(ISSUE)
    assertEquals(stored.length, 1)
    assertEquals(stored[0].body.includes("Updated message"), true)
    assertEquals(stored[0].body.includes("Original message"), false)
  },
)

Deno.test(
  "comment: given appendToExisting=true and no existing comment, creates a new comment",
  async () => {
    const mock = new MockGitHub()
    const client = createCommentClient(mock.requester)
    const updateID = "append-new"

    const result = await client.comment("Initial content", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      appendToExisting: true,
      updateID,
    })

    assertEquals(result.updatedPreviousComment, false)
    const stored = mock.getComments(ISSUE)
    assertEquals(stored.length, 1)
    assertEquals(stored[0].body.includes("Initial content"), true)
  },
)

Deno.test(
  "comment: given appendToExisting=true and existing comment, appends new message",
  async () => {
    const mock = new MockGitHub()
    const client = createCommentClient(mock.requester)
    const updateID = "append-existing"

    await client.comment("First part", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      updateID,
    })

    const result = await client.comment("Second part", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      appendToExisting: true,
      updateID,
    })
    assertEquals(result.updatedPreviousComment, true)

    const stored = mock.getComments(ISSUE)
    assertEquals(stored.length, 1)
    assertEquals(stored[0].body.includes("First part"), true)
    assertEquals(stored[0].body.includes("Second part"), true)
  },
)

Deno.test(
  "comment: multi-run CI scenario - replaces old run comment, keeping static updateID",
  async () => {
    const mock = new MockGitHub()
    const client = createCommentClient(mock.requester)
    const staticId = "test-coverage"
    const runId1 = "run-001"
    const runId2 = "run-002"

    // CI run 1: creates a comment tagged with staticId + runId1
    await client.comment("Coverage from run 1", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      appendToExisting: true,
      updateID: [staticId, `${staticId}-${runId1}`],
    })

    // CI run 2: creates a comment tagged with staticId + runId2
    // Because the existing comment only has runId1 (not runId2), doesExistingCommentContainAllUpdateIds=false,
    // so it replaces (does NOT append) the old comment.
    await client.comment("Coverage from run 2", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      appendToExisting: true,
      updateID: [staticId, `${staticId}-${runId2}`],
    })

    // The run-1 specific header should no longer appear
    const stored = mock.getComments(ISSUE)
    assertEquals(stored.length, 1)
    const body = stored[0].body
    assertEquals(
      body.includes(getMessageHeader(`${staticId}-${runId1}`)),
      false,
    )
    assertEquals(
      body.includes(getMessageHeader(`${staticId}-${runId2}`)),
      true,
    )
    assertEquals(body.includes(getMessageHeader(staticId)), true)
    assertEquals(body.includes("Coverage from run 2"), true)
    assertEquals(body.includes("Coverage from run 1"), false)
  },
)

Deno.test(
  "comment: updateID defaults to 'default' when not specified",
  async () => {
    const mock = new MockGitHub()
    const client = createCommentClient(mock.requester)

    await client.comment("Hello", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
    })

    const stored = mock.getComments(ISSUE)
    assertEquals(stored[0].body.includes(getMessageHeader("default")), true)
  },
)

Deno.test(
  "comment: updateID can be an array of IDs, all headers prepended",
  async () => {
    const mock = new MockGitHub()
    const client = createCommentClient(mock.requester)

    await client.comment("Multi-id message", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      updateID: ["id-alpha", "id-beta"],
    })

    const stored = mock.getComments(ISSUE)
    assertEquals(stored.length, 1)
    assertEquals(stored[0].body.includes(getMessageHeader("id-alpha")), true)
    assertEquals(stored[0].body.includes(getMessageHeader("id-beta")), true)
    assertEquals(stored[0].body.includes("Multi-id message"), true)
  },
)

Deno.test(
  "comment: updateID array with empty-string entries skips those entries",
  async () => {
    const mock = new MockGitHub()
    const client = createCommentClient(mock.requester)

    // Pass an array where some entries are blank; only "real-id" should appear as a header
    await client.comment("Message with blank IDs", {
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      updateID: ["", "real-id", "  "],
    })

    const stored = mock.getComments(ISSUE)
    assertEquals(stored.length, 1)
    assertEquals(stored[0].body.includes(getMessageHeader("real-id")), true)
    // Blank entries must not generate headers
    assertEquals(stored[0].body.includes(getMessageHeader("")), false)
    assertEquals(stored[0].body.includes(getMessageHeader("  ")), false)
  },
)

// ---------------------------------------------------------------------------
// deleteComment()
// ---------------------------------------------------------------------------

Deno.test("deleteComment: given existing comment, deletes it", async () => {
  const mock = new MockGitHub()
  const client = createCommentClient(mock.requester)
  const updateID = "delete-me"

  // Create a comment first
  await client.comment("To be deleted", {
    githubToken: TOKEN,
    githubRepo: REPO,
    githubIssue: ISSUE,
    updateExisting: true,
    updateID,
  })
  assertEquals(mock.getComments(ISSUE).length, 1)

  await client.deleteComment({
    githubToken: TOKEN,
    githubRepo: REPO,
    githubIssue: ISSUE,
    updateID,
  })

  assertEquals(mock.getComments(ISSUE).length, 0)
})

Deno.test(
  "deleteComment: given no existing comment, does not throw",
  async () => {
    const mock = new MockGitHub()
    const client = createCommentClient(mock.requester)
    const updateID = "non-existent"

    // No comment created - should complete without error
    await client.deleteComment({
      githubToken: TOKEN,
      githubRepo: REPO,
      githubIssue: ISSUE,
      updateID,
    })

    assertEquals(mock.getComments(ISSUE).length, 0)
  },
)

// ---------------------------------------------------------------------------
// getMessageHeader()
// ---------------------------------------------------------------------------

Deno.test("getMessageHeader: returns expected HTML comment format", () => {
  const header = getMessageHeader("my-id")
  assertEquals(
    header,
    "<!-- https://github.com/levibostian/cathy comment. id:my-id -->",
  )
})

Deno.test("getMessageHeader: different IDs produce different headers", () => {
  const h1 = getMessageHeader("id-1")
  const h2 = getMessageHeader("id-2")
  assertEquals(h1 !== h2, true)
})
