// client/src/AskForm.js
import { useState } from 'react';
import axios from 'axios';
axios.defaults.withCredentials = false;

export default function AskForm() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState(null);
  const [matches, setMatches] = useState([]);

  const handleAsk = async e => {
    e.preventDefault();
    setAnswer('Thinking…');
    try {
      const { data } = await axios.post('http://localhost:5000/ask', { query });
      setAnswer(data.answer);
      setMatches(data.retrieved);
    } catch (err) {
      setAnswer(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  return (
    <form onSubmit={handleAsk}>
      <h2>Ask the Bot</h2>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Travel tips Bangkok for a family"
      />
      <button type="submit">Ask</button>
      {answer && <p><strong>Answer:</strong> {answer}</p>}
      {matches.length > 0 && (
        <details>
          <summary>Retrieved Snippets</summary>
          <ul>
            {matches.map(m => (
              <li key={m.id}>
                ({m.metadata.location}) {m.metadata.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </form>
  );
}