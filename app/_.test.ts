export let githubAuthToken: string

/**
 * Global jest setup/teardown functions
 */
beforeAll(async () => {
  // do setup here
  // eslint-disable-next-line no-process-env
  githubAuthToken = process.env.GITHUB_TOKEN!

  if (!githubAuthToken)
    throw Error("Can't find github auth token. Did you forget to create a .env file?")
})
beforeEach(async () => {
  // before each test
})
afterAll(async () => {
  // do teardown here
})
afterEach(async () => {
  // after each
})
