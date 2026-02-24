export type { CommentResult, RemoveOptions, SpeakOptions } from "./src/comment.ts"
export { getMessageHeader } from "./src/comment.ts"
export { findPreviousComment, findPreviousComments } from "./src/github.ts"
export type { IssueComment } from "./src/github.ts"
import { comment, deleteComment } from "./src/comment.ts"

/**
 * Comment on a GitHub pull request or issue.
 *
 * @param message - The comment body (markdown supported)
 * @param options - {@link SpeakOptions}
 */
export const speak = async (message: string, options: import("./src/comment.ts").SpeakOptions): Promise<void> => {
  if (!message) return
  await comment(message, options)
}

/**
 * Delete a comment previously made by cathy.
 *
 * @param options - {@link RemoveOptions}
 */
export const remove = async (options: import("./src/comment.ts").RemoveOptions): Promise<void> => {
  await deleteComment(options)
}

export default { speak, remove }
