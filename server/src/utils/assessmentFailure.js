function assessmentFailureDetails(error) {
  if (error?.code === 'invalid_assessment') {
    return { errorCode: 'invalid_assessment', reason: String(error.message || 'Assessment rejected').slice(0, 180) }
  }
  return { errorCode: 'assessment_failed' }
}

module.exports = { assessmentFailureDetails }
