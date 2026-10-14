import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Spin } from 'antd';
import { AtSign, BadgeCheck, Building2, IdCard, Info, Mail, PenLine, ShieldCheck, Signature, UserRound, X } from 'lucide-react';
import { getMySignature, type MySignature } from '../../lib/signature';
import { useCurrentUser, useSessionStore } from '../../stores/session';
import { dayjs } from '../../lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** The signed-in person's own account, in a panel that slides in from the right. */
export default function ProfileDrawer({ open, onClose }: Props) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      size={420}
      closable={false}
      styles={{ body: { padding: 0 }, header: { display: 'none' }, wrapper: { maxWidth: '100vw' } }}
      destroyOnHidden
    >
      {/* Unmounted with the drawer, so the signature is read again every time it opens */}
      <Profile onClose={onClose} />
    </Drawer>
  );
}

/** One line of the account details: what it is, and its value. */
function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-line-soft px-5 py-3 last:border-b-0">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-[#F4F4F5] text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11.5px] font-medium text-muted">{label}</dt>
        <dd className="mt-0.5 truncate text-[13.5px] font-medium text-ink">{children || <span className="font-normal text-faint">—</span>}</dd>
      </div>
    </div>
  );
}

function Profile({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const username = useSessionStore((s) => s.user?.username ?? '');
  const status = useSessionStore((s) => s.status);

  // undefined = still loading, null = none set (or it could not be loaded)
  const [signature, setSignature] = useState<MySignature | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getMySignature()
      .then((s) => {
        if (!cancelled) setSignature(s);
      })
      .catch(() => {
        if (!cancelled) setSignature(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = !currentUser.signedIn && status !== 'offline';

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow">Account</p>
          <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.018em]">My Profile</h2>
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

      {loading ? (
        <div className="grid flex-1 place-items-center">
          <Spin />
        </div>
      ) : (
        <div className="slim-scroll flex-1 overflow-y-auto">
          {/* Who */}
          <div className="flex items-center gap-4 border-b border-line bg-linear-to-br from-brand-50/70 via-surface to-surface px-5 py-5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-[18px] font-semibold text-white shadow-card ring-1 ring-brand-800/10">
              {currentUser.initials || <UserRound size={22} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold tracking-[-0.018em] text-ink">{currentUser.name}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-muted">
                {[currentUser.employeeCode, currentUser.department].filter(Boolean).join(' · ') || 'EDMS user'}
              </p>
              {currentUser.isSuperAdmin && (
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-0.5 text-[11.5px] font-semibold text-brand-700 ring-1 ring-brand-100">
                  <ShieldCheck size={13} />
                  Super admin
                </span>
              )}
            </div>
          </div>

          <dl>
            <Detail icon={<UserRound size={14} />} label="Display name">
              {currentUser.name}
            </Detail>
            <Detail icon={<AtSign size={14} />} label="Username">
              {username}
            </Detail>
            <Detail icon={<IdCard size={14} />} label="Employee code">
              {currentUser.employeeCode && <span className="tnum">{currentUser.employeeCode}</span>}
            </Detail>
            <Detail icon={<Mail size={14} />} label="Email">
              {currentUser.email}
            </Detail>
            <Detail icon={<Building2 size={14} />} label="Department">
              {currentUser.department}
            </Detail>
            <Detail icon={<BadgeCheck size={14} />} label="Account type">
              {currentUser.signedIn ? (currentUser.isSuperAdmin ? 'Super admin' : 'Standard user') : ''}
            </Detail>
          </dl>

          <p className="flex items-start gap-2 border-y border-line bg-[#FAFAFB] px-5 py-3 text-[12px] leading-relaxed text-muted">
            <Info size={13} className="mt-0.5 shrink-0 text-faint" />
            These details come from your central EDMS account and cannot be changed here. Contact IT if something is wrong.
          </p>

          {/* Signature */}
          <section className="px-5 py-5" aria-label="Signature">
            <p className="text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">Signature</p>
            <div className="mt-3 flex min-h-36 flex-col items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-5 text-center">
              {signature === undefined ? (
                <Spin />
              ) : signature ? (
                <>
                  <div className="flex h-20 w-full max-w-60 items-end justify-center border-b border-ink-2 px-2 pb-1">
                    <img src={signature.image_url} alt="Your signature" className="max-h-full max-w-full object-contain" />
                  </div>
                  <p className="text-[12px] text-muted">
                    {signature.source === 'DRAWN' ? 'Drawn' : 'Uploaded'} on {dayjs(signature.created_at).format('DD MMM YYYY')}
                  </p>
                </>
              ) : (
                <>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#F4F4F5] text-muted">
                    <Signature size={19} strokeWidth={1.75} />
                  </span>
                  <p className="text-[13.5px] font-semibold text-ink">No signature yet</p>
                  <p className="max-w-64 text-[12.5px] leading-relaxed text-muted">
                    Set one so it can be placed on documents when you approve them.
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      <div className="shrink-0 border-t border-line bg-[#FAFAFB] px-5 py-3.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('/my-signature');
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <PenLine size={14} />
          {signature ? 'Change signature' : 'Set up signature'}
        </button>
      </div>
    </div>
  );
}
