/**
 * @file App.tsx
 * @owner host-squad
 * @description Root component for the host display (served at /). This is the
 * host team's page. The server team's WebSocket debug console lives separately
 * at /console (see console/Console.tsx) so the two don't collide.
 */
export function App(): React.JSX.Element {
  return (
    <main className="app">
      <h1>Brain Wis</h1>
      <p>Host display — scaffold ready.</p>
    </main>
  )
}
