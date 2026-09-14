import { setFailed } from '@actions/core'
import { describeError } from './describe-error'
import { run } from './run'

Promise.resolve(run()).catch((error: unknown) =>
  setFailed(describeError(error)),
)
