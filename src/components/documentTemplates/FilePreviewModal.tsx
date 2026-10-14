import { useState } from 'react';
import { Modal } from 'antd';
import { Download, ExternalLink, FileX2, X } from 'lucide-react';
import { documentTemplateFileUrl, formatFileSize, revisionLabel } from '../../lib/documentTemplates';
import type { DocumentTemplate, DocumentTemplateFile } from '../../types/documentTemplate';
import PdfView from '../common/PdfView';
import FileChip from './FileChip';
import { cn } from '../../lib/cn';

interface Props {
  /** Document whose files to show; null keeps the dialog closed. */
  template: DocumentTemplate | null;
  onClose: () => void;
}

// Browsers display PDFs themselves; Word and Excel files have to be downloaded and opened in Office.
const canShowInBrowser = (file: DocumentTemplateFile) => file.extension === 'pdf';

/** Looks at a document's files without downloading them: the file list on the left, the chosen file on the right. */
export default function FilePreviewModal({ template, onClose }: Props) {
  return (
    <Modal
      open={template !== null}
      onCancel={onClose}
      width="min(1120px, calc(100vw - 32px))"
      centered
      closable={false}
      footer={null}
      styles={{ body: { padding: 0 } }}
      classNames={{ container: '!p-0 overflow-hidden' }}
      destroyOnHidden
    >
      {/* Unmounted with the dialog, so every opening starts on the first file */}
      {template && <Preview template={template} onClose={onClose} />}
    </Modal>
  );
}

function Preview({ template, onClose }: { template: DocumentTemplate; onClose: () => void }) {
  const files = template.files;
  // Start on something that can actually be shown, if there is one
  const [selectedId, setSelectedId] = useState<number | null>((files.find(canShowInBrowser) ?? files[0])?.file_id ?? null);
  const selected = files.find((f) => f.file_id === selectedId) ?? null;
  const id = template.document_template_id;

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <p className="eyebrow">Preview</p>
          <h2 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.018em]">{template.name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
            <span className="doc-code text-brand-600">{template.code}</span>
            {template.current_revision && <span className="tnum">· {revisionLabel(template.current_revision.revision_no)}</span>}
            <span>
              · {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 -mr-1.5 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex size-11 items-center justify-center rounded-lg border border-line bg-[#FAFAFB] text-faint">
            <FileX2 size={19} strokeWidth={1.75} />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-ink">No files to preview</p>
          <p className="mt-1.5 max-w-sm text-[13px] text-muted">This document has no files yet. Add them with the edit button.</p>
        </div>
      ) : (
        <div className="flex flex-col md:h-[min(calc(100vh-150px),1100px)] md:flex-row">
          {/* File list */}
          <ul
            aria-label="Files"
            className="slim-scroll flex shrink-0 gap-1.5 overflow-auto border-b border-line p-3 md:w-64 md:flex-col md:border-r md:border-b-0"
          >
            {files.map((file) => {
              const active = file.file_id === selectedId;
              return (
                <li key={file.file_id} className="shrink-0 md:shrink">
                  <button
                    type="button"
                    onClick={() => setSelectedId(file.file_id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-56 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors md:w-full',
                      active ? 'border-brand-200 bg-brand-50' : 'border-transparent hover:bg-[#F4F4F5]',
                    )}
                  >
                    <FileChip extension={file.extension} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[12.5px] font-medium', active ? 'text-brand-700' : 'text-ink-2')}>
                        {file.label || file.original_name}
                      </span>
                      <span className="tnum block truncate text-[11px] text-faint">
                        {file.label ? `${file.original_name} · ` : ''}
                        {formatFileSize(file.size_bytes)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* The chosen file */}
          <div className="flex min-h-[60vh] min-w-0 flex-1 flex-col bg-[#F4F4F5] md:min-h-0">
            {selected && (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
                  <p className="min-w-0 truncate text-[13px] font-medium text-ink" title={selected.original_name}>
                    {selected.original_name}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {canShowInBrowser(selected) && (
                      <a
                        href={documentTemplateFileUrl(id, selected.file_id, true)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
                      >
                        <ExternalLink size={13.5} />
                        Open in new tab
                      </a>
                    )}
                    <a
                      href={documentTemplateFileUrl(id, selected.file_id)}
                      className="flex items-center gap-1.5 rounded-lg bg-brand-500! px-2.5 py-1.5 text-[12.5px] font-semibold text-white! transition-colors hover:bg-brand-600!"
                    >
                      <Download size={13.5} />
                      Download
                    </a>
                  </div>
                </div>

                {canShowInBrowser(selected) ? (
                  <PdfView url={documentTemplateFileUrl(id, selected.file_id, true)} title={`Preview of ${selected.original_name}`} className="flex-1" />
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                    <FileChip extension={selected.extension} />
                    <p className="mt-4 text-[15px] font-semibold text-ink">This file can't be shown here</p>
                    <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">
                      Word and Excel files open in Microsoft Office. Download the file to view it; only PDF files can be previewed in the
                      browser.
                    </p>
                    <a
                      href={documentTemplateFileUrl(id, selected.file_id)}
                      className="mt-5 flex items-center gap-1.5 rounded-lg bg-brand-500! px-3.5 py-2 text-[13px] font-semibold text-white! transition-colors hover:bg-brand-600!"
                    >
                      <Download size={14} />
                      Download {selected.original_name}
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
