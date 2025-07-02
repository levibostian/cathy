import { comment, deleteComment } from "./comment"

export interface SpeakOptions {
  githubToken: string
  githubRepo: string
  githubIssue: number
  updateExisting?: boolean
  appendToExisting?: boolean
  updateID?: string | string[]
}

/**
 * Comment on pull request
 * @param message The message of the comment
 * @param options Options
 * @return none
 */
export const speak = async (message: string, options: SpeakOptions): Promise<void> => {
  if (!message) return

  await comment(message, options)
}

export interface RemoveOptions {
  githubToken: string
  githubRepo: string
  githubIssue: number
  updateID: string
}

/**
 * Delete comment that may have been made by this action.
 */
export const remove = async (options: RemoveOptions): Promise<void> => {
  await deleteComment(options)
}
