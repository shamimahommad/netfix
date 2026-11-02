import Swal from 'sweetalert2';
import { resellerService, Reseller } from '@/services/reseller.service';

const CUSTOM_CLASS = {
  popup: 'transfer-to-reseller-modal-sky-teal',
  title: 'transfer-to-reseller-modal-title',
  htmlContainer: 'transfer-to-reseller-modal-body',
  confirmButton: 'transfer-to-reseller-modal-confirm',
  cancelButton: 'transfer-to-reseller-modal-cancel',
};

/**
 * Opens SweetAlert2 Transfer to Reseller modal.
 * - Reseller dropdown (Choose placeholder).
 * - Confirm / Cancel only; modal cannot be closed by clicking outside or ESC.
 * @returns Promise<string | null> - selected reseller userId if confirmed, null if cancelled
 */
export async function openTransferToResellerModal(): Promise<string | null> {
  let resellers: Reseller[] = [];
  try {
    const res = await resellerService.list({ status: 'active' });
    resellers = res.data || [];
  } catch {
    await Swal.fire({
      title: 'Error',
      text: 'Failed to load resellers.',
      icon: 'error',
      customClass: CUSTOM_CLASS,
    });
    return null;
  }

  const inputOptions: Record<string, string> = { '': 'Choose' };
  resellers.forEach((r) => {
    inputOptions[r.userId] = `${r.name || r.username} (${r.username})`;
  });

  const result = await Swal.fire({
    title: 'Transfer to Reseller',
    text: 'Choose a reseller to transfer the selected customers.',
    input: 'select',
    inputOptions,
    inputPlaceholder: 'Choose',
    showCancelButton: true,
    showCloseButton: false,
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: CUSTOM_CLASS,
    icon: 'question',
    iconColor: '#0ea5e9',
    confirmButtonColor: '#0d9488',
    cancelButtonColor: '#64748b',
    inputValidator: (value) => {
      if (!value || value === '') {
        return 'Please choose a reseller.';
      }
      return null;
    },
  });

  if (!result.isConfirmed || !result.value || result.value === '') return null;
  return result.value;
}
