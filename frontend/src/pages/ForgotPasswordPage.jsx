import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { forgotPassword } from '../api/auth.api';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import styles from '../components/auth/AuthForm.module.css';
import logo from '../assets/studifly-logo.png';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src={logo} alt="Studifly" />
          <p className={styles.tagline}>Learn, grow, and fly.</p>
        </div>

        {submitted ? (
          <>
            <h2 className={styles.title}>Check your email</h2>
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
              If that email address is registered, we've sent a password reset link. Check your inbox — the link expires in 1 hour.
            </p>
            <p className={styles.footer}>
              <Link to="/login">Back to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <h2 className={styles.title}>Reset your password</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              <Input
                id="email"
                label="Email address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
            <p className={styles.footer}>
              Remember your password? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
