import { Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { PASSWORD_RULES } from '../../utils/emailRules';

export function PasswordInput({ value, onChange, autoComplete = 'current-password', showRules = false, id, ...rest }) {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <>
      <div className="password-input">
        <input
          id={id}
          className="input"
          type={isVisible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...rest}
        />
        <button type="button" className="icon-button" onClick={() => setIsVisible((visible) => !visible)} aria-label={isVisible ? 'Hide password' : 'Show password'}>
          {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {showRules && (
        <ul className="password-rules">
          {PASSWORD_RULES.map((rule) => (
            <li key={rule.id} className={rule.test(value) ? 'is-met' : ''}>
              <Check size={12} /> {rule.label}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
