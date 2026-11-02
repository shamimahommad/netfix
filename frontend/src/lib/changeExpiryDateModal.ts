import Swal from 'sweetalert2';

const CUSTOM_CLASS = {
  popup: 'change-area-modal-sky-teal',
  title: 'change-area-modal-title',
  htmlContainer: 'change-area-modal-body',
  confirmButton: 'change-area-modal-confirm',
  cancelButton: 'change-area-modal-cancel',
};

export type ChangeExpiryDateResult = { expiryDate: string; status: '' | 'active' | 'expired' };

/**
 * Opens SweetAlert2 Change Expiry Date modal.
 * - Set Date: date/time input (mm/dd/yyyy, time).
 * - Status: dropdown Choose, Active, Expired.
 * @returns Promise<ChangeExpiryDateResult | null> - { expiryDate (ISO), status } if confirmed, null if cancelled
 */
export async function openChangeExpiryDateModal(): Promise<ChangeExpiryDateResult | null> {
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 16); // yyyy-mm-ddThh:mm for datetime-local

  const htmlContent = `
    <div class="change-area-form">
      <label class="change-area-label" for="change-expiry-date-input">Set Date</label>
      <input
        type="datetime-local"
        id="change-expiry-date-input"
        class="change-area-select change-area-input"
        value="${defaultDate}"
      />
      <label class="change-area-label" for="change-expiry-status-select">Status</label>
      <select id="change-expiry-status-select" class="change-area-select">
        <option value="">Choose...</option>
        <option value="active">Active</option>
        <option value="expired">Expired</option>
      </select>
    </div>
  `;

  const result = await Swal.fire({
    title: 'Change Expiry Date',
    html: htmlContent,
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
    preConfirm: () => {
      const dateInput = document.getElementById('change-expiry-date-input') as HTMLInputElement;
      const statusSelect = document.getElementById('change-expiry-status-select') as HTMLSelectElement;
      const dateValue = dateInput?.value;
      const statusValue = (statusSelect?.value || '') as '' | 'active' | 'expired';
      if (!dateValue || dateValue.trim() === '') {
        Swal.showValidationMessage('Please set expiry date.');
        return undefined;
      }
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) {
        Swal.showValidationMessage('Invalid date.');
        return undefined;
      }
      return { expiryDate: date.toISOString(), status: statusValue };
    },
  });

  if (!result.isConfirmed || !result.value) return null;
  return result.value as ChangeExpiryDateResult;
}
