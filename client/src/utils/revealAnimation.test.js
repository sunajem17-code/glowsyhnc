import test from 'node:test'
import assert from 'node:assert/strict'
import { getRevealMetricTextStyles, getRevealRatingAnimation, getUnlockedResultsHeadingStyle, getResultsNavigationDotButtonStyle } from './revealAnimation.js'

test('unlocked metric labels and locks use neutral gray without glow', () => {
  const styles = getRevealMetricTextStyles(true)
  assert.deepEqual(styles.label, {
    color: '#A3A3A3',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontWeight: 700,
    fontSize: 'clamp(13px, 4vw, 18px)',
    textShadow: 'none',
    textTransform: 'uppercase',
  })
  assert.deepEqual(styles.lock, {
    color: '#A3A3A3',
    filter: 'none',
  })
  assert.deepEqual(styles.value, {
    color: '#fff',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontWeight: 800,
    fontSize: 30,
  })
})

test('locked metric labels keep the same neutral gray as the revealed card', () => {
  const styles = getRevealMetricTextStyles(false)
  assert.deepEqual(styles.label, {
    color: '#A3A3A3',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontWeight: 700,
    fontSize: 'clamp(13px, 4vw, 18px)',
    textShadow: 'none',
    textTransform: 'uppercase',
  })
  assert.equal(styles.lock.color, styles.label.color)
})

test('unlocked results add the Ascendus signature wordmark style', () => {
  assert.deepEqual(getRevealMetricTextStyles().brand, {
    color: '#D1B76D',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontWeight: 400,
    fontSize: 18,
    lineHeight: '20px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  })
})

test('results headings stay larger and on one line with navigation dots using tighter spacing', () => {
  assert.deepEqual(getUnlockedResultsHeadingStyle('You are a Chadlite'), {
    fontSize: 'clamp(28px, 8vw, 36px)',
    whiteSpace: 'nowrap',
    lineHeight: '1.1',
    transform: 'translateY(8px)',
  })
  assert.deepEqual(getUnlockedResultsHeadingStyle('You are a HTN'), {
    fontSize: 'clamp(28px, 8vw, 36px)',
    whiteSpace: 'nowrap',
    lineHeight: '1.1',
    transform: 'translateY(8px)',
  })
  assert.deepEqual(getResultsNavigationDotButtonStyle(), { width: 25, height: 44 })
})

test('unlock fades the lock before animating the scored bar to its rating', () => {
  const animation = getRevealRatingAnimation(7.2, { unlocked: true })
  assert.deepEqual(animation.lock.animate, { opacity: 0 })
  assert.deepEqual(animation.bar.initial, { width: '0%', opacity: 0.65, boxShadow: 'none' })
  assert.deepEqual(animation.bar.animate, { width: '72%', opacity: 1, boxShadow: 'none' })
  assert.ok(animation.bar.transition.width.delay >= animation.lock.transition.duration)
})

test('unlocking changes the metric mount key so the reveal can replay in place', () => {
  const locked = getRevealRatingAnimation(7.2, { unlocked: false, metricKey: 'Overall' })
  const unlocked = getRevealRatingAnimation(7.2, { unlocked: true, metricKey: 'Overall', revealRun: 1 })
  const replayed = getRevealRatingAnimation(7.2, { unlocked: true, metricKey: 'Overall', revealRun: 2 })
  assert.notEqual(locked.key, unlocked.key)
  assert.notEqual(unlocked.key, replayed.key)
})

test('unlocked scores sharpen as the lock fades and before the bar fills', () => {
  const animation = getRevealRatingAnimation(7.2, { unlocked: true })
  assert.deepEqual(animation.number.initial, { filter: 'blur(8px)', opacity: 0.55 })
  assert.deepEqual(animation.number.animate, { filter: 'blur(0px)', opacity: 1 })
  assert.equal(animation.number.transition.duration, animation.lock.transition.duration)
  assert.equal(animation.number.transition.delay, 0)
  assert.ok(animation.bar.transition.width.delay >= animation.lock.transition.duration)
})

test('missing ratings do not animate a fake score into the bar', () => {
  const animation = getRevealRatingAnimation(null, { unlocked: true })
  assert.deepEqual(animation.bar.animate, { width: '0%', opacity: 0.8, boxShadow: 'none' })
  assert.equal(animation.bar.initial, false)
})

test('locked ratings retain the neutral full-width placeholder bar', () => {
  const animation = getRevealRatingAnimation(7.2, { unlocked: false })
  assert.deepEqual(animation.lock.animate, { opacity: 1 })
  assert.deepEqual(animation.bar.animate, { width: '100%', opacity: 1, boxShadow: 'none' })
  assert.equal(animation.bar.initial, false)
})
