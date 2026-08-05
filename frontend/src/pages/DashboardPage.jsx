import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

function DashboardPage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/health")
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1>Dashboard — coming soon</h1>
      {/* TEMP: connection test, remove once real dashboard is built */}
      <p>Backend connection test:</p>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {health && <pre>{JSON.stringify(health, null, 2)}</pre>}
      {!health && !error && <p>Loading...</p>}
    </div>
  );
}

export default DashboardPage;