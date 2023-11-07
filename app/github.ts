import { Octokit } from "@octokit/core"
import { paginateRest } from "@octokit/plugin-paginate-rest"

const myOctokit = Octokit.plugin(paginateRest)

interface IssueComment {
  id: number
  body: string
}

export const findPreviousComment = async (
  githubToken: string,
  repoSlug: string,
  issueNumber: number,
  commentContents: string
): Promise<number | undefined> => {
  const octokit = new myOctokit({ auth: githubToken })

  for await (const response of octokit.paginate.iterator(
    `GET /repos/${repoSlug}/issues/${issueNumber}/comments`,
    { per_page: 100 }
  )) {
    const comments = response.data as IssueComment[]

    // get comment response: https://docs.github.com/en/rest/reference/issues#get-an-issue-comment
    for (const commentJson of comments) {
      const comment = commentJson.body
      const commentId = commentJson.id

      if (comment.startsWith(commentContents)) {
        return commentId
      }
    }
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
  const octokit = new myOctokit({ auth: githubToken })

  if (commentId) {
    await octokit.request(`PATCH /repos/${repoSlug}/issues/comments/${commentId}`, {
      body: message
    })
  } else {
    await octokit.request(`POST /repos/${repoSlug}/issues/${issueNumber}/comments`, {
      body: message
    })
  }

  return
}

export const deleteComment = async (
  githubToken: string,
  repoSlug: string,
  commentId: number
): Promise<void> => {
  const octokit = new myOctokit({ auth: githubToken })

  await octokit.request(`DELETE /repos/${repoSlug}/issues/comments/${commentId}`)

  return
}
