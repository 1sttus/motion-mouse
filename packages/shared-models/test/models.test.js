import test from 'node:test';
import assert from 'node:assert/strict';
import { isPointerButton } from '../src/index.js';

test('shared pointer vocabulary limits buttons to supported semantic values', () => {
  assert.equal(isPointerButton('left'), true);
  assert.equal(isPointerButton('back'), false);
});
