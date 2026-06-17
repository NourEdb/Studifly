import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { resetPassword } from '../api/auth.api';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import styles from '../components/auth/AuthForm.module.css';
import logo from '../assets/studifly-logo.png';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError('');

    if (newPassword.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      toast.success('Password reset! You can now sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <img src={logo} alt="Studifly" />
          </div>
          <h2 className={styles.title}>Invalid link</h2>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
            This reset link is missing or malformed.
          </p>
          <p className={styles.footer}>
            <Link to="/forgot-password">Request a new link</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src={logo} alt="Studifly" />
          <p className={styles.tagline}>Learn, grow, and fly.</p>
        </div>
        <h2 className={styles.title}>Choose a new password</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            id="newPassword"
            label="New password"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            autoFocus
          />
          <Input
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />
          {localError && (
            <p style={{ fontSize: '0.85rem', color: '#E85454', margin: 0 }}>{localError}</p>
          )}
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Saving…' : 'Set new password'}
          </Button>
        </form>
        <p className={styles.footer}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
