import type { ApprovalRule } from '../types/approval';

/**
 * Who acts in a step, as a short phrase: "Anan K.", "Anan K. or Puvadon A." (any one),
 * "Anan K. and Puvadon A." (all), or "any 1 of 4: Anan K., …" for longer lists.
 */
export function describeApprovers(names: string[], rule: ApprovalRule): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return names.join(rule === 'ALL' ? ' and ' : ' or ');
  return `${rule === 'ALL' ? `all ${names.length}` : `any 1 of ${names.length}`}: ${names.join(', ')}`;
}

/** Same idea for a step whose people are picked at submission. */
export function describeChosenLater(rule: ApprovalRule): string {
  return rule === 'ALL' ? 'chosen when submitting (all must approve)' : 'chosen when submitting';
}
