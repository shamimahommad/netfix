import Swal from 'sweetalert2';

const CUSTOM_CLASS = {
  popup: 'change-area-modal-sky-teal',
  title: 'change-area-modal-title',
  htmlContainer: 'change-area-modal-body',
  confirmButton: 'change-area-modal-confirm',
  cancelButton: 'change-area-modal-cancel',
};

/**
 * Opens SweetAlert2 Delete Customer confirmation modal.
 * - Only call when all selected customers are Left.
 * @returns Promise<boolean> - true if confirmed, false if cancelled
 */
export async function openDeleteCustomerModal(): Promise<boolean> {
  const result = await Swal.fire({
    title: 'Delete Customer',
    text: 'Permanently delete selected Left customers? This cannot be undone.',
    icon: 'warning',
    showCancelButton: true,
    showCloseButton: false,
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: CUSTOM_CLASS,
    iconColor: '#e11d48',
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
  });
  return Boolean(result.isConfirmed);
}
