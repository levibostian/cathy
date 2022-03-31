/* eslint-disable */
const path = require("path")
const { Octokit } = require("@octokit/core")
const { paginateRest } = require("@octokit/plugin-paginate-rest")

const MyOctokit = Octokit.plugin(paginateRest)

require("dotenv").config({ path: path.join(__dirname, "../.env") })

const octokit = new MyOctokit({ auth: process.env.GITHUB_TOKEN })

async function asyncCall() {
  for await (const response of octokit.paginate.iterator(
    `GET /repos/levibostian/cathy/issues/2/comments`,
    { per_page: 100 }
  )) {
    const comments = response.data
    console.log(`Number of comments ${comments.length}`)

    for await (const comment of comments) {
      console.log(`Deleting comment: ${comment.id}`)
      try {
        await octokit.request(`DELETE /repos/levibostian/cathy/issues/comments/${comment.id}`)
      } catch {        
        // do not do anything if delete doesn't succeed. we only want to delete comments that 
        // our bot made. 
      }
    }
  }
}

asyncCall()
