// Section headings and other small bits of copy around the site.
// Draft wording: rewrite freely.
export const copy = {
  sections: {
    links: { index: '01', eyebrow: 'signal', title: 'Find me' },
    music: { index: '02', eyebrow: 'frequencies', title: 'On rotation' },
    work: { index: '03', eyebrow: 'artifacts', title: "Things I've built" },
    about: { index: '04', eyebrow: 'whoami', title: 'slvrr / sxvrce' },
    notes: { index: '05', eyebrow: 'transmissions', title: 'Notes' },
  },
  footer: {
    outro: "you've reached the bottom. nothing else down here… probably.",
    backUp: 'resurface',
    credit: 'built with react, three.js & too much chrome',
  },
}

export type SectionCopy = (typeof copy.sections)[keyof typeof copy.sections]
