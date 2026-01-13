import type { WelcomeScreenProps } from './types';

import './WelcomeScreen.css';

export type { WelcomeScreenProps };

export function WelcomeScreen({
  appName = 'Codex Desktop',
  children,
}: WelcomeScreenProps) {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <h1 className="welcome-title">{appName}</h1>
      </div>
      {children && <div className="welcome-input">{children}</div>}
    </div>
  );
}

export default WelcomeScreen;
