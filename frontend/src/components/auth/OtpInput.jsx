import { useRef } from 'react';

/** Six boxes for a one-time code. Typing moves forward, Backspace moves back, paste fills all. */
export function OtpInput({ value, onChange, length = 6, autoFocus = true, disabled = false }) {
  const inputs = useRef([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  const setDigits = (nextDigits) => onChange(nextDigits.join('').replace(/\D/g, '').slice(0, length));
  const focus = (index) => inputs.current[Math.max(0, Math.min(length - 1, index))]?.focus();

  const handleChange = (index, text) => {
    const typed = text.replace(/\D/g, '');
    if (!typed) return;
    const next = [...digits];
    // Typing several digits at once (autofill from SMS/email) spreads them across boxes.
    typed.split('').forEach((digit, offset) => {
      if (index + offset < length) next[index + offset] = digit;
    });
    setDigits(next);
    focus(index + typed.length);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) next[index] = '';
      else if (index > 0) {
        next[index - 1] = '';
        focus(index - 1);
      }
      setDigits(next);
    } else if (event.key === 'ArrowLeft') focus(index - 1);
    else if (event.key === 'ArrowRight') focus(index + 1);
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    focus(pasted.length);
  };

  return (
    <div className="otp-input" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => (inputs.current[index] = element)}
          className="otp-input__box"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`Digit ${index + 1} of ${length}`}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}
