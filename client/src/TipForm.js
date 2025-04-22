import { useState } from 'react';
import axios from 'axios';

// disable cookies
axios.defaults.withCredentials = false;

export default function TipForm() {
  const [tip, setTip] = useState('');
  const [status, setStatus] = useState(null);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const { data } = await axios.post(
        'http://localhost:5000/ingest',
        { tip_text: tip },
        { headers: { 'Content-Type': 'application/json' } }
      );

      // Branch on status returned by your API
      if (data.status === 'approved') {
        const { city, country } = data.metadata;
        setStatus(`👍 Tip saved (${data.id}) for ${city}, ${country}`);
      } else if (data.status === 'review_needed') {
        setStatus(`🔎 Tip queued for review: ${data.reason}`);
      } else {
        // Fallback for unexpected shape
        setStatus(`ℹ️ Response: ${JSON.stringify(data)}`);
      }

      setTip('');
    } catch (err) {
      setStatus(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Add a Travel Tip</h2>
      <textarea
        value={tip}
        onChange={e => setTip(e.target.value)}
        rows={4}
        placeholder="e.g. Thai beach in Bangkok is nice for families"
      />
      <button type="submit">Submit Tip</button>
      {status && <p>{status}</p>}
    </form>
  );
}