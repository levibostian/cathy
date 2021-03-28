[npm]: https://www.npmjs.com/package/levibostian/cathy

Latest (recommended) [![npm latest version](https://img.shields.io/npm/v/levibostian/cathy/latest.svg)][npm]
Beta: [![npm beta version](https://img.shields.io/npm/v/levibostian/cathy/beta.svg)][npm]
Alpha: [![npm alpha version](https://img.shields.io/npm/v/levibostian/cathy/alpha.svg)][npm]

[![codecov](https://codecov.io/gh/levibostian/cathy/branch/main/graph/badge.svg?token=BuKNhLezPs)](https://codecov.io/gh/levibostian/cathy)

# cathy

npm module to make comments on GitHub pull requests. 

# Goals of this project

- Zero dependencies. This module is meant to be a dependency of your projects like GitHub Actions. Be small for quick install and security reasons. 
- Typescript and Javascript support with officially supported Typescript bindings.

# Getting started

* Install module in project:

```
npm install --save cathy
```

* Authenticate with GitHub with a personal access token:

```ts
import cathy from "cathy"

cathy.warmup({
  githubToken: 'XXXXXXXXXXXXXX'
})
```

* Time to make a comment! 

```ts
// This is the shorthand way to make a comment using the default options. 
cathy.speak('### 👋 Hello! 👋')
```

...or...use some of the options:

```ts
// Here are all of the function options that you may provide. 
// Note: Option values below are the defaults. 
cathy.speak('### 👋 Hello! 👋', {
  // Update existing comment you have sent on this pull request
  updateExisting: false,
  // Identifier used for updating a comment. Cathy updates the existing comment with the provided ID. 
  updateID: 'default'
})
```

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

# Credits 

* Thank you to [this project](https://github.com/marocchino/sticky-pull-request-comment) for the inspiration behind this project. I loved the project, but wanted to add the functionality to my own GitHub Actions which was the original inspiration of this project. 