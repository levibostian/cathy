import { SpeakOptions, RemoveOptions } from "."
import { findPreviousComment, makeComment, deleteComment as deleteGitHubComment } from "./github"

export const getMessageHeader = (updateId: string): string => {
  return `<!-- https://github.com/levibostian/cathy comment. id:${updateId} -->`
}

export interface CommentResult {
  updatedPreviousComment: boolean
}

export const comment = async (message: string, options: SpeakOptions): Promise<CommentResult> => {
  if (!options.updateID) options.updateID = "default"
  const messageHeader = getMessageHeader(options.updateID)
  message = `${messageHeader}\n${message}`
  let githubCommentId: number | undefined

  if (options.updateExisting) {
    githubCommentId = await findPreviousComment(
      options.githubToken,
      options.githubRepo,
      options.githubIssue,
      messageHeader
    )
  }

  await makeComment(
    options.githubToken,
    options.githubRepo,
    options.githubIssue,
    message,
    githubCommentId
  )

  return {
    updatedPreviousComment: githubCommentId !== undefined
  }
}

export const deleteComment = async (options: RemoveOptions): Promise<void> => {
  if (!options.updateID) options.updateID = "default"
  const messageHeader = getMessageHeader(options.updateID)

  const githubCommentId = await findPreviousComment(
    options.githubToken,
    options.githubRepo,
    options.githubIssue,
    messageHeader
  )

  if (!githubCommentId) return  

  await deleteGitHubComment(options.githubToken, options.githubRepo, githubCommentId)
}
