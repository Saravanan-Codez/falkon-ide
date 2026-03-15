import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { escapeHtml, debounce, throttle } from '../src/js/utils.js';

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

describe('debounce', () => {
  it('should delay execution', (t, done) => {
    let called = 0;
    const fn = debounce(() => { called++; }, 50);

    fn();
    assert.strictEqual(called, 0);

    setTimeout(() => {
      assert.strictEqual(called, 1);
      done();
    }, 100);
  });

  it('should reset delay if called again', (t, done) => {
    let called = 0;
    const fn = debounce(() => { called++; }, 50);

    fn();
    setTimeout(() => fn(), 30);

    setTimeout(() => {
      assert.strictEqual(called, 0); // Not called yet because of reset
    }, 60);

    setTimeout(() => {
      assert.strictEqual(called, 1);
      done();
    }, 100);
  });
});

describe('throttle', () => {
  it('should execute immediately on first call', () => {
    let called = 0;
    const fn = throttle(() => { called++; }, 50);

    fn();
    assert.strictEqual(called, 1);
  });

  it('should not execute again within the wait period', () => {
    let called = 0;
    const fn = throttle(() => { called++; }, 50);

    fn();
    fn();
    fn();
    assert.strictEqual(called, 1);
  });

  it('should execute again after wait period', (t, done) => {
    let called = 0;
    const fn = throttle(() => { called++; }, 50);

    fn();
    setTimeout(() => {
      fn();
      assert.strictEqual(called, 2);
      done();
    }, 60);
  });
});
