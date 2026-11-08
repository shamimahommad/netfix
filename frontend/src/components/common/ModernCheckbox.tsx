import React, { useRef, useEffect } from 'react';

export interface ModernCheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean, e: React.ChangeEvent<HTMLInputElement>) => void;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  title?: string;
  id?: string;
  name?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}

export const ModernCheckbox: React.FC<ModernCheckboxProps> = ({
  checked = false,
  indeterminate = false,
  onChange,
  onClick,
  disabled = false,
  title,
  id,
  name,
  className = '',
  size = 'md',
  ariaLabel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate && !checked);
    }
  }, [indeterminate, checked]);

  const sizeClasses = {
    sm: 'w-4 h-4 rounded-[4px]',
    md: 'w-[18px] h-[18px] rounded-[5px]',
    lg: 'w-5 h-5 rounded-[6px]',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  const isChecked = checked;
  const isIndeterminate = !checked && indeterminate;

  return (
    <label
      title={title}
      className={`relative inline-flex items-center justify-center select-none cursor-pointer group ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${className}`}
      onClick={(e) => {
        if (onClick) onClick(e);
      }}
    >
      <input
        ref={inputRef}
        type="checkbox"
        id={id}
        name={name}
        aria-label={ariaLabel || title}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked, e)}
        className="sr-only peer"
      />
      <div
        className={`
          ${sizeClasses}
          flex items-center justify-center
          border transition-all duration-150 ease-out
          ${
            isChecked || isIndeterminate
              ? 'bg-blue-600 border-blue-600 text-white shadow-xs shadow-blue-500/25 dark:bg-blue-600 dark:border-blue-500'
              : 'bg-white dark:bg-slate-800/80 border-slate-300 dark:border-slate-600 text-transparent group-hover:border-blue-400 dark:group-hover:border-blue-400 group-hover:bg-slate-50 dark:group-hover:bg-slate-750'
          }
          peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/50 peer-focus-visible:ring-offset-1 dark:peer-focus-visible:ring-offset-slate-900
          active:scale-95
        `}
      >
        {isChecked && (
          <svg
            className={`${iconSizes} stroke-current text-white stroke-[2.75] fill-none`}
            viewBox="0 0 24 24"
          >
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {isIndeterminate && (
          <svg
            className={`${iconSizes} stroke-current text-white stroke-[2.75] fill-none`}
            viewBox="0 0 24 24"
          >
            <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
          </svg>
        )}
      </div>
    </label>
  );
};

export default ModernCheckbox;

