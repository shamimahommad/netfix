import Swal from 'sweetalert2';
import { networkService } from '@/services/network.service';

const CUSTOM_CLASS = {
  popup: 'change-area-modal-sky-teal',
  title: 'change-area-modal-title',
  htmlContainer: 'change-area-modal-body',
  confirmButton: 'change-area-modal-confirm',
  cancelButton: 'change-area-modal-cancel',
};

/**
 * Opens SweetAlert2 Change Server modal.
 * - Same look and behavior as Change Area modal (sky/teal, non-closable).
 * - One dropdown: label "Server", options from active network devices.
 * @returns Promise<string | null> - selected server (network device) id if confirmed, null if cancelled
 */
export async function openChangeServerModal(): Promise<string | null> {
  let devices: Array<{ id: string; name: string }> = [];
  try {
    const res = await networkService.getDevicesDropdown();
    devices = res.data || [];
  } catch {
    await Swal.fire({
      title: 'Error',
      text: 'Failed to load servers.',
      icon: 'error',
      customClass: CUSTOM_CLASS,
    });
    return null;
  }

  const options = devices
    .map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`)
    .join('');
  const htmlContent = `
    <div class="change-area-form">
      <label class="change-area-label" for="change-server-select">Server</label>
      <select id="change-server-select" class="change-area-select">
        <option value="">Choose</option>
        ${options}
      </select>
    </div>
  `;

  const result = await Swal.fire({
    title: 'Change Server',
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
      const select = document.getElementById('change-server-select') as HTMLSelectElement;
      const value = select?.value;
      if (!value || value === '') {
        Swal.showValidationMessage('Please select a server.');
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
