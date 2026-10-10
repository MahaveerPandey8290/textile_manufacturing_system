import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { logoFileToDataUrl } from '../../utils/imageResize';
import { OrganizationMark } from './OrganizationMark';

/** Pick or drop a logo; it is resized in the browser and handed back as a data URL. */
export function LogoUpload({ value, onChange, organizationName, error }) {
  const fileInput = useRef(null);
  const [problem, setProblem] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const acceptFile = async (file) => {
    if (!file) return;
    setProblem('');
    try {
      onChange(await logoFileToDataUrl(file));
    } catch (failure) {
      setProblem(failure.message);
    }
  };

  return (
    <div
      className={`logo-upload ${isDragging ? 'is-dragging' : ''} ${error || problem ? 'has-error' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        acceptFile(event.dataTransfer.files?.[0]);
      }}
    >
      <OrganizationMark name={organizationName || 'Your mill'} logoUrl={value} size={64} />
      <div className="logo-upload__text">
        <strong>{value ? 'Looks good' : 'Company logo'}</strong>
        <span className="muted">{problem || error || 'PNG, JPG or WebP. Drag it here or choose a file.'}</span>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <button type="button" className="button button--secondary button--sm" onClick={() => fileInput.current?.click()}>
            <ImagePlus size={14} />
            <span>{value ? 'Change' : 'Choose file'}</span>
          </button>
          {value && (
            <button type="button" className="button button--ghost button--sm" onClick={() => onChange('')}>
              <Trash2 size={14} />
              <span>Remove</span>
            </button>
          )}
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          acceptFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
}
