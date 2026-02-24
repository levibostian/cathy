import { createGitHubClient, HttpRequester, IssueComment } from "./github.ts"

export interface SpeakOptions {
  githubToken: string
  githubRepo: string
  githubIssue: number
  updateExisting?: boolean
  appendToExisting?: boolean
  updateID?: string | string[]
}

export interface RemoveOptions {
  githubToken: string
  githubRepo: string
  githubIssue: number
  updateID: string
}

export interface CommentResult {
  updatedPreviousComment: boolean
}

/**
 * Returns the hidden HTML comment header used to identify a cathy-managed comment.
 */
export const getMessageHeader = (updateId: string): string => {
  return `<!-- https://github.com/levibostian/cathy comment. id:${updateId} -->`
}

/**
 * Creates a comment client bound to the provided HTTP requester.
 * Pass a custom requester to mock HTTP calls in tests.
 */
export function createCommentClient(request?: HttpRequester) {
  const github = createGitHubClient(request)

  /**
   * Creates or updates a GitHub issue/PR comment according to the provided options.
   */
  const comment = async (message: string, options: SpeakOptions): Promise<CommentResult> => {
    // Apply defaults
    if (!options.updateID) options.updateID = "default"
    if (!options.updateExisting) options.updateExisting = false
    if (!options.appendToExisting) options.appendToExisting = false

    const updateId = Array.isArray(options.updateID) ? options.updateID : [options.updateID]

    // appendToExisting implies updateExisting
    if (options.appendToExisting === true) options.updateExisting = true

    // Find existing comment if we might need to update it
    let githubComment: IssueComment | undefined
    let doesExistingCommentContainAllUpdateIds = false

    if (options.updateExisting) {
      for (const _updateID of updateId) {
        const updateID = _updateID.trim()
        if (!updateID || updateID === "") continue
        if (githubComment) break

        const messageHeader = getMessageHeader(updateID)
        // deno-lint-ignore no-await-in-loop
        githubComment = await github.findPreviousComment(
          options.githubToken,
          options.githubRepo,
          options.githubIssue,
          messageHeader,
        )

        doesExistingCommentContainAllUpdateIds = updateId.every((uid) =>
          githubComment?.body.includes(getMessageHeader(uid))
        ) ?? false
      }
    }

    const willAppendToExisting = options.appendToExisting && doesExistingCommentContainAllUpdateIds
    if (willAppendToExisting && githubComment) {
      message = `${githubComment.body}\n\n${message}`
    }

    // Prepend all update-ID headers to the message (skip blank entries)
    for (const _updateID of updateId) {
      const trimmed = _updateID.trim()
      if (!trimmed || trimmed === "") continue
      const messageHeader = getMessageHeader(trimmed)
      message = `${messageHeader}\n${message}`
    }

    await github.makeComment(options.githubToken, options.githubRepo, options.githubIssue, message, githubComment)

    return {
      updatedPreviousComment: githubComment !== undefined,
    }
  }

  /**
   * Deletes the GitHub comment identified by the given updateID, if it exists.
   */
  const deleteComment = async (options: RemoveOptions): Promise<void> => {
    if (!options.updateID) options.updateID = "default"
    const messageHeader = getMessageHeader(options.updateID)

    const githubComment = await github.findPreviousComment(
      options.githubToken,
      options.githubRepo,
      options.githubIssue,
      messageHeader,
    )

    if (!githubComment) return

    await github.deleteComment(options.githubToken, options.githubRepo, githubComment.id)
  }

  return { comment, deleteComment }
}

// Default client instance using the real GitHub client
const defaultClient = createCommentClient()

export const comment = defaultClient.comment
export const deleteComment = defaultClient.deleteComment
