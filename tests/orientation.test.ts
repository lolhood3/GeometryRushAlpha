import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPhone, isPortrait, shouldBlock, type DeviceEnv } from '../src/engine/orientation.ts';

const env = (over: Partial<DeviceEnv>): DeviceEnv => ({
  width: 390, height: 844, screenWidth: 390, screenHeight: 844, touch: true, mobileHint: true, ...over,
});

test('a phone held upright is blocked, either way up', () => {
  assert.equal(shouldBlock(env({})), true);
  assert.equal(shouldBlock(env({ width: 360, height: 640, screenWidth: 360, screenHeight: 640 })), true);
  // Some browsers always report the screen in its natural (portrait) order, others swap it.
  assert.equal(shouldBlock(env({ screenWidth: 844, screenHeight: 390 })), true);
});

test('a phone held sideways is not blocked', () => {
  assert.equal(shouldBlock(env({ width: 844, height: 390 })), false);
  assert.equal(shouldBlock(env({ width: 844, height: 390, screenWidth: 844, screenHeight: 390 })), false);
  // Browser bars and the keyboard change the height, not the orientation.
  assert.equal(shouldBlock(env({ width: 844, height: 300 })), false);
});

test('desktops and laptops are never blocked, whatever the window shape', () => {
  const desktop = { screenWidth: 1920, screenHeight: 1080, touch: false, mobileHint: false };
  assert.equal(shouldBlock(env({ ...desktop, width: 400, height: 900 })), false);
  assert.equal(shouldBlock(env({ ...desktop, width: 1600, height: 900 })), false);
  // A touch-screen laptop with a tall, narrow window.
  assert.equal(shouldBlock(env({ ...desktop, touch: true, width: 500, height: 1000 })), false);
  // A small screen without touch is still not a phone.
  assert.equal(shouldBlock(env({ touch: false, mobileHint: false })), false);
});

test('tablets are not treated as phones', () => {
  const ipad = { screenWidth: 820, screenHeight: 1180, mobileHint: false };
  assert.equal(isPhone(env(ipad)), false);
  assert.equal(shouldBlock(env({ ...ipad, width: 820, height: 1180 })), false);
  // Split view gives a tablet a phone-sized upright viewport; it is still a tablet.
  assert.equal(shouldBlock(env({ ...ipad, width: 320, height: 1180 })), false);
  // Small Android tablet: 600 CSS px on the short side.
  assert.equal(shouldBlock(env({ screenWidth: 600, screenHeight: 960, width: 600, height: 960, mobileHint: false })), false);
});

test('the browser hint only matters when the screen size is unknown, and never without touch', () => {
  assert.equal(isPhone(env({ screenWidth: 0, screenHeight: 0, mobileHint: true })), true);
  assert.equal(isPhone(env({ screenWidth: 0, screenHeight: 0, mobileHint: false })), false);
  assert.equal(isPhone(env({ screenWidth: 0, screenHeight: 0, mobileHint: true, touch: false })), false);
  assert.equal(isPhone(env({ screenWidth: 1280, screenHeight: 800, mobileHint: true })), false);
});

test('orientation follows the viewport', () => {
  assert.equal(isPortrait(env({ width: 390, height: 844 })), true);
  assert.equal(isPortrait(env({ width: 844, height: 390 })), false);
  assert.equal(isPortrait(env({ width: 500, height: 500 })), false);
});
