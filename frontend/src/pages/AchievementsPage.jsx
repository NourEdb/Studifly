import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateMe } from '../api/auth.api';
import useGamification from '../hooks/useGamification';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import styles from './AchievementsPage.module.css';

export default function AchievementsPage() {
  const { profile, loading } = useGamification();
  const { user, refreshUser } = useAuth();
  const [pinning, setPinning] = useState(false);

  async function handlePin(badgeKey) {
    if (pinning) return;
    const isCurrentlyPinned = user?.pinned_badge === badgeKey;
    setPinning(true);
    try {
      await updateMe({ pinned_badge: isCurrentlyPinned ? null : badgeKey });
      await refreshUser();
    } finally {
      setPinning(false);
    }
  }

  if (loading || !profile) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>;
  }

  const { xp, badges } = profile;
  const earned = badges.filter(b => b.earned);
  const locked = badges.filter(b => !b.earned);

  return (
    <div className={styles.page}>
      <Card className={styles.xpCard}>
        <div className={styles.levelBadge}>Lv {xp.level}</div>
        <div className={styles.xpInfo}>
          <h2 className={styles.xpTitle}>Level {xp.level}</h2>
          <p className={styles.xpSub}>{xp.total} XP total</p>
        </div>
        <div className={styles.barWrapper}>
          <ProgressBar value={xp.xpInLevel} max={xp.xpForLevel} color="var(--color-purple)" />
          <p className={styles.barLabel}>{xp.xpInLevel} / {xp.xpForLevel} XP to Level {xp.level + 1}</p>
        </div>
      </Card>

      <section>
        <h2 className={styles.sectionTitle}>How to earn XP</h2>
        <div className={styles.xpRules}>
          <div className={styles.rule}><span className={styles.ruleXp}>+50 XP</span> Complete a task</div>
          <div className={styles.rule}><span className={styles.ruleXp}>+10 XP</span> Per 30 minutes studied</div>
          <div className={styles.rule}><span className={styles.ruleXp}>+100 XP</span> Reach weekly study goal (10 h)</div>
        </div>
      </section>

      {earned.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Earned badges</h2>
          <div className={styles.badgeGrid}>
            {earned.map(b => {
              const isPinned = user?.pinned_badge === b.key;
              return (
                <div key={b.key} className={[styles.badge, isPinned && styles.pinned].filter(Boolean).join(' ')}>
                  <span className={styles.badgeIcon}>{b.icon}</span>
                  <strong className={styles.badgeName}>{b.name}</strong>
                  <p className={styles.badgeDesc}>{b.description}</p>
                  <button
                    className={[styles.pinBtn, isPinned && styles.pinBtnActive].filter(Boolean).join(' ')}
                    onClick={() => handlePin(b.key)}
                    disabled={pinning}
                    title={isPinned ? 'Unpin badge from sidebar' : 'Pin badge to sidebar'}
                  >
                    📌 {isPinned ? 'Pinned' : 'Pin'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {locked.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Locked badges</h2>
          <div className={styles.badgeGrid}>
            {locked.map(b => (
              <div key={b.key} className={[styles.badge, styles.locked].join(' ')}>
                <span className={styles.badgeIcon}>{b.icon}</span>
                <strong className={styles.badgeName}>{b.name}</strong>
                <p className={styles.badgeDesc}>{b.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
