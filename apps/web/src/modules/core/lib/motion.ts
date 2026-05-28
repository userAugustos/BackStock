import type { Transition, Variants } from 'motion/react';

const enterSpring: Transition = { type: 'spring', duration: 0.3, bounce: 0 };

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10, filter: 'blur(2px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: enterSpring,
  },
};

/** Subtle exit used for list removals / route content. */
export const fadeExit: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: enterSpring },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16 } },
};
