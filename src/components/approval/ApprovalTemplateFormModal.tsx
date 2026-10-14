import { useEffect, useState } from 'react';
import { Alert, Form, Input, InputNumber, Modal, Segmented, Select, Tooltip } from 'antd';
import { ArrowDown, ArrowUp, ChevronRight, Info, Plus, Trash2, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  createApprovalTemplate,
  listActiveStepTypes,
  listApproverCandidates,
  updateApprovalTemplate,
} from '../../lib/approvalTemplates';
import { describeApprovers, describeChosenLater } from '../../lib/approvalText';
import type {
  ApprovalRule,
  ApprovalStepType,
  ApprovalTemplate,
  ApprovalTemplateInput,
  ApproverType,
  DirectoryUser,
} from '../../types/approval';

interface Props {
  open: boolean;
  /** Template being edited; null creates a new one. */
  template: ApprovalTemplate | null;
  onClose: () => void;
  onSaved: (saved: ApprovalTemplate, mode: 'created' | 'updated') => void;
}

interface StepValue {
  step_type_id?: number | null;
  approver_type: ApproverType;
  approval_rule: ApprovalRule;
  approver_user_ids?: number[];
  /** Empty for no time limit */
  due_days?: number | null;
}

interface FormValues {
  code: string;
  name: string;
  description: string;
  steps: StepValue[];
}

const MAX_STEPS = 10;

// Plain-language wording for the two ways a step's person is decided
const APPROVER_TYPES: Array<{ value: ApproverType; label: string }> = [
  { value: 'USER', label: 'A specific person' },
  { value: 'REQUESTER_SELECT', label: 'Chosen later' }, // short enough not to be cut off on a phone
];

// How a step with several people passes, in plain words
const APPROVAL_RULES: Array<{ value: ApprovalRule; label: string }> = [
  { value: 'ANY_ONE', label: 'Any one of them' },
  { value: 'ALL', label: 'All of them' },
];

const MAX_APPROVERS_PER_STEP = 10;

const BLANK_STEP: StepValue = { step_type_id: null, approver_type: 'USER', approval_rule: 'ANY_ONE', approver_user_ids: [] };

function initialValues(template: ApprovalTemplate | null): FormValues {
  if (!template) {
    return { code: '', name: '', description: '', steps: [{ ...BLANK_STEP }] };
  }
  return {
    code: template.code,
    name: template.name,
    description: template.description,
    steps: template.steps.map((s) => ({
      step_type_id: s.step_type_id,
      approver_type: s.approver_type,
      approval_rule: s.approval_rule,
      approver_user_ids: s.approvers.map((a) => a.user_id),
      due_days: s.due_days > 0 ? s.due_days : null,
    })),
  };
}

export default function ApprovalTemplateFormModal({ open, template, onClose, onSaved }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={760}
      closable={false}
      keyboard={false}
      footer={null}
      styles={{ body: { padding: 0 } }}
      classNames={{ container: '!p-0 overflow-hidden' }}
      destroyOnHidden
    >
      {/* Unmounted with the dialog, so every opening starts from a clean form */}
      <TemplateForm template={template} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function TemplateForm({ template, onClose, onSaved }: Omit<Props, 'open'>) {
  const [form] = Form.useForm<FormValues>();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [stepTypes, setStepTypes] = useState<ApprovalStepType[]>([]);
  const [stepTypesLoading, setStepTypesLoading] = useState(true);
  const [stepTypesError, setStepTypesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = template !== null;

  // Live values of the steps, for the plain-language preview under the step list
  const watchedSteps = Form.useWatch('steps', form) as StepValue[] | undefined;

  // What each step can be (step types) and who can be named as an approver
  useEffect(() => {
    let cancelled = false;
    listActiveStepTypes()
      .then((list) => {
        if (!cancelled) setStepTypes(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setStepTypesError(err instanceof Error ? err.message : 'Could not load the step types.');
      })
      .finally(() => {
        if (!cancelled) setStepTypesLoading(false);
      });
    listApproverCandidates()
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setUsersError(err instanceof Error ? err.message : 'Could not load the user list.');
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userOptions = users.map((u) => ({
    value: u.user_id,
    label: u.display_name,
    search: `${u.display_name} ${u.first_name} ${u.last_name} ${u.username} ${u.employee_code} ${u.position} ${u.department_code}`.toLowerCase(),
    user: u,
  }));

  // An approver saved earlier may since have left the active list; keep them readable instead of showing a bare id.
  const savedApprovers = (template?.steps ?? [])
    .flatMap((s) => s.approvers)
    .filter((a) => !users.some((u) => u.user_id === a.user_id))
    .filter((a, i, all) => all.findIndex((o) => o.user_id === a.user_id) === i)
    .map((a) => ({
      value: a.user_id,
      label: `${a.name} (no longer active)`,
      search: a.name.toLowerCase(),
      user: null,
    }));

  const stepTypeOptions = stepTypes.map((t) => ({
    value: t.step_type_id,
    label: t.name_th ? `${t.name_en} · ${t.name_th}` : t.name_en,
  }));

  // A step type saved earlier may since have been made inactive or removed; keep its saved name selectable.
  const savedStepTypes = (template?.steps ?? [])
    .filter((s) => s.step_type_id !== null && !stepTypes.some((t) => t.step_type_id === s.step_type_id))
    .filter((s, i, all) => all.findIndex((o) => o.step_type_id === s.step_type_id) === i)
    .map((s) => ({ value: s.step_type_id as number, label: `${s.step_name} (no longer active)`, disabled: true }));

  const close = () => {
    if (!submitting) onClose();
  };

  const submit = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const input: ApprovalTemplateInput = {
      code: values.code.trim(),
      name: values.name.trim(),
      description: (values.description ?? '').trim(),
      steps: values.steps.map((s) => ({
        step_type_id: s.step_type_id as number,
        approver_type: s.approver_type,
        approval_rule: s.approval_rule ?? 'ANY_ONE',
        approver_user_ids: s.approver_type === 'USER' ? (s.approver_user_ids ?? []) : [],
        due_days: s.due_days ?? 0,
      })),
    };

    setSubmitting(true);
    setError(null);
    try {
      const saved = editing
        ? await updateApprovalTemplate(template.template_id, input)
        : await createApprovalTemplate(input);
      onSaved(saved, editing ? 'updated' : 'created');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the template. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <p className="eyebrow">Approval Workflow</p>
          <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.018em]">
            {editing ? 'Edit Approval Template' : 'New Approval Template'}
          </h2>
          <p className="mt-1 text-[12.5px] text-muted">
            A template is a ready-made list of approval steps. Two things to fill in: its name, then the steps.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="-mt-1 -mr-1.5 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="slim-scroll max-h-[min(66vh,660px)] overflow-y-auto px-6 py-5">
        <Form form={form} layout="vertical" requiredMark={false} disabled={submitting} initialValues={initialValues(template)}>
          {/* ── 1. About the template ─────────────────────── */}
          <SectionHeading number={1} title="Name this template" hint="So people can recognise it when they pick an approval route." />

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[1fr_200px]">
            <Form.Item
              name="name"
              label="Template name"
              rules={[
                { required: true, whitespace: true, message: 'Enter a template name' },
                { max: 200, message: 'Up to 200 characters' },
              ]}
            >
              <Input placeholder="e.g. Standard document approval" maxLength={200} />
            </Form.Item>
            <Form.Item
              name="code"
              label="Short code"
              tooltip="A short ID for this template, shown in lists. Letters, numbers and dashes; no spaces."
              normalize={(v: string) => v.toUpperCase()}
              rules={[
                { required: true, whitespace: true, message: 'Enter a short code' },
                { max: 50, message: 'Up to 50 characters' },
                { pattern: /^\S+$/, message: 'No spaces allowed' },
              ]}
            >
              <Input placeholder="e.g. QA-DOC-STD" maxLength={50} className="doc-code" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea rows={2} maxLength={500} showCount placeholder="When should this template be used?" />
          </Form.Item>

          {/* ── 2. The steps ──────────────────────────────── */}
          <div className="border-t border-line pt-5">
            <SectionHeading
              number={2}
              title="Set the approval steps"
              hint="A document goes to step 1 first, then step 2, and so on. For each step choose what is done and who does it."
            />

            {stepTypesError && (
              <Alert
                type="warning"
                showIcon
                className="!mb-3.5"
                title="The step types could not be loaded"
                description={`${stepTypesError} Steps cannot be set until they load.`}
              />
            )}

            {usersError && (
              <Alert
                type="warning"
                showIcon
                className="!mb-3.5"
                title="The user list could not be loaded"
                description={`${usersError} Steps with a specific person cannot be set until it loads.`}
              />
            )}

            <Form.List name="steps">
              {(fields, { add, remove, move }) => (
                <>
                  <ol className="flex flex-col">
                    {fields.map((field, index) => (
                      <li key={field.key}>
                        {/* Arrow between cards: the order is top to bottom */}
                        {index > 0 && (
                          <div className="flex h-7 items-center pl-[22px]" aria-hidden>
                            <ArrowDown size={15} className="text-[#C4C4CC]" />
                          </div>
                        )}

                        <div className="overflow-hidden rounded-lg border border-line bg-surface">
                          <div className="flex items-center justify-between gap-3 border-b border-line bg-[#FAFAFB] py-2 pr-2 pl-3">
                            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                              <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-500 text-[12px] font-semibold text-white">
                                {index + 1}
                              </span>
                              Step {index + 1}
                              {index === 0 && fields.length > 1 && <span className="font-normal text-muted">· first</span>}
                              {index === fields.length - 1 && fields.length > 1 && <span className="font-normal text-muted">· last</span>}
                            </p>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Tooltip title="Move earlier">
                                <button
                                  type="button"
                                  onClick={() => move(index, index - 1)}
                                  disabled={index === 0 || submitting}
                                  aria-label={`Move step ${index + 1} up`}
                                  className="rounded-md p-1.5 text-muted transition-colors hover:bg-[#EDEDF0] hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                                >
                                  <ArrowUp size={15} />
                                </button>
                              </Tooltip>
                              <Tooltip title="Move later">
                                <button
                                  type="button"
                                  onClick={() => move(index, index + 1)}
                                  disabled={index === fields.length - 1 || submitting}
                                  aria-label={`Move step ${index + 1} down`}
                                  className="rounded-md p-1.5 text-muted transition-colors hover:bg-[#EDEDF0] hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                                >
                                  <ArrowDown size={15} />
                                </button>
                              </Tooltip>
                              <Tooltip title={fields.length === 1 ? 'A template needs at least one step' : 'Remove this step'}>
                                <button
                                  type="button"
                                  onClick={() => remove(field.name)}
                                  disabled={fields.length === 1 || submitting}
                                  aria-label={`Remove step ${index + 1}`}
                                  className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong disabled:opacity-30"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </Tooltip>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-3.5 sm:grid-cols-2">
                            <Form.Item
                              name={[field.name, 'step_type_id']}
                              label="What is done in this step?"
                              className="!mb-0"
                              rules={[{ required: true, message: 'Choose what is done in this step' }]}
                            >
                              <Select
                                loading={stepTypesLoading}
                                placeholder="Choose, e.g. Review or Approve"
                                aria-label={`Step ${index + 1} type`}
                                options={[...stepTypeOptions, ...savedStepTypes]}
                              />
                            </Form.Item>

                            <Form.Item name={[field.name, 'approver_type']} label="Who does it?" className="!mb-0">
                              <Segmented block options={APPROVER_TYPES} aria-label={`Step ${index + 1} approver type`} />
                            </Form.Item>

                            <Form.Item
                              name={[field.name, 'due_days']}
                              label="Time to decide (optional)"
                              extra={
                                <span className="text-[11.5px] text-faint">
                                  Counted from when a document reaches this step. Past it, the step shows as overdue; nothing is sent back by itself.
                                </span>
                              }
                              className="!mb-0 sm:col-span-2"
                            >
                              <InputNumber
                                min={1}
                                max={365}
                                precision={0}
                                placeholder="No limit"
                                suffix="days"
                                aria-label={`Step ${index + 1} days to decide`}
                                className="w-40!"
                              />
                            </Form.Item>

                            {/* Re-rendered on every change of this form, so it always sees the step's current choices */}
                            <Form.Item noStyle shouldUpdate>
                              {({ getFieldValue }) => {
                                const fixed = getFieldValue(['steps', field.name, 'approver_type']) === 'USER';
                                const chosen = (getFieldValue(['steps', field.name, 'approver_user_ids']) ?? []) as number[];
                                return (
                                  <>
                                    {fixed ? (
                                      <Form.Item
                                        name={[field.name, 'approver_user_ids']}
                                        label="Person"
                                        extra={
                                          <span className="text-[11.5px] text-faint">
                                            You can choose more than one person for this step.
                                          </span>
                                        }
                                        className="!mb-0 sm:col-span-2"
                                        rules={[
                                          { required: true, type: 'array', min: 1, message: 'Choose at least one person for this step' },
                                          { type: 'array', max: MAX_APPROVERS_PER_STEP, message: `Up to ${MAX_APPROVERS_PER_STEP} people per step` },
                                          ({ getFieldValue: get }) => ({
                                            validator(_, value: number[] | undefined) {
                                              const steps = (get('steps') ?? []) as StepValue[];
                                              for (const id of value ?? []) {
                                                const clash = steps.findIndex(
                                                  (s, i) => i !== index && s?.approver_type === 'USER' && (s.approver_user_ids ?? []).includes(id),
                                                );
                                                if (clash !== -1) {
                                                  const name = userOptions.find((o) => o.value === id)?.label ?? 'A person';
                                                  return Promise.reject(new Error(`${name} is already in step ${clash + 1}. Choose someone else.`));
                                                }
                                              }
                                              return Promise.resolve();
                                            },
                                          }),
                                        ]}
                                      >
                                        <Select
                                          mode="multiple"
                                          showSearch={{
                                            filterOption: (input, option) =>
                                              ((option as { search?: string } | undefined)?.search ?? '').includes(input.toLowerCase()),
                                          }}
                                          allowClear
                                          loading={usersLoading}
                                          placeholder="Type a name, employee code, or department"
                                          aria-label={`Step ${index + 1} approver`}
                                          options={[...userOptions, ...savedApprovers]}
                                          optionRender={(option) => {
                                            const user = (option.data as { user: DirectoryUser | null }).user;
                                            if (!user) return option.label;
                                            return (
                                              <div className="flex items-center justify-between gap-3 py-0.5">
                                                <span className="min-w-0">
                                                  <span className="block truncate text-[13px] font-medium text-ink">{user.display_name}</span>
                                                  <span className="block truncate text-[11.5px] text-muted">
                                                    {[user.position, user.department_name_en || user.department_code].filter(Boolean).join(' · ')}
                                                  </span>
                                                </span>
                                                <span className="doc-code shrink-0 text-[11px] text-faint">{user.employee_code}</span>
                                              </div>
                                            );
                                          }}
                                        />
                                      </Form.Item>
                                    ) : (
                                      <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-brand-800 sm:col-span-2">
                                        <Info size={14} className="mt-0.5 shrink-0 text-brand-500" />
                                        No person is fixed for this step. Whoever submits a document will choose one or more people at
                                        that moment.
                                      </p>
                                    )}

                                    {/* Only a question when there can be several people: two or more named, or picked later */}
                                    {(!fixed || chosen.length > 1) && (
                                      <Form.Item
                                        name={[field.name, 'approval_rule']}
                                        label={fixed ? `Who of these ${chosen.length} must act?` : 'If several people are chosen, who must act?'}
                                        extra={
                                          <span className="text-[11.5px] text-faint">
                                            If anyone rejects, the document is sent back straight away.
                                          </span>
                                        }
                                        className="!mb-0 sm:col-span-2"
                                      >
                                        <Segmented block options={APPROVAL_RULES} aria-label={`Step ${index + 1} approval rule`} />
                                      </Form.Item>
                                    )}
                                  </>
                                );
                              }}
                            </Form.Item>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <button
                    type="button"
                    onClick={() => add({ ...BLANK_STEP })}
                    disabled={fields.length >= MAX_STEPS || submitting}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#D4D4D8] px-3 py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Plus size={15} strokeWidth={2.2} />
                    {fields.length >= MAX_STEPS ? `Maximum of ${MAX_STEPS} steps reached` : `Add step ${fields.length + 1}`}
                  </button>
                  <p className="mt-2 text-[12px] text-muted">
                    Can't find the right choice under “What is done in this step?” Close this form and add it with the
                    <span className="font-medium text-ink-2"> Step Types </span>button.
                  </p>
                </>
              )}
            </Form.List>
          </div>

          {/* ── 3. Read-back ──────────────────────────────── */}
          <div className="mt-5 rounded-lg border border-line bg-[#FAFAFB] px-3.5 py-3">
            <p className="text-[12px] font-semibold text-ink-2">Preview: a document will go through</p>
            <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1.5" aria-label="Route preview">
              {(watchedSteps ?? []).map((step, i) => {
                const what = [...stepTypeOptions, ...savedStepTypes].find((o) => o.value === step?.step_type_id)?.label;
                const rule = step?.approval_rule ?? 'ANY_ONE';
                const who =
                  step?.approver_type === 'REQUESTER_SELECT'
                    ? describeChosenLater(rule)
                    : describeApprovers(
                        (step?.approver_user_ids ?? []).map(
                          (id) => [...userOptions, ...savedApprovers].find((o) => o.value === id)?.label ?? `#${id}`,
                        ),
                        rule,
                      ) || undefined;
                return (
                  // Steps have no identity of their own in the preview; position is the key
                  <li key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight size={13} className="shrink-0 text-[#C4C4CC]" aria-hidden />}
                    <span className="flex items-center gap-1.5 rounded-md border border-line bg-surface py-[3px] pr-2 pl-[3px] text-xs">
                      <span className="tnum flex size-[18px] shrink-0 items-center justify-center rounded bg-brand-500 text-[10.5px] font-semibold text-white">
                        {i + 1}
                      </span>
                      <span className={what ? 'font-medium text-ink' : 'text-faint italic'}>{what ?? 'not chosen yet'}</span>
                      <span className="text-faint">·</span>
                      <span className={who ? 'text-ink-2' : 'text-faint italic'}>{who ?? 'no person yet'}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </Form>

        {error && <Alert type="error" showIcon className="!mt-5" title="The template was not saved" description={error} />}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FAFAFB] px-6 py-4">
        <p className="flex items-center gap-1.5 text-[12px] text-muted">
          <Info size={13} className="text-faint" />
          Changes apply to documents submitted from now on.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-[#F1F1F4] hover:text-ink disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </>
  );
}

/** Numbered heading that splits the form into the things to do, in order. */
function SectionHeading({ number, title, hint }: { number: number; title: string; hint: string }) {
  return (
    <div className="mb-3.5 flex items-start gap-2.5">
      <span className="tnum mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-[11px] font-semibold text-brand-700">
        {number}
      </span>
      <div>
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{hint}</p>
      </div>
    </div>
  );
}
