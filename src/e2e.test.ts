/**
 * End-to-end tests against the real GitHub API.
 *
 * Run with:
 * `CATHY_TESTING_GITHUB_TOKEN=your_token_here deno task test`
 *
 * These tests are skipped unless the environment variable
 * `CATHY_TESTING_GITHUB_TOKEN` is set. They exercise the full stack:
 * `speak()` / `remove()` → `comment.ts` → `github.ts` → `defaultHttpRequester`
 * → real HTTPS → api.github.com.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFIGURATION — edit these two constants before running:
 * ─────────────────────────────────────────────────────────────────────────────
 */

// The repository to post test comments on. Must be accessible by the token.
const E2E_REPO = "levibostian/cathy"

// An open issue or pull request number in E2E_REPO to use for most tests.
// Any existing comments on this issue are not touched; cathy only manages
// comments it created (identified by the hidden updateID header).
const E2E_ISSUE = 2

// Optional: set this to an issue number that already has MORE than 100
// comments. When set, the pagination test will run against that issue.
// Leave as `undefined` to skip the pagination test.
const E2E_PAGINATION_ISSUE: number | undefined = 2

// ─────────────────────────────────────────────────────────────────────────────

import { assertEquals, assertMatch, assertRejects } from "@std/assert"
import { defaultHttpRequester } from "./github.ts"
import { findPreviousComment, findPreviousComments, getMessageHeader, remove, speak } from "../mod.ts"

// Read the token once; all tests use this value.
const GITHUB_TOKEN = Deno.env.get("CATHY_TESTING_GITHUB_TOKEN")

/**
 * Wraps Deno.test so that the test is skipped (ignored) when the GitHub token
 * is not present in the environment. This keeps the normal `deno task test` run
 * clean on machines that have not configured the token.
 */
function e2eTest(name: string, fn: () => Promise<void>): void {
  Deno.test({
    name,
    ignore: !GITHUB_TOKEN,
    fn,
  })
}

// Unique prefix for all update IDs created by this test run so that parallel
// runs (e.g. on CI) do not collide with each other.
const RUN_ID = `e2e-${Date.now()}`

function uid(label: string): string {
  return `${RUN_ID}-${label}`
}

// ---------------------------------------------------------------------------
// speak() — basic comment creation
// ---------------------------------------------------------------------------

e2eTest("speak: creates a new comment on an issue", async () => {
  const id = uid("basic-create")
  await speak("e2e test: basic comment creation", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    updateID: id,
  })

  const found = await findPreviousComment(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(id))
  assertEquals(found !== undefined, true, "comment should exist after speak()")
  assertEquals(found!.body.includes("e2e test: basic comment creation"), true)

  // cleanup
  await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: id })
})

e2eTest("speak: given empty message, does not create a comment", async () => {
  const id = uid("empty-message")
  await speak("", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    updateID: id,
  })

  const found = await findPreviousComment(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(id))
  assertEquals(found, undefined, "no comment should be created for empty message")
})

// ---------------------------------------------------------------------------
// speak() — updateExisting
// ---------------------------------------------------------------------------

e2eTest("speak: given updateExisting=true, updates the existing comment in-place", async () => {
  const id = uid("update-existing")

  await speak("original content", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    updateExisting: true,
    updateID: id,
  })

  await speak("updated content", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    updateExisting: true,
    updateID: id,
  })

  const comments = await findPreviousComments(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(id))
  assertEquals(comments.length, 1, "should be exactly one comment after two speak() calls with updateExisting=true")
  assertEquals(comments[0].body.includes("updated content"), true)
  assertEquals(comments[0].body.includes("original content"), false)

  // cleanup
  await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: id })
})

e2eTest("speak: given updateExisting=false, creates a new comment each time", async () => {
  const id = uid("no-update")

  await speak("first post", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    updateExisting: false,
    updateID: id,
  })

  await speak("second post", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    updateExisting: false,
    updateID: id,
  })

  const comments = await findPreviousComments(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(id))
  assertEquals(comments.length, 2, "should be two separate comments")

  // cleanup both
  for (const c of comments) {
    const found = await findPreviousComment(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(id))
    if (found && found.id === c.id) {
      await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: id })
    }
  }
  // remove() only deletes the first match, so call it again for the second
  await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: id })
})

// ---------------------------------------------------------------------------
// speak() — appendToExisting
// ---------------------------------------------------------------------------

e2eTest("speak: given appendToExisting=true and no prior comment, creates a new comment", async () => {
  const id = uid("append-new")

  await speak("initial content", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    appendToExisting: true,
    updateID: id,
  })

  const comments = await findPreviousComments(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(id))
  assertEquals(comments.length, 1)
  assertEquals(comments[0].body.includes("initial content"), true)

  // cleanup
  await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: id })
})

e2eTest("speak: given appendToExisting=true and an existing comment, appends to it", async () => {
  const id = uid("append-existing")

  await speak("part one", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    updateID: id,
  })

  await speak("part two", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    appendToExisting: true,
    updateID: id,
  })

  const comments = await findPreviousComments(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(id))
  assertEquals(comments.length, 1, "should still be one comment")
  assertEquals(comments[0].body.includes("part one"), true)
  assertEquals(comments[0].body.includes("part two"), true)

  // cleanup
  await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: id })
})

// ---------------------------------------------------------------------------
// speak() — updateID as array (multi-run CI scenario)
// ---------------------------------------------------------------------------

e2eTest("speak: updateID array — appends when ALL IDs match, replaces when only some match", async () => {
  const staticId = uid("ci-static")
  const run1Id = uid("ci-run-1")
  const run2Id = uid("ci-run-2")

  // CI run 1: posts a comment tagged with [staticId, run1Id]
  await speak("output from run 1", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    appendToExisting: true,
    updateID: [staticId, run1Id],
  })

  // CI run 2: posts with [staticId, run2Id]. Existing comment has staticId but NOT run2Id,
  // so doesExistingCommentContainAllUpdateIds = false → should replace, not append.
  await speak("output from run 2", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    appendToExisting: true,
    updateID: [staticId, run2Id],
  })

  const byStaticId = await findPreviousComments(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(staticId))
  assertEquals(byStaticId.length, 1, "should be exactly one comment matching the static ID")
  const body = byStaticId[0].body
  assertEquals(body.includes("output from run 2"), true, "run 2 content should be present")
  assertEquals(body.includes("output from run 1"), false, "run 1 content should have been replaced")
  assertEquals(body.includes(getMessageHeader(run2Id)), true, "run2Id header should be present")
  assertEquals(body.includes(getMessageHeader(run1Id)), false, "run1Id header should be gone")

  // cleanup — comment has run2Id header so we can remove by that
  await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: run2Id })
})

e2eTest("speak: updateID array — same run appends when ALL IDs already present", async () => {
  const staticId = uid("append-all-match-static")
  const runId = uid("append-all-match-run")

  // First call creates the comment
  await speak("first append", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    appendToExisting: true,
    updateID: [staticId, runId],
  })

  // Second call with the SAME array — all IDs match, so it should append
  await speak("second append", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    appendToExisting: true,
    updateID: [staticId, runId],
  })

  const comments = await findPreviousComments(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(staticId))
  assertEquals(comments.length, 1)
  assertEquals(comments[0].body.includes("first append"), true)
  assertEquals(comments[0].body.includes("second append"), true)

  // cleanup
  await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: runId })
})

// ---------------------------------------------------------------------------
// remove()
// ---------------------------------------------------------------------------

e2eTest("remove: deletes a comment that was previously created by speak()", async () => {
  const id = uid("remove-existing")

  await speak("comment to be removed", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    updateID: id,
  })

  const before = await findPreviousComment(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(id))
  assertEquals(before !== undefined, true, "comment should exist before remove()")

  await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: id })

  const after = await findPreviousComment(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(id))
  assertEquals(after, undefined, "comment should be gone after remove()")
})

e2eTest("remove: given no matching comment, completes without error", async () => {
  const id = uid("remove-nonexistent")
  // Nothing was created with this ID — should not throw
  await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: id })
})

// ---------------------------------------------------------------------------
// findPreviousComment / findPreviousComments
// ---------------------------------------------------------------------------

e2eTest("findPreviousComment: returns undefined when no comment matches", async () => {
  const id = uid("find-no-match")
  const result = await findPreviousComment(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(id))
  assertEquals(result, undefined)
})

e2eTest("findPreviousComments: returns all matching comments", async () => {
  const id = uid("find-all")

  // Create two comments with the same updateID (updateExisting=false)
  await speak("find-all first", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    updateExisting: false,
    updateID: id,
  })
  await speak("find-all second", {
    githubToken: GITHUB_TOKEN!,
    githubRepo: E2E_REPO,
    githubIssue: E2E_ISSUE,
    updateExisting: false,
    updateID: id,
  })

  const results = await findPreviousComments(GITHUB_TOKEN!, E2E_REPO, E2E_ISSUE, getMessageHeader(id))
  assertEquals(results.length >= 2, true, "should find at least both comments")

  // cleanup
  await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: id })
  await remove({ githubToken: GITHUB_TOKEN!, githubRepo: E2E_REPO, githubIssue: E2E_ISSUE, updateID: id })
})

// ---------------------------------------------------------------------------
// Pagination (>100 comments)
// Requires E2E_PAGINATION_ISSUE to be set to an issue with >100 existing comments.
// ---------------------------------------------------------------------------

Deno.test({
  name: "findPreviousComment: paginates correctly on an issue with >100 comments",
  ignore: !GITHUB_TOKEN || E2E_PAGINATION_ISSUE === undefined,
  fn: async () => {
    const id = uid("pagination-needle")

    // Post a comment to the high-comment-count issue so we have something to find
    await speak("pagination test needle", {
      githubToken: GITHUB_TOKEN!,
      githubRepo: E2E_REPO,
      githubIssue: E2E_PAGINATION_ISSUE!,
      updateID: id,
    })

    // findPreviousComment must page through >100 comments to find it
    const found = await findPreviousComment(
      GITHUB_TOKEN!,
      E2E_REPO,
      E2E_PAGINATION_ISSUE!,
      getMessageHeader(id),
    )

    assertEquals(found !== undefined, true, "should find comment even when it requires pagination")
    assertEquals(found!.body.includes("pagination test needle"), true)

    // cleanup
    await remove({
      githubToken: GITHUB_TOKEN!,
      githubRepo: E2E_REPO,
      githubIssue: E2E_PAGINATION_ISSUE!,
      updateID: id,
    })
  },
})

// ---------------------------------------------------------------------------
// defaultHttpRequester — low-level HTTP transport verification
// ---------------------------------------------------------------------------

e2eTest("defaultHttpRequester: GET request returns parseable JSON", async () => {
  // Fetch the first page of comments on the test issue — even if empty, the
  // API returns a valid JSON array.
  const result = await defaultHttpRequester<unknown[]>(
    "GET",
    `/repos/${E2E_REPO}/issues/${E2E_ISSUE}/comments?per_page=1&page=1`,
    GITHUB_TOKEN!,
  )

  assertEquals(Array.isArray(result), true, "should return a JSON array")
})

e2eTest("defaultHttpRequester: POST with body sends Content-Type and returns created comment", async () => {
  const marker = `e2e-raw-post-${Date.now()}`
  const result = await defaultHttpRequester<{ id: number; body: string }>(
    "POST",
    `/repos/${E2E_REPO}/issues/${E2E_ISSUE}/comments`,
    GITHUB_TOKEN!,
    { body: marker },
  )

  assertEquals(typeof result.id, "number")
  assertEquals(result.body, marker)

  // cleanup via DELETE
  await defaultHttpRequester(
    "DELETE",
    `/repos/${E2E_REPO}/issues/comments/${result.id}`,
    GITHUB_TOKEN!,
  )
})

e2eTest("defaultHttpRequester: PATCH updates a comment body", async () => {
  const original = `e2e-raw-patch-original-${Date.now()}`
  const updated = `e2e-raw-patch-updated-${Date.now()}`

  // Create
  const created = await defaultHttpRequester<{ id: number; body: string }>(
    "POST",
    `/repos/${E2E_REPO}/issues/${E2E_ISSUE}/comments`,
    GITHUB_TOKEN!,
    { body: original },
  )

  // Patch
  const patched = await defaultHttpRequester<{ id: number; body: string }>(
    "PATCH",
    `/repos/${E2E_REPO}/issues/comments/${created.id}`,
    GITHUB_TOKEN!,
    { body: updated },
  )

  assertEquals(patched.body, updated)

  // cleanup
  await defaultHttpRequester("DELETE", `/repos/${E2E_REPO}/issues/comments/${created.id}`, GITHUB_TOKEN!)
})

e2eTest("defaultHttpRequester: DELETE returns undefined (empty body)", async () => {
  // Create a comment to delete
  const created = await defaultHttpRequester<{ id: number }>(
    "POST",
    `/repos/${E2E_REPO}/issues/${E2E_ISSUE}/comments`,
    GITHUB_TOKEN!,
    { body: `e2e-raw-delete-${Date.now()}` },
  )

  // DELETE returns 204 No Content — defaultHttpRequester should resolve to undefined
  const result = await defaultHttpRequester(
    "DELETE",
    `/repos/${E2E_REPO}/issues/comments/${created.id}`,
    GITHUB_TOKEN!,
  )

  assertEquals(result, undefined)
})

e2eTest("defaultHttpRequester: 4xx response rejects with an Error containing the status code", async () => {
  // Attempt to fetch a comment that does not exist — GitHub returns 404
  await assertRejects(
    () =>
      defaultHttpRequester(
        "GET",
        `/repos/${E2E_REPO}/issues/comments/999999999999`,
        GITHUB_TOKEN!,
      ),
    Error,
    "404",
  )
})

e2eTest("defaultHttpRequester: bad token returns 401 error", async () => {
  await assertRejects(
    () =>
      defaultHttpRequester(
        "GET",
        `/repos/${E2E_REPO}/issues/${E2E_ISSUE}/comments`,
        "bad-token",
      ),
    Error,
    "401",
  )
})

e2eTest("defaultHttpRequester: request to non-existent repo returns 404 error", async () => {
  await assertRejects(
    () =>
      defaultHttpRequester(
        "GET",
        `/repos/this-org-does-not-exist-xyz/no-such-repo/issues/1/comments`,
        GITHUB_TOKEN!,
      ),
    Error,
    "404",
  )
})

e2eTest("defaultHttpRequester: response body contains expected GitHub fields", async () => {
  // The issues list endpoint returns objects with at minimum id, body, user
  const id = uid("field-check")
  const created = await defaultHttpRequester<{ id: number; body: string; user: { login: string } }>(
    "POST",
    `/repos/${E2E_REPO}/issues/${E2E_ISSUE}/comments`,
    GITHUB_TOKEN!,
    { body: id },
  )

  assertEquals(typeof created.id, "number")
  assertEquals(created.body, id)
  assertMatch(created.user.login, /\S+/, "user.login should be a non-empty string")

  // cleanup
  await defaultHttpRequester("DELETE", `/repos/${E2E_REPO}/issues/comments/${created.id}`, GITHUB_TOKEN!)
})
