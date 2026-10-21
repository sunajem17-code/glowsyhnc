import { isLocalProPreviewEnabled } from './developerUnlock.js'

export function getCoachAccessMode({ isPremium, localPreviewEnabled }, isDev, hostname) {
  if (isLocalProPreviewEnabled(localPreviewEnabled, isDev, hostname)) return 'local-preview'
  return isPremium ? 'server' : 'paywall'
}
