import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { checkForUpdate } from '../utils/updateCheck';

// One update prompt per app session — a dismissed banner stays gone until the
// next launch, so the check doesn't nag during normal use.
let sessionDismissed = false;

export default function UpdateBanner() {
  const [update, setUpdate] = useState(null);

  const runCheck = () => {
    if (sessionDismissed) return;
    checkForUpdate().then(u => {
      if (u && !sessionDismissed) setUpdate(u);
    });
  };

  useEffect(() => {
    runCheck();
    let unsub;
    // Re-check when the app returns to the foreground (e.g. after the user
    // downloaded the APK and came back).
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) runCheck();
    }).then(r => { unsub = r; });
    return () => { if (unsub) unsub.then(u => u.remove()); };
  }, []);

  if (!update) return null;

  const dismiss = () => {
    sessionDismissed = true;
    setUpdate(null);
  };

  const openUpdate = () => {
    if (update.apkUrl) window.open(update.apkUrl, '_blank');
    dismiss();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={dismiss}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#171A21', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <span style={{ color: '#C6F135', fontWeight: 800, fontSize: 20 }}>⚡</span>
        </div>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>
          Update available {update.versionName ? `· v${update.versionName}` : ''}
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B7280', whiteSpace: 'pre-wrap' }}>
          {update.notes || 'A new version of CaloBit is ready.'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={openUpdate}
            style={{
              flex: 1, background: '#C6F135', color: '#171A21', border: 'none',
              borderRadius: 10, padding: '12px 0', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}
          >
            Update Now
          </button>
          <button
            onClick={dismiss}
            style={{
              background: 'none', border: '1px solid #E5E7EB', color: '#6B7280',
              borderRadius: 10, padding: '0 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}