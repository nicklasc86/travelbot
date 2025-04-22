import { useState } from 'react';
import axios from 'axios';

// you can leave this if you don't want cookies ever sent
axios.defaults.withCredentials = false;

export default function TipForm() {
  const [tip, setTip] = useState('');
  const [status, setStatus] = useState(null);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      // 1) Send the request and destructure `data` from the response
      const { data } = await axios.post(
        'http://localhost:5000/ingest',
        { tip_text: tip },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      // 2) Update state on success
      setStatus(`Saved tip (${data.id}) in ${data.metadata.location}`);
      setTip('');
    } catch (err) {
      // 3) Handle errors
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