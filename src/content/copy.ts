// Section headings and other small bits of copy around the site.
// Draft wording: rewrite freely.
export const copy = {
  sections: {
    links: { index: 'I', eyebrow: 'vox', title: 'Find me' },
    music: { index: 'II', eyebrow: 'hymnal', title: 'On rotation' },
    work: { index: 'III', eyebrow: 'relics', title: "Things I've built" },
    about: { index: 'IV', eyebrow: 'confessional', title: 'slvrr / sxvrce' },
    notes: { index: 'V', eyebrow: 'epistles', title: 'Notes' },
  },
  footer: {
    outro: "you've reached the churchyard. nothing else down here… probably.",
    backUp: 'ascend',
    credit: 'built with react, webgl & too many candles',
  },
}

export type SectionCopy = (typeof copy.sections)[keyof typeof copy.sections]
