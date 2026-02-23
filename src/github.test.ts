import { assertEquals } from "@std/assert"
import { createGitHubClient, HttpRequester, IssueComment } from "./github.ts"

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * GitHub REST API response shape for a single issue comment.
 * Based on: https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28
 */
function makeGitHubCommentResponse(id: number, body: string) {
  return {
    id,
    node_id: `IC_${id}`,
    url: `https://api.github.com/repos/owner/repo/issues/comments/${id}`,
    html_url: `https://github.com/owner/repo/issues/1#issuecomment-${id}`,
    body,
    user: {
      login: "octocat",
      id: 1,
      node_id: "MDQ6VXNlcjE=",
      avatar_url: "https://github.com/images/error/octocat_happy.gif",
      gravatar_id: "",
      url: "https://api.github.com/users/octocat",
      html_url: "https://github.com/octocat",
      type: "User",
      site_admin: false,
    },
    created_at: "2022-01-01T00:00:00Z",
    updated_at: "2022-01-01T00:00:00Z",
    issue_url: "https://api.github.com/repos/owner/repo/issues/1",
    author_association: "COLLABORATOR",
    reactions: {
      url: "https://api.github.com/repos/owner/repo/issues/comments/1/reactions",
      total_count: 0,
      "+1": 0,
      "-1": 0,
      laugh: 0,
      hooray: 0,
      confused: 0,
      heart: 0,
      rocket: 0,
      eyes: 0,
    },
  }
}

type RecordedCall = {
  method: string
  path: string
  body?: Record<string, unknown>
}

/**
 * Builds a mock requester from a map of path -> response data.
 * Records all calls so tests can assert on them.
 */
function makeMockRequester(
  responses: Map<string, unknown>,
  calls: RecordedCall[] = [],
): HttpRequester {
  return <T>(
    method: string,
    path: string,
    _token: string,
    body?: Record<string, unknown>,
  ): Promise<T> => {
    calls.push({ method, path, body })
    // Strip query string for lookup
    const key = path.split("?")[0]
    const fullKey = path
    const response = responses.has(fullKey) ? responses.get(fullKey) : responses.get(key)
    return Promise.resolve(response as T)
  }
}

// ---------------------------------------------------------------------------
// findPreviousComment
// ---------------------------------------------------------------------------

Deno.test(
  "findPreviousComment: given issue without matching comment, returns undefined",
  async () => {
    const responses = new Map<string, unknown>([
      [
        "/repos/owner/repo/issues/1/comments",
        [makeGitHubCommentResponse(100, "Unrelated comment")],
      ],
    ])
    const client = createGitHubClient(makeMockRequester(responses))

    const result = await client.findPreviousComment(
      "token",
      "owner/repo",
      1,
      "foo",
    )

    assertEquals(result, undefined)
  },
)

Deno.test(
  "findPreviousComment: given issue with matching comment, returns comment",
  async () => {
    const commentBody = "This is the matching comment"
    const responses = new Map<string, unknown>([
      [
        "/repos/owner/repo/issues/1/comments",
        [makeGitHubCommentResponse(42, commentBody)],
      ],
    ])
    const client = createGitHubClient(makeMockRequester(responses))

    const result = await client.findPreviousComment(
      "token",
      "owner/repo",
      1,
      "matching comment",
    )

    assertEquals(result, { id: 42, body: commentBody })
  },
)

Deno.test(
  "findPreviousComment: given comment that contains the search string (not just starts with), returns comment",
  async () => {
    const commentBody = "Some prefix text. And then: the matching content in the middle."
    const responses = new Map<string, unknown>([
      [
        "/repos/owner/repo/issues/1/comments",
        [makeGitHubCommentResponse(99, commentBody)],
      ],
    ])
    const client = createGitHubClient(makeMockRequester(responses))

    const result = await client.findPreviousComment(
      "token",
      "owner/repo",
      1,
      "matching content in the middle",
    )

    assertEquals(result, { id: 99, body: commentBody })
  },
)

Deno.test(
  "findPreviousComment: given multiple comments, returns the first matching one",
  async () => {
    const responses = new Map<string, unknown>([
      [
        "/repos/owner/repo/issues/1/comments",
        [
          makeGitHubCommentResponse(10, "First unrelated comment"),
          makeGitHubCommentResponse(20, "Second comment with target content"),
          makeGitHubCommentResponse(
            30,
            "Third comment with target content too",
          ),
        ],
      ],
    ])
    const client = createGitHubClient(makeMockRequester(responses))

    const result = await client.findPreviousComment(
      "token",
      "owner/repo",
      1,
      "target content",
    )

    assertEquals(result, {
      id: 20,
      body: "Second comment with target content",
    })
  },
)

Deno.test(
  "findPreviousComment: given empty comment list, returns undefined",
  async () => {
    const responses = new Map<string, unknown>([
      ["/repos/owner/repo/issues/1/comments", []],
    ])
    const client = createGitHubClient(makeMockRequester(responses))

    const result = await client.findPreviousComment(
      "token",
      "owner/repo",
      1,
      "anything",
    )

    assertEquals(result, undefined)
  },
)

Deno.test(
  "findPreviousComment: with onFoundComment callback returning false, stops early and returns comment",
  async () => {
    const responses = new Map<string, unknown>([
      [
        "/repos/owner/repo/issues/1/comments",
        [
          makeGitHubCommentResponse(1, "matching comment A"),
          makeGitHubCommentResponse(2, "matching comment B"),
        ],
      ],
    ])
    const client = createGitHubClient(makeMockRequester(responses))
    const found: IssueComment[] = []

    const result = await client.findPreviousComment(
      "token",
      "owner/repo",
      1,
      "matching comment",
      (c) => {
        found.push(c)
        return false // stop after first match
      },
    )

    assertEquals(found.length, 1)
    assertEquals(result, { id: 1, body: "matching comment A" })
  },
)

Deno.test(
  "findPreviousComment: with onFoundComment callback returning true, collects all matches",
  async () => {
    const responses = new Map<string, unknown>([
      [
        "/repos/owner/repo/issues/1/comments",
        [
          makeGitHubCommentResponse(1, "matching comment A"),
          makeGitHubCommentResponse(2, "unrelated"),
          makeGitHubCommentResponse(3, "matching comment C"),
        ],
      ],
    ])
    const client = createGitHubClient(makeMockRequester(responses))
    const found: IssueComment[] = []

    await client.findPreviousComment(
      "token",
      "owner/repo",
      1,
      "matching comment",
      (c) => {
        found.push(c)
        return true // keep searching
      },
    )

    assertEquals(found.length, 2)
    assertEquals(found[0], { id: 1, body: "matching comment A" })
    assertEquals(found[1], { id: 3, body: "matching comment C" })
  },
)

Deno.test(
  "findPreviousComment: paginates when first page is full (100 comments), finds match on second page",
  async () => {
    const PER_PAGE = 100
    // Build a full first page of non-matching comments
    const page1 = Array.from(
      { length: PER_PAGE },
      (_, i) => makeGitHubCommentResponse(i + 1, `unrelated comment ${i + 1}`),
    )
    // Second page has the matching comment
    const page2 = [makeGitHubCommentResponse(200, "needle in the haystack")]

    const responses = new Map<string, unknown>([
      [
        `/repos/owner/repo/issues/1/comments?per_page=${PER_PAGE}&page=1`,
        page1,
      ],
      [
        `/repos/owner/repo/issues/1/comments?per_page=${PER_PAGE}&page=2`,
        page2,
      ],
    ])
    const client = createGitHubClient(makeMockRequester(responses))

    const result = await client.findPreviousComment(
      "token",
      "owner/repo",
      1,
      "needle in the haystack",
    )

    assertEquals(result, { id: 200, body: "needle in the haystack" })
  },
)

Deno.test(
  "findPreviousComment: stops paginating when page returns fewer than 100 comments and no match found",
  async () => {
    const PER_PAGE = 100
    const page1 = Array.from({ length: PER_PAGE }, (_, i) => makeGitHubCommentResponse(i + 1, `unrelated ${i + 1}`))
    const page2 = [makeGitHubCommentResponse(200, "still unrelated")]

    const responses = new Map<string, unknown>([
      [
        `/repos/owner/repo/issues/1/comments?per_page=${PER_PAGE}&page=1`,
        page1,
      ],
      [
        `/repos/owner/repo/issues/1/comments?per_page=${PER_PAGE}&page=2`,
        page2,
      ],
    ])
    const calls: RecordedCall[] = []
    const client = createGitHubClient(makeMockRequester(responses, calls))

    const result = await client.findPreviousComment(
      "token",
      "owner/repo",
      1,
      "needle",
    )

    assertEquals(result, undefined)
    // Should have fetched page 1 and page 2, then stopped (page 2 had < 100 results)
    assertEquals(calls.length, 2)
  },
)

// ---------------------------------------------------------------------------
// findPreviousComments
// ---------------------------------------------------------------------------

Deno.test(
  "findPreviousComments: returns all comments containing the search string",
  async () => {
    const responses = new Map<string, unknown>([
      [
        "/repos/owner/repo/issues/5/comments",
        [
          makeGitHubCommentResponse(1, "target: first"),
          makeGitHubCommentResponse(2, "nothing here"),
          makeGitHubCommentResponse(3, "target: second"),
        ],
      ],
    ])
    const client = createGitHubClient(makeMockRequester(responses))

    const results = await client.findPreviousComments(
      "token",
      "owner/repo",
      5,
      "target:",
    )

    assertEquals(results.length, 2)
    assertEquals(results[0].id, 1)
    assertEquals(results[1].id, 3)
  },
)

Deno.test(
  "findPreviousComments: returns empty array when no comments match",
  async () => {
    const responses = new Map<string, unknown>([
      [
        "/repos/owner/repo/issues/5/comments",
        [makeGitHubCommentResponse(1, "unrelated")],
      ],
    ])
    const client = createGitHubClient(makeMockRequester(responses))

    const results = await client.findPreviousComments(
      "token",
      "owner/repo",
      5,
      "no-match",
    )

    assertEquals(results.length, 0)
  },
)

// ---------------------------------------------------------------------------
// makeComment
// ---------------------------------------------------------------------------

Deno.test(
  "makeComment: without existing comment, sends POST request",
  async () => {
    const calls: RecordedCall[] = []
    const responses = new Map<string, unknown>([
      [
        "/repos/owner/repo/issues/1/comments",
        makeGitHubCommentResponse(200, "new comment"),
      ],
    ])
    const client = createGitHubClient(makeMockRequester(responses, calls))

    await client.makeComment("token", "owner/repo", 1, "Hello world!")

    assertEquals(calls.length, 1)
    assertEquals(calls[0].method, "POST")
    assertEquals(calls[0].path, "/repos/owner/repo/issues/1/comments")
    assertEquals(calls[0].body, { body: "Hello world!" })
  },
)

Deno.test(
  "makeComment: with existing comment, sends PATCH request to comment URL",
  async () => {
    const calls: RecordedCall[] = []
    const responses = new Map<string, unknown>([
      ["/repos/owner/repo/issues/comments/42", undefined],
    ])
    const client = createGitHubClient(makeMockRequester(responses, calls))

    await client.makeComment("token", "owner/repo", 1, "Updated message", {
      id: 42,
      body: "old message",
    })

    assertEquals(calls.length, 1)
    assertEquals(calls[0].method, "PATCH")
    assertEquals(calls[0].path, "/repos/owner/repo/issues/comments/42")
    assertEquals(calls[0].body, { body: "Updated message" })
  },
)

// ---------------------------------------------------------------------------
// deleteComment
// ---------------------------------------------------------------------------

Deno.test(
  "deleteComment: sends DELETE request to the correct path",
  async () => {
    const calls: RecordedCall[] = []
    const responses = new Map<string, unknown>([
      ["/repos/owner/repo/issues/comments/99", undefined],
    ])
    const client = createGitHubClient(makeMockRequester(responses, calls))

    await client.deleteComment("token", "owner/repo", 99)

    assertEquals(calls.length, 1)
    assertEquals(calls[0].method, "DELETE")
    assertEquals(calls[0].path, "/repos/owner/repo/issues/comments/99")
  },
)
