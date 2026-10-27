'use strict'

function isPublicDemoBlocked(isDemo, nodeEnv) {
  return isDemo === true && nodeEnv === 'production'
}

module.exports = { isPublicDemoBlocked }
