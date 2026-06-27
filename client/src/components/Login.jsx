import { useState } from 'react';
import { Layers, LogIn, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import { setAuthToken } from '../utils/auth';

export default function Login({ publicConfig, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const title = publicConfig?.appTitle || 'Plusultra';
  const subtitle = publicConfig?.appSubtitle || 'Panel Docker universal';

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await api.login(username, password);
      setAuthToken(token);
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon-wrap login-icon">
            <Layers size={28} />
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <form onSubmit={submit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label>Usuario</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="plusultra"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <div className="password-field">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button type="button" className="btn btn-ghost btn-icon pass-toggle" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
            <LogIn size={18} />
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
