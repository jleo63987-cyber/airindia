import { useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, User } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import Brand from "../components/Brand";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const { mode } = useParams();
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const location = useLocation();
  const { user, configured, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (user) return <Navigate to="/app/overview" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (isRegister) {
        const data = await signUp({ fullName, email, password });
        if (data.session) {
          navigate("/app/overview", { replace: true });
        } else {
          setMessage("Account created. Check your email to confirm your address, then sign in.");
        }
      } else {
        await signIn({ email, password });
        navigate(location.state?.from || "/app/overview", { replace: true });
      }
    } catch (authError) {
      setError(authError.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (authError) {
      setError(authError.message || "Google sign in failed.");
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetPassword(email);
      setMessage("Password reset email sent.");
    } catch (authError) {
      setError(authError.message || "Unable to send reset email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="auth-grid" />
        <Link to="/" className="auth-brand"><Brand /></Link>
        <div className="auth-message">
          <span className="auth-kicker"><ShieldCheck size={16} /> Secure remote support</span>
          <h1>Connect clearly.<br/>Support confidently.</h1>
          <p>A transparent workspace for approved Android support sessions, file exchange and team activity.</p>
          <ul><li><Check size={16}/> Visible consent on every session</li><li><Check size={16}/> Supabase-backed authentication</li><li><Check size={16}/> Ready for Android + WebRTC integration</li></ul>
        </div>
        <div className="auth-orb auth-orb-one"/><div className="auth-orb auth-orb-two"/>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-mobile-brand"><Brand /></div>
        <form className="auth-form" onSubmit={submit}>
          <span className="auth-form-icon"><LockKeyhole size={23}/></span>
          <h2>{isRegister ? "Create your workspace" : "Welcome back"}</h2>
          <p>{isRegister ? "Set up your AirLink support dashboard." : "Sign in to manage your connected devices."}</p>

          {!configured && <div className="auth-alert error">Supabase environment variables are missing. Configure <code>.env</code> before signing in.</div>}
          {error && <div className="auth-alert error">{error}</div>}
          {message && <div className="auth-alert success">{message}</div>}

          {isRegister && (
            <label>Full name<div className="input-wrap"><User size={17}/><input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name"/></div></label>
          )}
          <label>Email address<div className="input-wrap"><Mail size={17}/><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com"/></div></label>
          <label>Password<div className="input-wrap"><LockKeyhole size={17}/><input type={showPassword ? "text" : "password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters"/><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>

          {!isRegister && <div className="auth-options"><span>Secure session login</span><button type="button" onClick={handleReset}>Forgot password?</button></div>}
          {isRegister && <label className="terms-check"><input type="checkbox" required/> I agree to the responsible-use terms and consent requirements.</label>}
          <button disabled={busy || !configured} className="btn btn-primary full-width auth-submit" type="submit">{busy ? "Please wait…" : isRegister ? "Create workspace" : "Sign in"}<ArrowRight size={17}/></button>
          <div className="auth-divider"><span>or continue with</span></div>
          <button disabled={busy || !configured} type="button" className="google-button" onClick={handleGoogle}><b>G</b> Continue with Google</button>
          <p className="auth-switch">{isRegister ? "Already have an account?" : "New to AirLink?"} <Link to={isRegister ? "/auth/login" : "/auth/register"}>{isRegister ? "Sign in" : "Create account"}</Link></p>
        </form>
      </div>
    </div>
  );
}
