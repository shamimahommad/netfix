import Swal from 'sweetalert2';

const SUSPEND_RESTORE_TEXT =
  'If the user is currently suspended, the system will restore them; otherwise, the user will be suspended.';

/**
 * Opens SweetAlert2 Suspend/Restore confirmation modal.
 * - Checkbox: "I accept Terms and Conditions."
 * - Confirm / Cancel only; modal cannot be closed by clicking outside or ESC.
 * @returns Promise<boolean> - true if user confirmed and accepted terms, false if cancelled
 */
export async function openSuspendRestoreModal(): Promise<boolean> {
  const result = await Swal.fire({
    title: 'Suspend / Restore',
    text: SUSPEND_RESTORE_TEXT,
    icon: 'warning',
    input: 'checkbox',
    inputPlaceholder: 'I accept Terms and Conditions.',
    inputValidator: (value) => {
      if (!value) {
        return 'You must accept the Terms and Conditions to continue.';
      }
      return null;
    },
    showCancelButton: true,
    showCloseButton: false,
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: {
      popup: 'suspend-restore-modal-sky-teal',
      title: 'suspend-restore-modal-title',
      htmlContainer: 'suspend-restore-modal-body',
      confirmButton: 'suspend-restore-modal-confirm',
      cancelButton: 'suspend-restore-modal-cancel',
    },
    iconColor: '#0ea5e9',
    confirmButtonColor: '#0d9488',
    cancelButtonColor: '#64748b',
  });
  return Boolean(result.isConfirmed && result.value);
}
