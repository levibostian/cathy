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

  const messageHeader = getMessageHeader(options.updateID)
  message = `${messageHeader}\n${message}`
  let githubComment: IssueComment | undefined

  if (options.updateExisting || options.appendToExisting) {
    githubComment = await findPreviousComment(
      options.githubToken,
      options.githubRepo,
      options.githubIssue,
      messageHeader
    )
  }

  if (options.appendToExisting && githubComment) {
    message = `${githubComment.body}\n\n${message}`
  }

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
