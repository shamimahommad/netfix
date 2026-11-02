import Swal from 'sweetalert2';
import { accessProfilesService } from '@/services/access-profiles.service';

const CUSTOM_CLASS = {
  popup: 'change-area-modal-sky-teal',
  title: 'change-area-modal-title',
  htmlContainer: 'change-area-modal-body',
  confirmButton: 'change-area-modal-confirm',
  cancelButton: 'change-area-modal-cancel',
};

/**
 * Opens SweetAlert2 Change Package modal.
 * - Same look and behavior as Change Area modal (sky/teal, non-closable).
 * - One dropdown: label "Package", options show Package with Price.
 * @returns Promise<string | null> - selected package (access profile) id if confirmed, null if cancelled
 */
export async function openChangePlanModal(): Promise<string | null> {
  let packages: Array<{ id: string; name: string; price?: number }> = [];
  try {
    const res = await accessProfilesService.getDropdown();
    packages = res.data || [];
  } catch {
    await Swal.fire({
      title: 'Error',
      text: 'Failed to load packages.',
      icon: 'error',
      customClass: CUSTOM_CLASS,
    });
    return null;
  }

  const formatPrice = (price: number | undefined) => {
    if (price == null || Number.isNaN(price)) return '';
    return `৳${Math.round(Number(price)).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const options = packages
    .map((p) => {
      const label = p.price != null ? `${p.name} - ${formatPrice(p.price)}` : p.name;
      return `<option value="${p.id}">${escapeHtml(label)}</option>`;
    })
    .join('');
  const htmlContent = `
    <div class="change-area-form">
      <label class="change-area-label" for="change-plan-select">Package with Price</label>
      <select id="change-plan-select" class="change-area-select">
        <option value="">Choose</option>
        ${options}
      </select>
    </div>
  `;

  const result = await Swal.fire({
    title: 'Change Package',
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
      const select = document.getElementById('change-plan-select') as HTMLSelectElement;
      const value = select?.value;
      if (!value || value === '') {
        Swal.showValidationMessage('Please select a package.');
        return undefined;
      }
      return value;
    },
  });

  if (!result.isConfirmed || !result.value) return null;
  return result.value as string;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
