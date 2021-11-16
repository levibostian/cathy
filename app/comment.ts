import { SpeakOptions } from "."
import { findPreviousComment, makeComment } from "./github"

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
      message
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
