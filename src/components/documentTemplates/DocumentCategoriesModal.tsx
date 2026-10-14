import MasterListModal, { type MasterItem, type MasterListConfig } from '../common/MasterListModal';
import {
  createDocumentCategory,
  deleteDocumentCategory,
  listDocumentCategories,
  updateDocumentCategory,
} from '../../lib/documentTemplates';
import type { DocumentCategory } from '../../types/documentTemplate';

const toItem = (c: DocumentCategory): MasterItem => ({
  id: c.category_id,
  code: c.code,
  name_en: c.name_en,
  name_th: c.name_th,
  is_active: c.is_active,
});

const CONFIG: MasterListConfig = {
  eyebrow: 'Document Control',
  title: 'Document Categories',
  description: 'The kinds of document, such as Procedure or Form. These are the choices offered for a document template.',
  noun: 'category',
  addLabel: 'New category',
  namePlaceholder: 'Name (English), e.g. Checklist',
  thaiPlaceholder: 'เช่น รายการตรวจสอบ',
  activeHint: { on: 'Offered for new templates', off: 'Hidden from new templates' },
  deleteNote:
    'It will no longer be offered for document templates. A category that templates still use cannot be deleted; switch it off instead.',
  footerNote: 'Renaming a category renames it on every template that uses it.',
  list: async () => (await listDocumentCategories()).map(toItem),
  create: async (input) => toItem(await createDocumentCategory(input)),
  update: async (id, input) => toItem(await updateDocumentCategory(id, input)),
  remove: deleteDocumentCategory,
};

/** Add, rename, switch off and delete document categories. */
export default function DocumentCategoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <MasterListModal open={open} onClose={onClose} config={CONFIG} />;
}
