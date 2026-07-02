import SatplexSpinner from './SatplexSpinner.tsx';

export default function TestSpinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: 64, background: '#000' }}>
      <SatplexSpinner size={24} />
      <SatplexSpinner size={48} />
      <SatplexSpinner size={200} />
    </div>
  );
}