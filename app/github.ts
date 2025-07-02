import https from "https"

export interface IssueComment {
  id: number
  body: string // the message 
}

function githubRequest<T>(
  method: string,
  path: string,
  githubToken: string,
  body?: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "User-Agent": "cathy-npm-module",
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json"
    }
    const options: https.RequestOptions = {
      hostname: "api.github.com",
      path,
      method,
      headers
    }
    let data = ""
    const req = https.request(options, res => {
      res.on("data", chunk => {
        data += chunk
      })
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`GitHub API error: ${res.statusCode} ${data}`))
        } else {
          try {
            resolve(data ? JSON.parse(data) : undefined)
          } catch (e) {
            reject(e)
          }
        }
      })
    })
    req.on("error", reject)
    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}

/**
 * Finds a previous comment on a GitHub issue that contains the specified contents.
 * It's suggested to use [getMessageHeader] to generate the comment contents.
 */
export const findPreviousComment = async (
  githubToken: string,
  repoSlug: string,
  issueNumber: number,
  commentContents: string,
  // Optional callback to handle found comments. return true to keep searching, false to stop.
  onFoundComment?: (comment: IssueComment) => boolean
): Promise<IssueComment | undefined> => {
  let page = 1
  const PER_PAGE = 100
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const path = `/repos/${repoSlug}/issues/${issueNumber}/comments?per_page=${PER_PAGE}&page=${page}`
    // eslint-disable-next-line no-await-in-loop
    const comments = await githubRequest<IssueComment[]>("GET", path, githubToken)
    if (!comments || comments.length === 0) break
    for (const commentJson of comments) {
      const comment = commentJson.body      
      if (comment.includes(commentContents)) {
        const issueComment: IssueComment = {
          id: commentJson.id,
          body: commentJson.body
        }

        if (onFoundComment) {
          const shouldKeepSearching = onFoundComment(issueComment)
          if (!shouldKeepSearching) return issueComment
        } else {
          return issueComment // If no callback is provided, return the first found comment
        }
      }
    }
    if (comments.length < PER_PAGE) break
    page++
  }
  return undefined
}

// Like findPreviousComment, but returns all comments that match the contents. 
// mostly used for testing purposes. The tool is meant to find first comment that matches the contents.
export const findPreviousComments = async (
  githubToken: string,
  repoSlug: string,
  issueNumber: number,
  commentContents: string
): Promise<IssueComment[]> => {
  const comments: IssueComment[] = []
  await findPreviousComment(githubToken, repoSlug, issueNumber, commentContents, comment => {
    comments.push(comment)
    return true // Keep searching
  })
  return comments
}

export const makeComment = async (
  githubToken: string,
  repoSlug: string,
  issueNumber: number,
  message: string,
  comment?: IssueComment
): Promise<void> => {
  if (comment) {
    const path = `/repos/${repoSlug}/issues/comments/${comment.id}`
    await githubRequest("PATCH", path, githubToken, { body: message })
  } else {
    const path = `/repos/${repoSlug}/issues/${issueNumber}/comments`
    await githubRequest("POST", path, githubToken, { body: message })
  }
  return
}

export const deleteComment = async (
  githubToken: string,
  repoSlug: string,
  commentId: number
): Promise<void> => {
  const path = `/repos/${repoSlug}/issues/comments/${commentId}`
  await githubRequest("DELETE", path, githubToken)
  return
}
