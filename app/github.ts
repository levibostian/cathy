import https from "https"

interface IssueComment {
  id: number
  body: string
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

export const findPreviousComment = async (
  githubToken: string,
  repoSlug: string,
  issueNumber: number,
  commentContents: string
): Promise<number | undefined> => {
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
      const commentId = commentJson.id
      if (comment.startsWith(commentContents)) {
        return commentId
      }
    }
    if (comments.length < PER_PAGE) break
    page++
  }
  return undefined
}

export const makeComment = async (
  githubToken: string,
  repoSlug: string,
  issueNumber: number,
  message: string,
  commentId?: number
): Promise<void> => {
  if (commentId) {
    const path = `/repos/${repoSlug}/issues/comments/${commentId}`
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
