/* eslint-disable */
const path = require("path")
const https = require("https")

function githubRequest(method, apiPath, githubToken, body) {
  return new Promise((resolve, reject) => {
    const headers = {
      "User-Agent": "cathy-npm-module",
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json"
    }
    const options = {
      hostname: "api.github.com",
      path: apiPath,
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

const githubToken = process.env.GITHUB_TOKEN
const repoSlug = "levibostian/cathy"
const issueNumber = 2

async function asyncCall() {
  while (true) {
    let page = 1
    const PER_PAGE = 100
    let hasMore = true
    while (hasMore) {
      const apiPath = `/repos/${repoSlug}/issues/${issueNumber}/comments?per_page=${PER_PAGE}&page=${page}`
      // eslint-disable-next-line no-await-in-loop
      const comments = await githubRequest("GET", apiPath, githubToken)
      console.log(`Number of comments ${comments.length}`)
      if (!comments || comments.length === 0) return
      for (const comment of comments) {
        console.log(`Deleting comment: ${comment.id}`)
        try {
          // eslint-disable-next-line no-await-in-loop
          await githubRequest("DELETE", `/repos/${repoSlug}/issues/comments/${comment.id}`, githubToken)
        } catch {
          // do not do anything if delete doesn't succeed. we only want to delete comments that our bot made.
        }
      }
      if (comments.length < PER_PAGE) {
        hasMore = false
      } else {
        page++
      }
    }
    // After all pages, break the outer loop
    break
  }
}

asyncCall()
