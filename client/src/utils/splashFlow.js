export function getStartupSplash({ cinematicDone, splashDone }) {
  if (!cinematicDone) return 'cinematic'
  if (!splashDone) return 'welcome'
  return 'app'
}
export function getSplashCopy() {
  return {
    cinematicLines: [
      'You know you can improve',
      'But where should you start?',
      'Find your starting point with...',
    ],
    cinematicBrandText: null,
    cinematicSubtitle: null,
    welcomeTitle: 'ASCENDUS',
    welcomeTitleColor: '#FFFFFF',
    welcomeSubtitle: 'Your journey starts here',
    welcomeSubtitleDelay: 2500,
  }
}
