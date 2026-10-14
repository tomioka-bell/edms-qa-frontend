import MasterListModal, { type MasterItem, type MasterListConfig } from '../common/MasterListModal';
import { createStepType, deleteStepType, listStepTypes, updateStepType } from '../../lib/approvalTemplates';
import type { ApprovalStepType } from '../../types/approval';

const toItem = (t: ApprovalStepType): MasterItem => ({
  id: t.step_type_id,
  code: t.code,
  name_en: t.name_en,
  name_th: t.name_th,
  is_active: t.is_active,
});

const CONFIG: MasterListConfig = {
  eyebrow: 'Approval Workflow',
  title: 'Step Types',
  description: 'What an approval step asks for. These are the choices offered for each step of a template.',
  noun: 'step type',
  addLabel: 'New step type',
  namePlaceholder: 'Name (English), e.g. Verify',
  thaiPlaceholder: 'เช่น ทวนสอบ',
  activeHint: { on: 'Offered in templates', off: 'Hidden from templates' },
  deleteNote:
    'It will no longer be offered when building a template. A step type that templates still use cannot be deleted; switch it off instead.',
  footerNote: 'Renaming does not change templates that were already saved.',
  list: async () => (await listStepTypes()).map(toItem),
  create: async (input) => toItem(await createStepType(input)),
  update: async (id, input) => toItem(await updateStepType(id, input)),
  remove: deleteStepType,
};

/** Add, rename, switch off and delete the kinds of approval step. */
export default function StepTypesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <MasterListModal open={open} onClose={onClose} config={CONFIG} />;
}
