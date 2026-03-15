import test from 'node:test';
import assert from 'node:assert';
import { escapeHtml } from '../src/js/utils.js';

// Mock DOM environment to match real browser behavior
global.document = {
  createElement: (tag) => {
    if (tag !== 'div') throw new Error('Expected div');
    const div = {
      _text: '',
      set textContent(val) {
        this._text = val;
        // Real browser serialization of text nodes only escapes &, <, >
        this.innerHTML = val
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      },
      get textContent() {
        return this._text;
      },
      innerHTML: ''
    };
    return div;
  }
};

test('escapeHtml should escape essential HTML characters', () => {
  const cases = [
    { name: 'escapes <', input: '<', expected: '&lt;' },
    { name: 'escapes >', input: '>', expected: '&gt;' },
    { name: 'escapes &', input: '&', expected: '&amp;' },
  ];

  for (const { name, input, expected } of cases) {
    assert.strictEqual(escapeHtml(input), expected, name);
  }
});

test('escapeHtml should handle normal text', () => {
  assert.strictEqual(escapeHtml('Hello World'), 'Hello World');
});

test('escapeHtml should handle empty string', () => {
  assert.strictEqual(escapeHtml(''), '');
});

test('escapeHtml should escape HTML tags', () => {
  assert.strictEqual(escapeHtml('<b>Bold</b>'), '&lt;b&gt;Bold&lt;/b&gt;');
});

test('escapeHtml behavior for quotes (DOM-based)', () => {
  // Verifying current DOM behavior: quotes are NOT escaped in innerHTML of a div
  assert.strictEqual(escapeHtml('"'), '"');
  assert.strictEqual(escapeHtml("'"), "'");
});
