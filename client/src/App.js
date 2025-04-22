import { useState } from 'react';
import TipForm from './TipForm';
import AskForm from './AskForm';
import AdminReview from './AdminReview';

export default function App() {
  const [tab, setTab] = useState('tip');

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>TravelBot</h1>
      <nav>
        <button onClick={() => setTab('tip')}>Add Tip</button>
        <button onClick={() => setTab('ask')}>Ask Bot</button>
        <button onClick={() => setTab('admin')}>Admin Review</button>
      </nav>
      <hr />
      {tab === 'tip' && <TipForm />}
      {tab === 'ask' && <AskForm />}
      {tab === 'admin' && <AdminReview />}
    </div>
  );
}