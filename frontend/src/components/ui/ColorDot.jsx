export default function ColorDot({ color, size = 10 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color || 'var(--color-purple)',
        flexShrink: 0,
      }}
    />
  );
}
