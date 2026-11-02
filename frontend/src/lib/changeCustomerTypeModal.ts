import Swal from 'sweetalert2';

const CUSTOM_CLASS = {
  popup: 'change-area-modal-sky-teal',
  title: 'change-area-modal-title',
  htmlContainer: 'change-area-modal-body',
  confirmButton: 'change-area-modal-confirm',
  cancelButton: 'change-area-modal-cancel',
};

export type CustomerTypeValue = 'prepaid' | 'postpaid' | 'vip' | 'free';

/**
 * Opens SweetAlert2 Change Customer Type modal.
 * - Same look and behavior as Change Area modal (sky/teal, non-closable).
 * - One dropdown: label "Customer Type", options Choose, Prepaid, Postpaid, VIP, Free.
 * @returns Promise<'prepaid' | 'postpaid' | 'vip' | 'free' | null> - selected type if confirmed, null if cancelled
 */
export async function openChangeCustomerTypeModal(): Promise<CustomerTypeValue | null> {
  const html = `
    <div class="change-area-form">
      <label class="change-area-label" for="change-customer-type-select">Customer Type</label>
      <select id="change-customer-type-select" class="change-area-select">
        <option value="">Choose</option>
        <option value="prepaid">Prepaid</option>
        <option value="postpaid">Postpaid</option>
        <option value="vip">VIP</option>
        <option value="free">Free</option>
      </select>
    </div>
  `;

  const result = await Swal.fire({
    title: 'Change Customer Type',
    html,
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
      const select = document.getElementById('change-customer-type-select') as HTMLSelectElement;
      const value = select?.value;
      if (!value || value === '') {
        Swal.showValidationMessage('Please select a customer type.');
        return undefined;
      }
      return value as CustomerTypeValue;
    },
  });

  if (!result.isConfirmed || !result.value) return null;
  return result.value as CustomerTypeValue;
}
