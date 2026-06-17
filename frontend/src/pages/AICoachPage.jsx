import { useState, useEffect, useRef } from 'react';
import { getCoachContext, getChatHistory, sendChatMessage, clearChatHistory } from '../api/ai-coach.api';
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
  const [historyLoading, setHistoryLoading] = useState(true);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    getCoachContext()
      .then(setContext)
      .finally(() => setCtxLoading(false));

    getChatHistory()
      .then(({ messages: history }) => setMessages(history))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);
    setClearConfirm(false);

    try {
      const { reply } = await sendChatMessage(trimmed);
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

  async function handleClearConfirmed() {
    setClearing(true);
    try {
      await clearChatHistory();
      setMessages([]);
      setClearConfirm(false);
    } finally {
      setClearing(false);
    }
  }

  function exportConversation() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10);
    const dateLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const header = `Studifly AI Coach — Conversation exported on ${dateLabel}\n\n`;
    const body = messages.map((m, i) => {
      const prefix = m.role === 'user' ? 'You' : 'AI Coach';
      const line = `${prefix}: ${m.content}`;
      const addBlank = m.role === 'assistant' && i < messages.length - 1;
      return addBlank ? line + '\n' : line;
    }).join('\n');
    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studifly-ai-coach-${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy(index, content) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(idx => idx === index ? null : idx), 1500);
    } catch {
      // clipboard not available — silently fail
    }
  }

  const bestHours = context?.bestHours?.length
    ? context.bestHours.join(', ')
    : '—';

  const isLoading = historyLoading || ctxLoading;

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
        <div className={styles.chatHeader}>
          <span className={styles.chatTitle}>Conversation</span>
          <div className={styles.chatHeaderActions}>
            <button
              className={styles.exportBtn}
              onClick={exportConversation}
              disabled={messages.length === 0}
              title="Export conversation as .txt"
            >
              Export
            </button>
            {!clearConfirm ? (
              <button
                className={styles.newChatBtn}
                onClick={() => setClearConfirm(true)}
                disabled={messages.length === 0 || loading || clearing}
              >
                New conversation
              </button>
            ) : (
              <div className={styles.clearConfirm}>
                <span className={styles.clearConfirmText}>Clear all history?</span>
                <button
                  className={styles.clearConfirmYes}
                  onClick={handleClearConfirmed}
                  disabled={clearing}
                >
                  {clearing ? 'Clearing…' : 'Yes, clear'}
                </button>
                <button
                  className={styles.clearConfirmCancel}
                  onClick={() => setClearConfirm(false)}
                  disabled={clearing}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.chatMessages}>
          {isLoading && (
            <div className={styles.emptyState}>
              <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
            </div>
          )}

          {!isLoading && messages.length === 0 && (
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

          {!isLoading && messages.map((m, i) => (
            <div key={i} className={[styles.bubble, m.role === 'user' ? styles.user : styles.assistant].join(' ')}>
              {m.role === 'assistant' && <span className={styles.bubbleIcon}>🧠</span>}
              {m.role === 'assistant' ? (
                <div className={styles.bubbleGroup}>
                  <p className={styles.bubbleText}>{m.content}</p>
                  <button
                    className={[styles.copyBtn, copiedIndex === i ? styles.copyBtnDone : ''].join(' ')}
                    onClick={() => handleCopy(i, m.content)}
                    title="Copy message"
                  >
                    {copiedIndex === i ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>
              ) : (
                <p className={styles.bubbleText}>{m.content}</p>
              )}
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
            disabled={loading || historyLoading}
          />
          <button type="submit" className={styles.sendBtn} disabled={loading || historyLoading || !input.trim()}>
            Send
          </button>
        </form>
      </Card>
    </div>
  );
}
