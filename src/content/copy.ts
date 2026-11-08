// Section headings and other small bits of copy around the site.
// Draft wording: rewrite freely.
export const copy = {
  sections: {
    links: { index: 'I', eyebrow: 'the signpost', title: 'Find me' },
    music: { index: 'II', eyebrow: 'the fountain', title: 'On rotation' },
    work: { index: 'III', eyebrow: 'the mausoleum', title: "Things I've built" },
    about: { index: 'IV', eyebrow: 'the shrine', title: 'slvrr / sxvrce' },
    notes: { index: 'V', eyebrow: 'the old graves', title: 'Notes' },
    footer: { index: 'VI', eyebrow: 'the calvary', title: 'End of the path' },
  },
  footer: {
    outro: "you've reached the end of the churchyard. nothing else out here… probably.",
    backUp: 'back to the gate',
    credit: 'built with react, three.js & too many candles',
  },
  /**
   * What you think to yourself, shown as a subtitle the first time you see
   * something (or do something) in the churchyard.
   */
  lines: {
    discord: "That doesn't belong here.",
    nowPlaying: 'Another one.',
    walkman: 'Still warm.',
    coin: 'For good luck.',
  },
  /** The out-of-bounds message. */
  lost: "you're not supposed to be here.",
}

export type SectionCopy = (typeof copy.sections)[keyof typeof copy.sections]
