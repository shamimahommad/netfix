import Swal from 'sweetalert2';

const CUSTOM_CLASS = {
  popup: 'change-area-modal-sky-teal',
  title: 'change-area-modal-title',
  htmlContainer: 'change-area-modal-body',
  confirmButton: 'change-area-modal-confirm',
  cancelButton: 'change-area-modal-cancel',
};

/**
 * Opens SweetAlert2 Left Customer confirmation modal.
 * - Confirm / Cancel only; modal cannot be closed by clicking outside or ESC.
 * @returns Promise<boolean> - true if confirmed, false if cancelled
 */
export async function openLeftCustomerModal(): Promise<boolean> {
  const result = await Swal.fire({
    title: 'Left Customer',
    text: 'Mark selected customers as Left? They will be terminated and PPPoE removed from MikroTik.',
    icon: 'warning',
    showCancelButton: true,
    showCloseButton: false,
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: CUSTOM_CLASS,
    iconColor: '#0ea5e9',
    confirmButtonColor: '#0d9488',
    cancelButtonColor: '#64748b',
  });
  return Boolean(result.isConfirmed);
}
