import { expect, test } from 'bun:test'
import { describeError } from '../describe-error'

test('returns the message for a plain Error', () => {
  expect(describeError(new Error('Something went wrong'))).toBe(
    'Something went wrong',
  )
})

test('includes the HTTP status for an Error with a status', () => {
  const error = Object.assign(new Error('Not found'), { status: 404 })

  expect(describeError(error)).toBe('Not found (HTTP 404)')
})

test('converts non-Error values to strings', () => {
  expect(describeError('Something went wrong')).toBe('Something went wrong')
})
