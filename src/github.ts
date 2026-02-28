export interface IssueComment {
  id: number
  body: string // the message
}

// GitHub API response shape for a single comment
interface GitHubCommentResponse {
  id: number
  body: string
  [key: string]: unknown
}

/**
 * Type for the HTTP requester function used by the GitHub client.
 * This is injectable so that tests can provide a mock implementation.
 */
export type HttpRequester = <T>(
  method: string,
  path: string,
  githubToken: string,
  body?: Record<string, unknown>,
) => Promise<T>

/**
 * Default HTTP requester using the global `fetch` API.
 * Works on Deno, Bun, and Node.js 18+.
 */
export async function defaultHttpRequester<T>(
  method: string,
  path: string,
  githubToken: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = {
    "User-Agent": "cathy-npm-module",
    Authorization: `Bearer ${githubToken}`,
    Accept: "application/vnd.github+json",
  }

  const bodyStr = body ? JSON.stringify(body) : undefined
  if (bodyStr) {
    headers["Content-Type"] = "application/json"
  }

  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers,
    body: bodyStr,
  })

  if (response.status >= 400) {
    const text = await response.text()
    throw new Error(`GitHub API error: ${response.status} ${text}`)
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/**
 * Creates a GitHub API client bound to the provided HTTP requester.
 * Pass a custom requester to mock HTTP calls in tests.
 */
export interface GitHubClient {
  findPreviousComment: (
    githubToken: string,
    repoSlug: string,
    issueNumber: number,
    commentContents: string,
    onFoundComment?: (comment: IssueComment) => boolean,
  ) => Promise<IssueComment | undefined>
  findPreviousComments: (
    githubToken: string,
    repoSlug: string,
    issueNumber: number,
    commentContents: string,
  ) => Promise<IssueComment[]>
  makeComment: (
    githubToken: string,
    repoSlug: string,
    issueNumber: number,
    message: string,
    existingComment?: IssueComment,
  ) => Promise<void>
  deleteComment: (
    githubToken: string,
    repoSlug: string,
    commentId: number,
  ) => Promise<void>
}

export function createGitHubClient(
  request: HttpRequester = defaultHttpRequester,
): GitHubClient {
  /**
   * Finds a previous comment on a GitHub issue that contains the specified contents.
   * It's suggested to use {@link getMessageHeader} to generate the comment contents.
   *
   * @param githubToken - GitHub personal access token
   * @param repoSlug - Repository in the format "owner/repo"
   * @param issueNumber - Issue or pull request number
   * @param commentContents - String to search for in existing comments
   * @param onFoundComment - Optional callback; return true to keep searching, false to stop
   *
   * NOTE: The URL paths constructed below are mirrored by regex patterns in MockGitHub
   * (comment.test.ts). If you change any path format here, update the corresponding
   * regex in MockGitHub.requester to match.
   */
  const findPreviousComment = async (
    githubToken: string,
    repoSlug: string,
    issueNumber: number,
    commentContents: string,
    onFoundComment?: (comment: IssueComment) => boolean,
  ): Promise<IssueComment | undefined> => {
    let page = 1
    const PER_PAGE = 100

    while (true) {
      const path = `/repos/${repoSlug}/issues/${issueNumber}/comments?per_page=${PER_PAGE}&page=${page}`
      // deno-lint-ignore no-await-in-loop
      const comments = await request<GitHubCommentResponse[]>(
        "GET",
        path,
        githubToken,
      )
      if (!comments || comments.length === 0) break

      for (const commentJson of comments) {
        if (commentJson.body.includes(commentContents)) {
          const issueComment: IssueComment = {
            id: commentJson.id,
            body: commentJson.body,
          }

          if (onFoundComment) {
            const shouldKeepSearching = onFoundComment(issueComment)
            if (!shouldKeepSearching) return issueComment
          } else {
            return issueComment
          }
        }
      }

      if (comments.length < PER_PAGE) break
      page++
    }

    return undefined
  }

  /**
   * Like {@link findPreviousComment}, but collects *all* comments matching the contents.
   */
  const findPreviousComments = async (
    githubToken: string,
    repoSlug: string,
    issueNumber: number,
    commentContents: string,
  ): Promise<IssueComment[]> => {
    const found: IssueComment[] = []
    await findPreviousComment(
      githubToken,
      repoSlug,
      issueNumber,
      commentContents,
      (c) => {
        found.push(c)
        return true // keep searching
      },
    )
    return found
  }

  /**
   * Creates a new comment, or updates an existing one (via PATCH) if `existingComment` is provided.
   *
   * NOTE: The URL paths constructed below are mirrored by regex patterns in MockGitHub
   * (comment.test.ts). If you change any path format here, update the corresponding
   * regex in MockGitHub.requester to match.
   */
  const makeComment = async (
    githubToken: string,
    repoSlug: string,
    issueNumber: number,
    message: string,
    existingComment?: IssueComment,
  ): Promise<void> => {
    if (existingComment) {
      const path = `/repos/${repoSlug}/issues/comments/${existingComment.id}`
      await request("PATCH", path, githubToken, { body: message })
    } else {
      const path = `/repos/${repoSlug}/issues/${issueNumber}/comments`
      await request("POST", path, githubToken, { body: message })
    }
  }

  /**
   * Deletes a comment by its numeric ID.
   *
   * NOTE: The URL path constructed below is mirrored by a regex pattern in MockGitHub
   * (comment.test.ts). If you change the path format here, update the corresponding
   * regex in MockGitHub.requester to match.
   */
  const deleteComment = async (
    githubToken: string,
    repoSlug: string,
    commentId: number,
  ): Promise<void> => {
    const path = `/repos/${repoSlug}/issues/comments/${commentId}`
    await request("DELETE", path, githubToken)
  }

  return {
    findPreviousComment,
    findPreviousComments,
    makeComment,
    deleteComment,
  }
}

// Default client instance using the real HTTP requester
const defaultClient: GitHubClient = createGitHubClient()

export const findPreviousComment = defaultClient.findPreviousComment
export const findPreviousComments = defaultClient.findPreviousComments
export const makeComment = defaultClient.makeComment
export const deleteComment = defaultClient.deleteComment
