import { createSignal } from 'solid-js';
import { audio } from '../../services/audio';
import '../../src/styles/login-material-preview.css';

interface LoginScreenProps {
  onLogin: () => void;
}

const backdropStyle = {
  '--login-bg-dim': '0',
  '--login-bg-blur': '0px',
  '--login-bg-scale': '1.06',
  '--login-bg-x': '-3px',
  '--login-bg-y': '-27px',
  '--login-bg-gold': '0',
  '--login-bg-dark': '0',
} as const;

const brandStyle = {
  '--login-brand-x': '0px',
  '--login-brand-y': '0px',
  '--login-brand-title-size': '26px',
  '--login-brand-tracking': '0.32em',
  'font-family': '"JetBrains Mono", "IBM Plex Sans Condensed", ui-monospace, monospace',
  'text-align': 'center',
} as const;

const authLayoutStyle = {
  '--login-auth-offset-y': '4rem',
  '--login-auth-gap': '0px',
} as const;

export const LoginScreen = (props: LoginScreenProps) => {
  const [isAuthenticating, setIsAuthenticating] = createSignal(false);

  const handleSocialLogin = () => {
    if (isAuthenticating()) return;
    audio.init();
    audio.playUiClick();
    setIsAuthenticating(true);
    props.onLogin();
  };

  return (
    <div class="login-material-phone login-screen-phone login-material-phone--light" style={backdropStyle}>
      <img class="login-material-bg" src="/art/login/login-social-bg.png" alt="" />
      <div class="login-material-bg-wash" />

      <div class="login-material-content">
        <div class="login-material-auth-select">
          <div class="login-material-auth" style={authLayoutStyle}>
            <div class="login-material-form">
              <div class="login-material-brand" style={brandStyle}>
                <h1>Cruel Company</h1>
              </div>

              <div class="login-material-divider">
                <span />
                <strong>Login With</strong>
                <span />
              </div>

              <div class="login-material-social-row">
                <button
                  class="login-material-provider-button login-material-provider-button--google"
                  type="button"
                  disabled={isAuthenticating()}
                  onClick={handleSocialLogin}
                >
                  <span class="login-material-provider-fallback">
                    <span class="login-material-provider-preview-icon login-material-provider-preview-icon--google">G</span>
                    <span>Sign in with Google</span>
                  </span>
                </button>

                <button
                  class="login-material-provider-button login-material-provider-button--apple"
                  type="button"
                  disabled={isAuthenticating()}
                  onClick={handleSocialLogin}
                >
                  <span class="login-material-provider-fallback">
                    <span class="login-material-provider-preview-icon login-material-provider-preview-icon--apple">Apple</span>
                    <span>Sign in with Apple</span>
                  </span>
                </button>

                <button
                  class="login-material-provider-button login-material-provider-button--facebook"
                  type="button"
                  disabled={isAuthenticating()}
                  onClick={handleSocialLogin}
                >
                  <span class="login-material-provider-fallback">
                    <span class="login-material-provider-preview-icon login-material-provider-preview-icon--facebook">f</span>
                    <span>Continue with Facebook</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
