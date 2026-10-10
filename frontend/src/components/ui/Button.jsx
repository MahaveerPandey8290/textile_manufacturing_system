import { Loader2 } from 'lucide-react';

export function Button({ variant = 'primary', size = 'md', icon: Icon, isLoading = false, children, className = '', ...rest }) {
  return (
    <button className={`button button--${variant} button--${size} ${className}`} disabled={isLoading || rest.disabled} {...rest}>
      {isLoading ? <Loader2 className="spin" size={16} /> : Icon ? <Icon size={16} /> : null}
      {children && <span>{children}</span>}
    </button>
  );
}
