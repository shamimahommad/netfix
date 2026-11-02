import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ActionDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerButton: HTMLButtonElement | null;
  children: React.ReactNode;
}

export function ActionDropdown({ isOpen, onClose, triggerButton, children }: ActionDropdownProps) {
  const [position, setPosition] = useState<{ top: number; left: number; placement: 'bottom' | 'top' } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !triggerButton) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = triggerButton.getBoundingClientRect();
      const dropdownHeight = 420; // Max height so positioning accounts for scrollable menu
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const shouldPlaceOnTop = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      // Calculate left position (right-aligned to button)
      let left = rect.right - 256; // 256px = w-64 (16rem)
      // Ensure dropdown doesn't go off-screen on the left
      if (left < 8) {
        left = 8;
      }
      // Ensure dropdown doesn't go off-screen on the right
      if (left + 256 > window.innerWidth - 8) {
        left = window.innerWidth - 256 - 8;
      }

      setPosition({
        top: shouldPlaceOnTop ? Math.max(8, rect.top - dropdownHeight) : rect.bottom + 4,
        left,
        placement: shouldPlaceOnTop ? 'top' : 'bottom',
      });
    };

    updatePosition();

    // Update position on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, triggerButton]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerButton &&
        !triggerButton.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    // Only close on outside click, not on scroll
    // The dropdown is positioned fixed, so it stays in place during scroll
    // Users can scroll the action list inside the dropdown without it closing
    document.addEventListener('mousedown', handleClickOutside, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen, onClose, triggerButton]);

  if (!isOpen || !position) {
    return null;
  }

  const dropdown = (
    <div
      ref={dropdownRef}
      className="fixed w-64 min-w-[16rem] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl z-[9999] overflow-hidden"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="py-1 max-h-[min(420px,calc(100vh-2rem))] overflow-y-auto">
        {children}
      </div>
    </div>
  );

  return createPortal(dropdown, document.body);
}
