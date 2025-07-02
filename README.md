[npm]: https://www.npmjs.com/package/cathy

Latest (recommended) [![npm latest version](https://img.shields.io/npm/v/cathy/latest.svg)][npm]  

Beta: [![npm beta version](https://img.shields.io/npm/v/cathy/beta.svg)][npm]  

Alpha: [![npm alpha version](https://img.shields.io/npm/v/cathy/alpha.svg)][npm]  

# cathy

npm module to make comments on GitHub pull requests.

# Goals of this project

- Minimal dependencies. This module is meant to be a dependency of your projects like GitHub Actions. Be small for quick install and security reasons.
- Typescript and Javascript support with officially supported Typescript bindings.

# Getting started

- Install module in project:

```
npm install --save cathy
```

- Authenticate with GitHub and make a comment!

```ts
import cathy from "cathy"

cathy.speak("### 👋 Hello! 👋", {
  // **Required** options parameters
  //
  // Personal access token for GitHub account you want to make comment for.
  // Create token here: https://github.com/settings/tokens
  githubToken: "XXXXXXXXXXXXXX",
  // GitHub repository that we want to make the comment for.
  githubRepo: "username/repo",
  // Issue/pull request number to comment on.
  githubIssue: 12,

  // **Optional** parameters
  // Update existing comment you have sent on this pull request
  updateExisting: false,
  // Instead of overwriting an existing comment, append to the existing comment.
  appendToExisting: false,  
  // Identifier used for updating a comment. Cathy updates the existing comment with the provided ID.
  // You only want to change this value if you are trying to use cathy to send multiple unique comments.
  // Example: You use cathy on pull requests to print the status of test coverage *and* a website preview.
  // You would set `updateID` to `testCoverage` and `websitePreview`. If you keep `default` for both,
  // cathy would first comment on a PR for test coverage and then overwrite that comment with the website
  // preview message. Therefore, you would never see the test coverage menu.
  updateID: "default"
})
```

## Update/append over multiple CI runs 

Whenever you use cathy to make comments on a pull request and the CI runs multiple times on a pull request, it is difficult to determine when you should append to a existing comment, or you should completely replace the contents of that comment (assuming you want to replace contents each time the CI runs). 

To handle this use case, you can pass in multiple values to the `updateID` parameter. If cathy finds an existing comment that matches *all* of the values you pass in, it will append to that comment. If it finds a comment that matches *any* of the values you pass in, it will overwrite that comment.

Here is an example of how you can use this feature:

```ts
cathy.speak("### 👋 Hello! 👋", {
  updateID: [`test-coverage`, `test-coverage-${process.env.GITHUB_RUN_ID}`]
})
```

Notice how one of the values identifies the type of message (reporting test coverage) and the other identifies the CI run that changes with each CI run. By using this strategy, we will append to the comment if the dynamic value is found and will overwrite the comment if the static value is found.

## Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key))

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/levibostian"><img src="https://avatars1.githubusercontent.com/u/2041082?v=4" width="100px;" alt=""/><br /><sub><b>Levi Bostian</b></sub></a><br /><a href="https://github.com/levibostian/cathy/commits?author=levibostian" title="Code">💻</a> <a href="https://github.com/levibostian/cathy/commits?author=levibostian" title="Documentation">📖</a> <a href="#maintenance-levibostian" title="Maintenance">🚧</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

# Contributing

## Development setup

- `npm install`
- Write your code.
- Run tests to test your code works.

## Run tests

Tests for this project perform real HTTP requests against the GitHub API. Being a small project that doesn't require constant development, this is ok at this time to do.

This means that in order to run tests on your local development environment, you need to follow these steps:

- Create a personal GitHub access token that the tests will run against that user.
- Run `GITHUB_TOKEN=XXX npm test`. Or, make a draft pull request to this repository and the tests will run automatically. 

# Credits

- Thank you to [this project](https://github.com/marocchino/sticky-pull-request-comment) for the inspiration behind this project. I loved the project, but wanted to add the functionality to my own GitHub Actions which was the original inspiration of this project.
