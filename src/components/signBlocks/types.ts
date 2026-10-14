import type { BlockContent, SignerKind } from '../../types/documentTemplate';
import type { PdfSource } from './pdf';

/** What a supplier types into a field block: a line of text, or a day. */
export type FieldType = 'TEXT' | 'DATE';

/** A field block's question, and whether it may be left empty. */
export interface BlockField {
  label: string;
  type: FieldType;
  required: boolean;
}

/** What a block holds: a signature, the day it was signed, or (where the editor offers them) a field to type into. */
export type EditorContent = BlockContent | 'FIELD' | 'SEAL';

/** A signature block while it is being edited. Positions are fractions of the page, from its top-left corner. */
export interface EditableBlock {
  /** Stable while editing; not a server id */
  key: string;
  /** Which PDF it is on (see EditorFile.key) */
  fileKey: string;
  signerKind: SignerKind;
  /** Step of the approval template; 0 for the issuer */
  stepNo: number;
  /** The signer's signature, the day they signed, or something they type */
  content: EditorContent;
  /** Set on FIELD blocks only */
  field?: BlockField;
  /**
   * Set on a signature and the date added together with it: pressing either one picks up both, so
   * they are dragged as one. Known only while editing; it is not saved with the layout.
   */
  pairId?: string;
  /** 1 is the first page */
  pageNo: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A PDF the editor can place blocks on. */
export interface EditorFile {
  key: string;
  name: string;
  source: PdfSource;
}

/** Someone whose signature needs a place: the issuer, or the approver of one step. */
export interface Signer {
  kind: SignerKind;
  stepNo: number;
  /** "Issued", "Review", ... */
  label: string;
  /** Who that is: approver names, or how they are chosen */
  detail: string;
  /**
   * The signer's own signature picture, when it is known (someone placing their own signature).
   * Their signature blocks then show it, the size and place it will have on the document.
   */
  imageUrl?: string;
  /** This signer can also be given fields to type into (a supplier) */
  fields?: boolean;
  /** Not every document has this signer: leaving them without a block is fine */
  optional?: boolean;
  /** The company seal rather than a person: its blocks hold the seal (shown with `imageUrl`) */
  seal?: boolean;
}

export const signerKey = (s: { kind: SignerKind; stepNo: number } | { signerKind: SignerKind; stepNo: number }) =>
  'kind' in s ? `${s.kind}:${s.stepNo}` : `${s.signerKind}:${s.stepNo}`;

// One colour per signer, so a block on the page can be matched to its row in the list at a glance
const COLORS = [
  { border: '#1F4A8F', fill: 'rgb(31 74 143 / 0.14)', text: '#143265' },
  { border: '#15803D', fill: 'rgb(21 128 61 / 0.14)', text: '#14532D' },
  { border: '#B45309', fill: 'rgb(180 83 9 / 0.14)', text: '#7C2D12' },
  { border: '#9D174D', fill: 'rgb(157 23 77 / 0.13)', text: '#831843' },
  { border: '#6D28D9', fill: 'rgb(109 40 217 / 0.13)', text: '#4C1D95' },
  { border: '#0E7490', fill: 'rgb(14 116 144 / 0.14)', text: '#164E63' },
];

/** The colour of the signer at this position in the signer list. */
export const signerColor = (index: number) => COLORS[index % COLORS.length];
