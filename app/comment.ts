import { SpeakOptions, RemoveOptions } from "."
import { findPreviousComment, makeComment, deleteComment as deleteGitHubComment, IssueComment } from "./github"

export const getMessageHeader = (updateId: string): string => {
  return `<!-- https://github.com/levibostian/cathy comment. id:${updateId} -->`
}

export interface CommentResult {
  updatedPreviousComment: boolean
}

export const comment = async (message: string, options: SpeakOptions): Promise<CommentResult> => {
  // Set all default options
  if (!options.updateID) options.updateID = "default"  
  if (!options.updateExisting) options.updateExisting = false 
  if (!options.appendToExisting) options.appendToExisting = false
  const updateId = Array.isArray(options.updateID) ? options.updateID : [options.updateID]
  if (options.appendToExisting === true) options.updateExisting = true // If we are appending to an existing comment, we must update the existing comment

  /**
   * Find an existing comment, if it exists. 
   */
  let githubComment: IssueComment | undefined
  let doesExistingCommentContainAllUpdateIds = false 

  // Only search for existing if updateExisting is true so we keep variables above in a false state.
  if (options.updateExisting) {
    for await (const _updateID of updateId) {
      const updateID = _updateID.trim()
      if (!updateID || updateID == "") continue // Skip empty update IDs
      if (githubComment) break // If we already found a comment, no need to search again

      const messageHeader = getMessageHeader(updateID)

      // Search for a comment that contains at least one of the message headers. 
      githubComment = await findPreviousComment(
        options.githubToken,
        options.githubRepo,
        options.githubIssue,
        messageHeader
      )

      // If we found a comment, check if it contains all update IDs
      doesExistingCommentContainAllUpdateIds = updateId.every(updateID => githubComment?.body.includes(getMessageHeader(updateID))) ?? false;
    };
  }

  const willAppendToExisting = options.appendToExisting && doesExistingCommentContainAllUpdateIds
  if (willAppendToExisting && githubComment) {
    message = `${githubComment.body}\n\n${message}`
  }

  // Prepend the message header to the message, for all of the update IDs 
  updateId.forEach((_updateID) => {
    const messageHeader = getMessageHeader(_updateID)
    message = `${messageHeader}\n${message}`
  })

  await makeComment(
    options.githubToken,
    options.githubRepo,
    options.githubIssue,
    message,
    githubComment
  )

  return {
    updatedPreviousComment: githubComment !== undefined
  }
}

export const deleteComment = async (options: RemoveOptions): Promise<void> => {
  if (!options.updateID) options.updateID = "default"
  const messageHeader = getMessageHeader(options.updateID)

  const githubComment = await findPreviousComment(
    options.githubToken,
    options.githubRepo,
    options.githubIssue,
    messageHeader
  )

  if (!githubComment) return

  await deleteGitHubComment(options.githubToken, options.githubRepo, githubComment.id)
}
