import { Tank } from './tank/Tank';

export function App() {
  return (
    <main style={{ height: '100%' }}>
      <h1 className="visually-hidden">Stock Fish</h1>
      <Tank />
    </main>
  );
}
