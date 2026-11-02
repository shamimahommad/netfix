/**
 * SweetAlert2 Utility
 * 
 * Provides beautiful, customizable alert dialogs for the application.
 * 
 * Usage Examples:
 * 
 * // Success alert
 * await showSuccess('Success!', 'Operation completed successfully.');
 * 
 * // Error alert
 * await showError('Error!', 'Something went wrong.');
 * 
 * // Confirmation dialog
 * const result = await showConfirm('Are you sure?', 'This action cannot be undone.');
 * if (result.isConfirmed) {
 *   // User clicked "Yes"
 * }
 * 
 * // Delete confirmation
 * const result = await showDeleteConfirm('Customer Name');
 * if (result.isConfirmed) {
 *   // Proceed with deletion
 * }
 * 
 * // Loading indicator
 * showLoading('Processing...', 'Please wait while we process your request.');
 * // ... do async work ...
 * closeAlert(); // Close when done
 */

import Swal from 'sweetalert2';

// Modern modal look – use customClass so CSS can style
const customClass = {
  popup: 'swal-modern-popup',
  title: 'swal-modern-title',
  htmlContainer: 'swal-modern-body',
  confirmButton: 'swal-modern-confirm',
  cancelButton: 'swal-modern-cancel',
  icon: 'swal-modern-icon',
  actions: 'swal-modern-actions',
};

// Configure default options
const defaultOptions = {
  confirmButtonColor: '#3b82f6',
  cancelButtonColor: '#6b7280',
  confirmButtonText: 'Yes',
  cancelButtonText: 'Cancel',
  buttonsStyling: true,
  allowOutsideClick: false,
  allowEscapeKey: true,
  customClass,
};

export interface ShowSuccessOptions {
  /** Auto-close after this many milliseconds (e.g. 1500 for 1.5 sec) */
  timer?: number;
  /** Show a progress bar for the timer */
  timerProgressBar?: boolean;
}

/**
 * Show a success alert. Pass { timer: 1500 } to auto-close after 1.5 seconds.
 */
export const showSuccess = (title: string, message?: string, options?: ShowSuccessOptions) => {
  const opts = options?.timer
    ? {
        timer: options.timer,
        timerProgressBar: options.timerProgressBar ?? true,
        showConfirmButton: false,
      }
    : {};
  return Swal.fire({
    ...defaultOptions,
    icon: 'success',
    title,
    text: message,
    confirmButtonColor: '#10b981',
    customClass: { ...customClass, icon: 'swal-modern-icon swal-modern-icon-success' },
    ...opts,
  });
};

/**
 * Show an error alert
 */
export const showError = (title: string, message?: string) => {
  return Swal.fire({
    ...defaultOptions,
    icon: 'error',
    title,
    text: message,
    confirmButtonColor: '#ef4444',
    customClass: { ...customClass, icon: 'swal-modern-icon swal-modern-icon-error' },
  });
};

/**
 * Show a warning alert
 */
export const showWarning = (title: string, message?: string) => {
  return Swal.fire({
    ...defaultOptions,
    icon: 'warning',
    title,
    text: message,
    confirmButtonColor: '#f59e0b',
    customClass: { ...customClass, icon: 'swal-modern-icon swal-modern-icon-warning' },
  });
};

/**
 * Show an info alert
 */
export const showInfo = (title: string, message?: string) => {
  return Swal.fire({
    ...defaultOptions,
    icon: 'info',
    title,
    text: message,
    confirmButtonColor: '#3b82f6',
    customClass: { ...customClass, icon: 'swal-modern-icon swal-modern-icon-info' },
  });
};

/**
 * Show a confirmation dialog
 */
export const showConfirm = (
  title: string,
  message?: string,
  confirmText: string = 'Yes, proceed',
  cancelText: string = 'Cancel',
  confirmColor: string = '#ef4444',
) => {
  return Swal.fire({
    icon: 'warning',
    title,
    text: message,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: confirmColor,
    cancelButtonColor: defaultOptions.cancelButtonColor,
    buttonsStyling: true,
    allowOutsideClick: false,
    allowEscapeKey: true,
    customClass: { ...customClass, icon: 'swal-modern-icon swal-modern-icon-warning' },
  });
};

/**
 * Show a delete confirmation dialog
 */
export const showDeleteConfirm = (itemName: string, message?: string) => {
  return showConfirm(
    'Are you sure?',
    message || `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
    'Yes, delete it!',
    'Cancel',
    '#ef4444', // red-500
  );
};

/**
 * Show a loading alert
 */
export const showLoading = (title: string = 'Please wait...', message?: string) => {
  Swal.fire({
    title,
    text: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: { ...customClass, popup: 'swal-modern-popup swal-modern-loading' },
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

/**
 * Show a modal with a colorful animated progress bar (e.g. for PPP MAC Bind/Unbind All).
 * Close with closeAlert() when done, then show success/error as needed.
 */
export const showProgressBar = (title: string, message?: string) => {
  Swal.fire({
    title,
    html: `
      <p class="swal-progress-message">${message || 'Please wait...'}</p>
      <div class="swal-progress-track">
        <div class="swal-progress-fill"></div>
      </div>
    `,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    customClass: {
      popup: 'swal-modern-popup swal-progress-popup',
      htmlContainer: 'swal-progress-container',
    },
  });
};

/**
 * Close the current alert
 */
export const closeAlert = () => {
  Swal.close();
};

// Export Swal for advanced usage
export { Swal };
