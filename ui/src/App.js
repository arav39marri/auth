import "./App.css";
import axios from "axios";
import { useEffect, useState } from "react";

function App() {
  const [user, setUser] = useState(null);      // null = not known yet
  const [loading, setLoading] = useState(true); // for initial /me request

  // Call backend to see if user is already logged in (cookie present)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("http://localhost:5000/me", {
          withCredentials: true, // IMPORTANT to send cookies
        });
        setUser(res.data.user); // { name, email, picture, ... }
      } catch (err) {
        console.error("Not logged in or error:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    window.location.href = "http://localhost:5000/auth/google";
  };

  const handleLogout = async (e) => {
    e.preventDefault() ;
    try {
      await axios.post(
        "http://localhost:5000/logout",
        {},
        { withCredentials: true }
      );
      setUser(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: "1rem" }}>
      {!user ? (
        <>
          <h2>You are not logged in</h2>
          <button onClick={handleLogin}>Sign in with Google</button>
        </>
      ) : (
        <>
          <h1>Welcome, {user.name}</h1>
          <p>{user.email}</p>
          {user.picture && (
            <img
              src={user.picture}
              alt={user.name}
              style={{ borderRadius: "50%", width: 80, height: 80 }}
            />
          )}
          <br />
          <button onClick={handleLogout}>Logout</button>
        </>
      )}
    </div>
  );
}

export default App;
