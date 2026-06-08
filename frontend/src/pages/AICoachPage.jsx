import { useState, useEffect, useRef } from 'react';
import { getCoachContext, sendChatMessage } from '../api/ai-coach.api';
import Card from '../components/ui/Card';
import styles from './AICoachPage.module.css';

const SUGGESTIONS = [
  'How am I doing this week?',
  'Which course needs more attention?',
  'When should I study today?',
];

function fmtHours(h) {
  if (!h) return '—';
  return h >= 1 ? `${h}h` : `${Math.round(h * 60)}m`;
}

function InsightCard({ icon, label, value, sub }) {
  return (
    <div className={styles.insight}>
      <span className={styles.insightIcon}>{icon}</span>
      <div>
        <p className={styles.insightLabel}>{label}</p>
        <p className={styles.insightValue}>{value}</p>
        {sub && <p className={styles.insightSub}>{sub}</p>}
      </div>
    </div>
  );
}

export default function AICoachPage() {
  const [context, setContext] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    getCoachContext()
      .then(setContext)
      .finally(() => setCtxLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const { reply } = await sendChatMessage(next);
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(m => [...m, {
        role: 'assistant',
        content: "Sorry, I couldn't reach the AI server right now. Please check that GROQ_API_KEY is configured and try again.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  const bestHours = context?.bestHours?.length
    ? context.bestHours.join(', ')
    : '—';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerIcon}>🧠</span>
        <div>
          <h1 className={styles.headerTitle}>AI Coach</h1>
          <p className={styles.headerSub}>Personalized advice based on your real study data</p>
        </div>
      </div>

      {/* Insight cards */}
      <div className={styles.insights}>
        <InsightCard
          icon="⏰"
          label="Peak hours"
          value={ctxLoading ? '…' : bestHours}
          sub="Your most productive times"
        />
        <InsightCard
          icon="📚"
          label="Most studied"
          value={ctxLoading ? '…' : (context?.mostStudiedCourse || 'No courses yet')}
          sub={context?.mostStudiedSeconds ? fmtHours(context.mostStudiedSeconds / 3600) + ' total' : null}
        />
        <InsightCard
          icon="⏱️"
          label="Avg session"
          value={ctxLoading ? '…' : (context?.avgSessionMinutes ? `${context.avgSessionMinutes} min` : '—')}
          sub={context?.totalSessions ? `${context.totalSessions} sessions logged` : null}
        />
        <InsightCard
          icon="✅"
          label="Completion rate"
          value={ctxLoading ? '…' : `${context?.completionRate ?? 0}%`}
          sub={context?.totalTasks ? `${context.completedTasks} of ${context.totalTasks} tasks` : null}
        />
      </div>

      {/* Chat */}
      <Card className={styles.chatCard}>
        <div className={styles.chatMessages}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>💬</span>
              <p>Ask me anything about your study habits.</p>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className={styles.chip} onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={[styles.bubble, m.role === 'user' ? styles.user : styles.assistant].join(' ')}>
              {m.role === 'assistant' && <span className={styles.bubbleIcon}>🧠</span>}
              <p className={styles.bubbleText}>{m.content}</p>
            </div>
          ))}

          {loading && (
            <div className={[styles.bubble, styles.assistant].join(' ')}>
              <span className={styles.bubbleIcon}>🧠</span>
              <p className={styles.typing}><span /><span /><span /></p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className={styles.inputRow}>
          <input
            className={styles.input}
            placeholder="Ask your AI Coach…"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className={styles.sendBtn} disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </Card>
    </div>
  );
}
