import { useEffect, useState } from 'react';
import axios from 'axios';

export default function AdminReview() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Track manual edits for low-confidence metadata
  const [edits, setEdits] = useState({});

  // Fetch review queue on mount
  useEffect(() => {
    axios.get('http://localhost:5000/admin/review')
      .then(res => {
        setQueue(res.data);
        // Initialize edits for each tip
        const initialEdits = {};
        res.data.forEach(t => {
          initialEdits[t.id] = { city: t.city || '', country: t.country || '' };
        });
        setEdits(initialEdits);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  const handleEditChange = (id, field, value) => {
    setEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleApprove = (id, reason) => {
    const override = {};
    // If low metadata confidence, include edited fields
    if (reason === 'low metadata confidence') {
      const { city, country } = edits[id];
      override.city = city;
      override.country = country;
    }
    axios.post(`http://localhost:5000/admin/approve/${id}`, override)
      .then(() => setQueue(q => q.filter(t => t.id !== id)))
      .catch(err => console.error('approve error:', err));
  };

  const handleReject = id => {
    axios.post(`http://localhost:5000/admin/reject/${id}`)
      .then(() => setQueue(q => q.filter(t => t.id !== id)))
      .catch(err => console.error('reject error:', err));
  };

  if (loading) return <p>Loading review queue...</p>;
  if (error)   return <p>Error loading queue: {error.message}</p>;

  return (
    <div>
      <h2>Admin: Review Tips</h2>
      {queue.length === 0 ? (
        <p>No tips awaiting review.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {queue.map(tip => (
            <li key={tip.id} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
              <p><strong>Tip:</strong> {tip.text}</p>
              <p><strong>Reason:</strong> {tip.reason}</p>

              {tip.reason === 'low metadata confidence' && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <label>
                    City: <input
                      type="text"
                      value={edits[tip.id]?.city || ''}
                      onChange={e => handleEditChange(tip.id, 'city', e.target.value)}
                      placeholder="Enter city"
                    />
                  </label>
                  <label style={{ marginLeft: '1rem' }}>
                    Country: <input
                      type="text"
                      value={edits[tip.id]?.country || ''}
                      onChange={e => handleEditChange(tip.id, 'country', e.target.value)}
                      placeholder="Enter country"
                    />
                  </label>
                </div>
              )}

              <button
                onClick={() => handleApprove(tip.id, tip.reason)}
                style={{ marginRight: '0.5rem' }}
              >
                Approve
              </button>
              <button onClick={() => handleReject(tip.id)}>
                Reject
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
