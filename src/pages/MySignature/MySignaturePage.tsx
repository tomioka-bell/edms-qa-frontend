import { useEffect, useRef, useState } from 'react';
import { App as AntApp, Checkbox, Segmented, Spin } from 'antd';
import { Eraser, ImageUp, LogIn, PenLine, RotateCw, ServerCrash, Signature, Trash2, Undo2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import SignaturePad, { type SignaturePadHandle } from '../../components/signature/SignaturePad';
import { imageToSignature, type SignatureImage } from '../../components/signature/imageToSignature';
import { ApiError } from '../../lib/api';
import {
  MAX_SIGNATURE_BYTES,
  getMySignature,
  removeMySignature,
  saveMySignature,
  type MySignature,
  type SignatureSource,
} from '../../lib/signature';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';
import { PORTAL_URL } from '../../lib/auth';
import { useCurrentUser } from '../../stores/session';

// Where people sign in (the EDMS portal). The session cookie it sets is the one these API calls use.

type Mode = 'draw' | 'upload';

const MODES: Array<{ value: Mode; label: string }> = [
  { value: 'draw', label: 'Draw' },
  { value: 'upload', label: 'Upload a picture' },
];

const SOURCE_LABEL: Record<SignatureSource, string> = { DRAWN: 'Drawn on screen', UPLOADED: 'Uploaded picture' };

/** How a signature sits on an approval: above a line, with the name and date under it. */
function ApprovalLine({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return (
    <div className="w-full max-w-64">
      <div className="flex h-20 items-end justify-center px-2">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="pb-1 text-[12px] text-faint italic">your signature</span>
        )}
      </div>
      <div className="border-t border-ink-2" />
      <p className="mt-1.5 truncate text-center text-[12.5px] font-medium text-ink">{name || 'Your name'}</p>
      <p className="tnum text-center text-[11.5px] text-muted">Approved · {dayjs().format('DD MMM YYYY')}</p>
    </div>
  );
}

export default function MySignaturePage() {
  const { message, modal } = AntApp.useApp();
  const pad = useRef<SignaturePadHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [signature, setSignature] = useState<MySignature | null>(null);
  const { name: userName, signedIn } = useCurrentUser();
  const name = signedIn ? userName : ''; // only for the name under the preview line; the page works without it
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [mode, setMode] = useState<Mode>('draw');
  const [strokeCount, setStrokeCount] = useState(0);
  // A picture chosen in "upload" mode, already turned into a signature image
  const [picked, setPicked] = useState<{ file: File; result: SignatureImage } | null>(null);
  const [removePaper, setRemovePaper] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMySignature()
      .then((current) => {
        if (cancelled) return;
        setSignature(current);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err : new ApiError(0, 'Could not load your signature.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Free the picture preview when it is replaced or the page is left
  useEffect(() => {
    const url = picked?.result.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [picked]);

  const reload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const prepare = async (file: File, withoutPaper: boolean) => {
    setPreparing(true);
    try {
      setPicked({ file, result: await imageToSignature(file, withoutPaper) });
    } catch (err) {
      setPicked(null);
      message.error(err instanceof Error ? err.message : 'That picture could not be used.');
    } finally {
      setPreparing(false);
    }
  };

  const choosePicture = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      message.error('Choose a PNG, JPG or WebP picture.');
      return;
    }
    void prepare(file, removePaper);
  };

  const save = async () => {
    setSaving(true);
    try {
      const image = mode === 'draw' ? await pad.current?.toBlob() : picked?.result.blob;
      if (!image) {
        message.warning(mode === 'draw' ? 'Draw your signature first.' : 'Choose a picture of your signature first.');
        return;
      }
      if (image.size > MAX_SIGNATURE_BYTES) {
        message.error('That signature is too detailed to save. Try a simpler picture or draw it instead.');
        return;
      }
      const saved = await saveMySignature(image, mode === 'draw' ? 'DRAWN' : 'UPLOADED');
      const replaced = signature !== null;
      setSignature(saved);
      pad.current?.clear();
      setPicked(null);
      message.success(replaced ? 'Your signature was replaced.' : 'Your signature was saved.');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Could not save your signature.');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = () => {
    modal.confirm({
      title: 'Remove your signature?',
      content: (
        <p className="text-[13.5px] text-muted">
          You will not be able to sign approvals until you set a new one. Documents you have already approved keep the signature
          they were signed with.
        </p>
      ),
      okText: 'Remove signature',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await removeMySignature();
          setSignature(null);
          message.success('Your signature was removed.');
        } catch (err) {
          message.error(err instanceof ApiError ? err.message : 'Could not remove your signature.');
        }
      },
    });
  };

  const ready = mode === 'draw' ? strokeCount > 0 : picked !== null && !preparing;
  // What the approval line shows: the signature being made if there is one, otherwise the saved one
  const previewUrl = mode === 'upload' && picked ? picked.result.previewUrl : (signature?.image_url ?? null);

  const retryButton = (
    <button
      type="button"
      onClick={reload}
      className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
    >
      <RotateCw size={14} />
      Try again
    </button>
  );

  return (
    <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Account"
        title="My Signature"
        description="Set the signature that is placed on a document when you approve it."
      />

      {loading ? (
        <div className="panel mt-6 grid h-64 place-items-center">
          <Spin />
        </div>
      ) : loadError ? (
        <div className="anim-rise panel mt-6">
          {loadError.status === 401 ? (
            <EmptyState
              icon={<LogIn size={19} strokeWidth={1.75} />}
              title="Sign in to set your signature"
              description="Your session has ended or you have not signed in yet. Sign in through the EDMS portal, then come back and try again."
              action={
                <div className="flex items-center gap-2">
                  <a
                    href={`${PORTAL_URL}/login`}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-500! px-3.5 py-2 text-[13px] font-semibold text-white! transition-colors hover:bg-brand-600!"
                  >
                    <LogIn size={14} />
                    Go to sign in
                  </a>
                  {retryButton}
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={<ServerCrash size={19} strokeWidth={1.75} />}
              title="Your signature could not be loaded"
              description={loadError.message}
              action={retryButton}
            />
          )}
        </div>
      ) : (
        <div className="anim-rise mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
          {/* ── Make a signature ─────────────────────────── */}
          <section className="panel overflow-hidden" aria-labelledby="signature-editor-title">
            <div className="panel-head">
              <div>
                <h2 id="signature-editor-title" className="panel-title">
                  {signature ? 'Replace your signature' : 'Set your signature'}
                </h2>
                <p className="mt-0.5 text-[12.5px] text-muted">Sign in the box, or use a picture of your signature on paper.</p>
              </div>
            </div>

            <div className="p-5">
              <Segmented block options={MODES} value={mode} onChange={setMode} disabled={saving} aria-label="How to make the signature" />

              {mode === 'draw' ? (
                <div className="mt-4">
                  <div className="relative rounded-lg border border-dashed border-[#D4D4D8] bg-[#FDFDFD]">
                    {/* The line to sign on. Behind the canvas, so it is never part of the saved image. */}
                    <div className="pointer-events-none absolute inset-x-6 bottom-12 border-t border-[#D4D4D8]" aria-hidden />
                    {strokeCount === 0 && (
                      <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[13px] text-faint">
                        Sign here with your mouse, finger, or pen
                      </p>
                    )}
                    <div className="relative">
                      <SignaturePad ref={pad} onStrokesChange={setStrokeCount} disabled={saving} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => pad.current?.undo()}
                      disabled={strokeCount === 0 || saving}
                      className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB] disabled:pointer-events-none disabled:opacity-45"
                    >
                      <Undo2 size={14} />
                      Undo
                    </button>
                    <button
                      type="button"
                      onClick={() => pad.current?.clear()}
                      disabled={strokeCount === 0 || saving}
                      className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB] disabled:pointer-events-none disabled:opacity-45"
                    >
                      <Eraser size={14} />
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={saving || preparing}
                    className={cn(
                      'flex h-56 w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      picked ? 'border-line bg-[#FDFDFD]' : 'border-[#D4D4D8] bg-[#FAFAFB] hover:border-brand-300 hover:bg-brand-50',
                    )}
                  >
                    {preparing ? (
                      <Spin />
                    ) : picked ? (
                      <>
                        <img src={picked.result.previewUrl} alt="The signature found in your picture" className="max-h-40 max-w-full object-contain" />
                        <span className="mt-3 text-[12px] text-muted">{picked.file.name} · click to choose another picture</span>
                      </>
                    ) : (
                      <>
                        <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-brand-500">
                          <ImageUp size={17} strokeWidth={1.85} />
                        </span>
                        <span className="mt-2.5 text-[13px] font-medium text-ink">Choose a picture of your signature</span>
                        <span className="mt-0.5 text-[11.5px] text-muted">PNG, JPG or WebP · dark ink on white paper works best</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Picture of your signature"
                    onChange={(e) => {
                      choosePicture(e.target.files?.[0]);
                      e.target.value = ''; // so choosing the same picture again fires a change
                    }}
                  />
                  <Checkbox
                    className="mt-3!"
                    checked={removePaper}
                    disabled={saving || preparing}
                    onChange={(e) => {
                      setRemovePaper(e.target.checked);
                      if (picked) void prepare(picked.file, e.target.checked);
                    }}
                  >
                    <span className="text-[13px] text-ink-2">Remove the paper background and trim the edges</span>
                  </Checkbox>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FAFAFB] px-5 py-3.5">
              <p className="text-[12px] text-muted">
                {signature ? 'Saving replaces the signature you use from now on.' : 'You can change it at any time.'}
              </p>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!ready || saving}
                className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:pointer-events-none disabled:opacity-50"
              >
                <PenLine size={14} />
                {saving ? 'Saving…' : signature ? 'Replace signature' : 'Save signature'}
              </button>
            </div>
          </section>

          {/* ── What is on file ──────────────────────────── */}
          <div className="flex flex-col gap-5">
            <section className="panel overflow-hidden" aria-labelledby="signature-current-title">
              <div className="panel-head">
                <h2 id="signature-current-title" className="panel-title">
                  Your current signature
                </h2>
                {signature && (
                  <button
                    type="button"
                    onClick={confirmRemove}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                )}
              </div>
              {signature ? (
                <div className="p-5">
                  <div className="flex h-36 items-center justify-center rounded-lg border border-line bg-[#FDFDFD] p-4">
                    <img src={signature.image_url} alt="Your current signature" className="max-h-full max-w-full object-contain" />
                  </div>
                  <p className="tnum mt-3 text-[12.5px] text-muted">
                    Saved {dayjs(signature.created_at).format('DD MMM YYYY, HH:mm')} · {SOURCE_LABEL[signature.source]}
                  </p>
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={<Signature size={19} strokeWidth={1.75} />}
                  title="No signature yet"
                  description="Set one to be able to sign the documents you approve."
                />
              )}
            </section>

            <section className="panel overflow-hidden" aria-labelledby="signature-preview-title">
              <div className="panel-head">
                <div>
                  <h2 id="signature-preview-title" className="panel-title">
                    How it will look
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-muted">On the approval line of a document.</p>
                </div>
              </div>
              <div className="flex justify-center px-5 py-6">
                <ApprovalLine imageUrl={previewUrl} name={name} />
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
