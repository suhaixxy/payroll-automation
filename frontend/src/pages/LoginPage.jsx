import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconMail, IconLock, IconEye, IconEyeOff } from "../components/icons";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  function signIn(event) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setMessage("Enter your email address and password to continue.");
      return;
    }
    navigate("/");
  }

  return <main className="login-page">
    <style>{styles}</style>
    <section className="login-brand-panel">
      <div className="brand-orb" /><div className="brand-rings" /><div className="brand-dots" />
      <div className="brand-copy">
        <p>PAYROLL AUTOMATION SYSTEM</p><span />
        <h1>Emergencies First Aid &amp;<br />Rescue (EFAR)</h1>
        <div>Supporting healthcare professionals with secure, accurate and efficient payroll management.</div>
      </div>
      <footer>&copy; 2026 Emergencies First Aid &amp; Rescue<br />Version 1.0</footer>
    </section>
    <section className="login-form-panel">
      <form className="login-card" onSubmit={signIn}>
        <header><h2>Login</h2><p>Sign in to continue to your account</p></header>
        {message && <div className="login-message">{message}</div>}
        <label>Email address <span className="required">*</span>
          <div className="input-with-icon">
            <IconMail />
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Enter your email" autoComplete="email" />
          </div>
        </label>
        <label>Password <span className="required">*</span>
          <div className="input-with-icon">
            <IconLock />
            <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" />
            <button type="button" className="toggle-visibility" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
        </label>
        <button type="submit" className="submit">Log in</button>
        <p className="login-note">Demo screen: any non-empty email and password opens the dashboard.</p>
      </form>
    </section>
  </main>;
}

const styles = `
  .login-page{min-height:100vh;display:grid;grid-template-columns:minmax(400px,1.04fr) minmax(400px,.96fr);font-family:Inter,"Segoe UI",Roboto,Arial,sans-serif;text-align:left}
  .login-brand-panel{position:relative;isolation:isolate;overflow:hidden;min-height:100vh;display:flex;flex-direction:column;padding:clamp(54px,6.7vw,104px) clamp(54px,7.5vw,118px) 60px;color:#fff;background:radial-gradient(circle at 58% 43%,rgba(191,18,18,.26),transparent 29%),linear-gradient(138deg,#560000 0%,#820000 49%,#520000 100%)}
  .brand-copy{position:relative;z-index:2;margin-block:auto}
  .brand-copy p{font-size:.78rem;font-weight:750;letter-spacing:.24em}
  .brand-copy>span{display:block;width:122px;height:3px;margin:26px 0 23px;background:linear-gradient(90deg,#ff7777 0 72%,rgba(255,119,119,.32) 72% 86%,rgba(255,119,119,.13) 86%)}
  .brand-copy h1{margin:0;color:#fff;font-size:clamp(2.5rem,4.1vw,3.9rem);font-weight:750;line-height:1.15;letter-spacing:-.03em}
  .brand-copy div{margin-top:23px;color:rgba(255,255,255,.93);font-size:1.1rem;line-height:1.5;max-width:34ch}
  .login-brand-panel footer{position:relative;z-index:2;color:rgba(255,255,255,.82);font-size:.78rem;line-height:1.7}
  .brand-orb{position:absolute;width:340px;height:340px;top:-55px;right:-108px;border-radius:50%;background:rgba(177,22,22,.24)}
  .brand-rings{position:absolute;width:360px;height:360px;top:-210px;left:-188px;border:1px solid rgba(255,106,106,.22);border-radius:50%;box-shadow:0 0 0 49px rgba(255,106,106,.17),0 0 0 96px rgba(255,106,106,.13)}
  .brand-dots{position:absolute;top:70px;right:90px;width:96px;height:96px;background-image:radial-gradient(rgba(255,150,150,.55) 2px,transparent 2.4px);background-size:24px 24px;z-index:1}
  .login-form-panel{display:grid;place-items:center;padding:clamp(42px,7vw,110px);background:radial-gradient(circle at 90% 92%,rgba(122,0,0,.025),transparent 25%),#fdfdfd}
  .login-card{width:min(100%,510px);padding:42px;border-radius:16px;background:#fff;box-shadow:0 12px 38px rgba(24,24,24,.09)}
  .login-card header{margin:0 0 32px}
  .login-card h2{margin:0;color:#7a0000;font-size:2.3rem;letter-spacing:-.04em}
  .login-card header p{margin-top:9px;color:#666}
  .login-card label{display:grid;gap:8px;margin-top:22px;color:#252a34;font-size:.9rem;font-weight:700}
  .login-card .required{color:#b51d1d}
  .input-with-icon{position:relative;display:flex;align-items:center}
  .input-with-icon svg{position:absolute;left:17px;color:#9a9ea6;pointer-events:none}
  .login-card input{width:100%;min-height:55px;padding:0 17px 0 48px;border:1px solid #d7d9dd;border-radius:28px;color:#181818;font:inherit}
  .login-card input:focus{outline:3px solid rgba(122,0,0,.14);border-color:#7a0000}
  .toggle-visibility{position:absolute;right:14px;border:0;background:none;color:#9a9ea6;padding:6px;display:grid;place-items:center;cursor:pointer;border-radius:50%}
  .toggle-visibility:hover{color:#7a0000;background:#fdeeee}
  .login-card button.submit{width:100%;min-height:55px;margin-top:30px;border:0;border-radius:12px;color:#fff;background:linear-gradient(100deg,#8a0000,#730000);font:inherit;font-size:.92rem;font-weight:750;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
  .login-card button.submit:hover{background:#990000}
  .login-message{margin-bottom:14px;padding:11px 13px;border-radius:7px;color:#8b1b25;background:#fde7e7;font-size:.83rem}
  .login-note{margin-top:20px;color:#777;font-size:.73rem;text-align:center}
  @media(max-width:800px){.login-page{grid-template-columns:1fr}.login-brand-panel{min-height:360px;padding:42px 32px}.brand-copy{margin:auto 0}.brand-copy h1{font-size:2.4rem}.brand-dots{display:none}.login-form-panel{padding:42px 20px}.login-card{padding:30px 22px}}
`;

export default LoginPage;
