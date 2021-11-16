import { comment } from "./comment"

export interface SpeakOptions {
  githubToken: string
  githubRepo: string
  githubIssue: number
  updateExisting: boolean
  updateID: string
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
