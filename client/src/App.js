// client/src/App.js
import TipForm from './TipForm';
import AskForm from './AskForm';

export default function App() {
  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>TravelBot</h1>
      <TipForm />
      <hr />
      <AskForm />
    </div>
  );
}