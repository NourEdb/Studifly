import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  updateMe,
  changePassword as apiChangePassword,
  deleteAccount as apiDeleteAccount,
  downloadCsv,
} from '../api/auth.api';
import { sendWeeklyReview } from '../api/email.api';
import Card from '../components/ui/Card';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { user, refreshUser, logoutUser } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName]         = useState(user?.display_name || '');
  const [weeklyGoalHours, setWeeklyGoalHours] = useState(user?.weekly_goal_hours ?? 10);
  const [remindersEnabled, setRemindersEnabled] = useState(user?.email_reminders_enabled ?? true);

  const [profileMsg, setProfileMsg] = useState(null);
  const [goalMsg, setGoalMsg]       = useState(null);
  const [notifMsg, setNotifMsg]     = useState(null);

  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwMsg, setPwMsg]           = useState(null);

  const [deleteOpen, setDeleteOpen]         = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMsg, setDeleteMsg]           = useState(null);
  const [deleting, setDeleting]             = useState(false);

  const [sendingReview, setSendingReview] = useState(false);

  function closeDeleteModal() {
    setDeleteOpen(false);
    setDeletePassword('');
    setDeleteMsg(null);
  }

  async function saveProfile(e) {
    e.preventDefault();
    try {
      await updateMe({ display_name: displayName });
      await refreshUser();
      setProfileMsg({ ok: true, text: 'Profile updated.' });
    } catch (err) {
      setProfileMsg({ ok: false, text: err.response?.data?.message || 'Failed to update profile.' });
    }
  }

  async function saveGoal(e) {
    e.preventDefault();
    const hours = parseInt(weeklyGoalHours, 10);
    if (!hours || hours < 1 || hours > 168) {
      setGoalMsg({ ok: false, text: 'Enter a value between 1 and 168 hours.' });
      return;
    }
    try {
      await updateMe({ weekly_goal_hours: hours });
      await refreshUser();
      setGoalMsg({ ok: true, text: 'Weekly goal updated.' });
    } catch (err) {
      setGoalMsg({ ok: false, text: err.response?.data?.message || 'Failed to update goal.' });
    }
  }

  async function toggleReminders(newVal) {
    setRemindersEnabled(newVal);
    try {
      await updateMe({ email_reminders_enabled: newVal });
      await refreshUser();
      setNotifMsg({ ok: true, text: `Email reminders ${newVal ? 'enabled' : 'disabled'}.` });
    } catch (err) {
      setRemindersEnabled(!newVal);
      setNotifMsg({ ok: false, text: 'Failed to update notification settings.' });
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    try {
      await apiChangePassword({ currentPassword: currentPw, newPassword: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwMsg({ ok: true, text: 'Password changed successfully.' });
    } catch (err) {
      setPwMsg({ ok: false, text: err.response?.data?.message || 'Failed to change password.' });
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteMsg({ ok: false, text: 'Please enter your password.' });
      return;
    }
    setDeleting(true);
    try {
      await apiDeleteAccount({ password: deletePassword });
      logoutUser();
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleteMsg({ ok: false, text: err.response?.data?.message || 'Incorrect password.' });
      setDeleting(false);
    }
  }

  async function handleSendWeeklyReview() {
    setSendingReview(true);
    try {
      await sendWeeklyReview();
      toast.success('Weekly review sent — check your inbox!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send weekly review');
    } finally {
      setSendingReview(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      {/* Profile */}
      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>Profile</h2>
        <form onSubmit={saveProfile} className={styles.form}>
          <label className={styles.label}>
            Display name
            <input
              className={styles.input}
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={user?.username}
              maxLength={50}
            />
          </label>
          <div className={styles.readOnlyRow}>
            <span className={styles.readOnlyLabel}>Username</span>
            <span className={styles.readOnlyValue}>{user?.username}</span>
          </div>
          <div className={styles.readOnlyRow}>
            <span className={styles.readOnlyLabel}>Email</span>
            <span className={styles.readOnlyValue}>{user?.email}</span>
          </div>
          {profileMsg && <p className={profileMsg.ok ? styles.ok : styles.err}>{profileMsg.text}</p>}
          <button type="submit" className={styles.btn}>Save profile</button>
        </form>
      </Card>

      {/* Study Goal */}
      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>Weekly Study Goal</h2>
        <form onSubmit={saveGoal} className={styles.form}>
          <label className={styles.label}>
            Target hours per week
            <input
              className={styles.input}
              type="number"
              min={1}
              max={168}
              value={weeklyGoalHours}
              onChange={e => setWeeklyGoalHours(e.target.value)}
            />
          </label>
          <p className={styles.hint}>This goal is used for the Goal Crusher badge and XP reward.</p>
          {goalMsg && <p className={goalMsg.ok ? styles.ok : styles.err}>{goalMsg.text}</p>}
          <button type="submit" className={styles.btn}>Save goal</button>
        </form>
      </Card>

      {/* Notifications */}
      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>Notifications</h2>
        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Email reminders</p>
            <p className={styles.toggleDesc}>Receive email reminders for events happening today or tomorrow.</p>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={remindersEnabled}
              onChange={e => toggleReminders(e.target.checked)}
            />
            <span className={styles.slider} />
          </label>
        </div>
        {notifMsg && <p className={notifMsg.ok ? styles.ok : styles.err}>{notifMsg.text}</p>}
      </Card>

      {/* Weekly Review */}
      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>Weekly Review</h2>
        <p className={styles.hint}>
          Every Sunday at 8 AM, Studifly emails you a personalized summary of your week —
          total study hours, tasks completed, most studied course, and an AI-generated tip for next week.
        </p>
        <button
          className={styles.btn}
          onClick={handleSendWeeklyReview}
          disabled={sendingReview}
        >
          {sendingReview ? 'Sending…' : 'Send me a weekly review now'}
        </button>
      </Card>

      {/* Export */}
      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>Export Data</h2>
        <p className={styles.hint}>Download your data as CSV files.</p>
        <div className={styles.exportGrid}>
          {['courses', 'tasks', 'sessions', 'events'].map(type => (
            <button key={type} className={styles.exportBtn} onClick={() => downloadCsv(type)}>
              Download {type}.csv
            </button>
          ))}
        </div>
      </Card>

      {/* Change Password */}
      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>Change Password</h2>
        <form onSubmit={handleChangePassword} className={styles.form}>
          <label className={styles.label}>
            Current password
            <input className={styles.input} type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />
          </label>
          <label className={styles.label}>
            New password
            <input className={styles.input} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={8} />
          </label>
          <label className={styles.label}>
            Confirm new password
            <input className={styles.input} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
          </label>
          {pwMsg && <p className={pwMsg.ok ? styles.ok : styles.err}>{pwMsg.text}</p>}
          <button type="submit" className={styles.btn}>Change password</button>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card className={`${styles.section} ${styles.dangerCard}`}>
        <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>Danger Zone</h2>
        <p className={styles.hint}>Permanently delete your account and all associated data. This action cannot be undone.</p>
        <button className={styles.dangerBtn} onClick={() => setDeleteOpen(true)}>Delete my account</button>
      </Card>

      {/* Delete Account Modal */}
      {deleteOpen && (
        <div className={styles.overlay} onClick={closeDeleteModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete Account</h3>
            <p className={styles.modalDesc}>
              This will permanently delete your account and all your data — courses, tasks, sessions, and events.
              Enter your password to confirm.
            </p>
            <form onSubmit={handleDeleteAccount} className={styles.form}>
              <label className={styles.label}>
                Password
                <input
                  className={styles.input}
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  autoFocus
                  required
                />
              </label>
              {deleteMsg && <p className={deleteMsg.ok ? styles.ok : styles.err}>{deleteMsg.text}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.btn} onClick={closeDeleteModal}>Cancel</button>
                <button type="submit" className={styles.dangerBtn} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Yes, delete everything'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
