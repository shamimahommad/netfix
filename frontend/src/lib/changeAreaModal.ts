import Swal from 'sweetalert2';
import { serviceAreaService } from '@/services/service-area.service';
import type { ServiceArea, SubArea } from '@/types/service-area.types';

const CUSTOM_CLASS = {
  popup: 'change-area-modal-sky-teal',
  title: 'change-area-modal-title',
  htmlContainer: 'change-area-modal-body',
  confirmButton: 'change-area-modal-confirm',
  cancelButton: 'change-area-modal-cancel',
};

export type ChangeAreaResult = { areaName: string; subAreaName: string };

/**
 * Opens SweetAlert2 Change Area modal.
 * - 1st line: Label "Area Dropdown" + Area select.
 * - 2nd line: Label "Sub Area Dropdown" + Sub Area select (populated when area is selected).
 * - Confirm / Cancel only; modal cannot be closed by clicking outside or ESC.
 * @returns Promise<ChangeAreaResult | null> - { areaName, subAreaName } if confirmed, null if cancelled
 */
export async function openChangeAreaModal(): Promise<ChangeAreaResult | null> {
  let areas: ServiceArea[] = [];
  try {
    const res = await serviceAreaService.listAreas();
    areas = res.data || [];
  } catch {
    await Swal.fire({
      title: 'Error',
      text: 'Failed to load areas.',
      icon: 'error',
      customClass: CUSTOM_CLASS,
    });
    return null;
  }

  const areaOptions = areas
    .map((a) => `<option value="${a.serviceAreaId}">${escapeHtml(a.name)}</option>`)
    .join('');
  const html = `
    <div class="change-area-form">
      <label class="change-area-label" for="change-area-select">Area</label>
      <select id="change-area-select" class="change-area-select">
        <option value="">Choose</option>
        ${areaOptions}
      </select>
      <label class="change-area-label" for="change-subarea-select">Sub Area</label>
      <select id="change-subarea-select" class="change-area-select">
        <option value="">Choose</option>
      </select>
    </div>
  `;

  const result = await Swal.fire({
    title: 'Change Area',
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
    didOpen: () => {
      const areaSelect = document.getElementById('change-area-select') as HTMLSelectElement;
      const subAreaSelect = document.getElementById('change-subarea-select') as HTMLSelectElement;
      if (!areaSelect || !subAreaSelect) return;

      areaSelect.addEventListener('change', async () => {
        const areaId = areaSelect.value;
        subAreaSelect.innerHTML = '<option value="">Choose</option>';
        subAreaSelect.disabled = true;
        if (!areaId) {
          subAreaSelect.disabled = false;
          return;
        }
        try {
          const res = await serviceAreaService.listSubAreas(areaId);
          const subs: SubArea[] = res.data || [];
          subs.forEach((s) => {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.textContent = s.name;
            subAreaSelect.appendChild(opt);
          });
        } catch {
          // keep "Choose" only
        }
        subAreaSelect.disabled = false;
      });
    },
    preConfirm: () => {
      const areaSelect = document.getElementById('change-area-select') as HTMLSelectElement;
      const subAreaSelect = document.getElementById('change-subarea-select') as HTMLSelectElement;
      const areaId = areaSelect?.value;
      const subAreaName = subAreaSelect?.value ?? '';
      if (!areaId || areaId === '') {
        Swal.showValidationMessage('Please select an area.');
        return undefined;
      }
      const area = areas.find((a) => a.serviceAreaId === areaId);
      const areaName = area?.name ?? '';
      return { areaName, subAreaName };
    },
  });

  if (!result.isConfirmed || !result.value) return null;
  return result.value as ChangeAreaResult;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
