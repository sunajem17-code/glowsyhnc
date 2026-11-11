// Basic objectionable-content filter for community text (App Store Guideline 1.2).
// It blocks slurs, harassment/threat phrases and self-harm encouragement before
// anything is stored. It is deliberately simple; reports + moderation cover the rest.
// Terms are stored ROT13-encoded so the source file itself stays clean.
const rot13 = s => s.replace(/[a-z]/gi, ch => {
  const base = ch <= 'Z' ? 65 : 97
  return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base)
})

const LONG_TERMS = ["avttre", "avttn", "snttbg", "genaal", "ergneq", "ergneqrq", "puvax", "phag", "juber", "fyhg", "xvxr", "encvfg"].map(rot13)
const SHORT_TERMS = ["snt", "fcvp", "xlf"].map(rot13)
const PHRASES = ["xvyy lbhefrys", "xvyy hefrys", "tb xvyy lbhefrys", "arpx lbhefrys", "unat lbhefrys", "v jvyy xvyy lbh", "vyy xvyy lbh", "v jvyy encr lbh", "fraq ahqrf", "qvpx cvp"].map(rot13)

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' }

function normalize(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ​-‍﻿]/g, '')
    .toLowerCase()
    .replace(/[0134578@$!]/g, ch => LEET[ch] || ch)
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Letters may repeat and be separated by up to two symbols ("n.i.g.g.e.r").
const looseRe = word => new RegExp('(?:^|[^a-z])' + [...word].map(c => escapeRe(c) + '+').join('[^a-z]{0,2}') + '(?:s|es|ed|ers?|ing)?(?:$|[^a-z])')
const LONG_RES = LONG_TERMS.map(looseRe)
const SHORT_RES = SHORT_TERMS.map(w => new RegExp('(?:^|[^a-z])' + escapeRe(w) + '+(?:$|[^a-z])'))

function findObjectionableContent(...fields) {
  for (const field of fields) {
    const text = normalize(field)
    if (!text.trim()) continue
    const spaced = text.replace(/\s+/g, ' ')
    if (PHRASES.some(p => spaced.includes(p))) return true
    if (LONG_RES.some(re => re.test(text))) return true
    if (SHORT_RES.some(re => re.test(text))) return true
  }
  return false
}

const OBJECTIONABLE_MESSAGE = "That contains language that isn't allowed in the Ascendus community. Please edit it and try again."

module.exports = { findObjectionableContent, OBJECTIONABLE_MESSAGE }
