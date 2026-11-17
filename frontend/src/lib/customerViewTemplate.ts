export type CustomerViewTemplate = 'modern' | 'classic';

export const getCustomerViewTemplate = (tenantId?: string | null): CustomerViewTemplate => {
  if (typeof window === 'undefined') return 'modern';
  if (tenantId) {
    const tenantSetting = localStorage.getItem(`netfix_customer_view_template_${tenantId}`);
    if (tenantSetting === 'classic' || tenantSetting === 'modern') {
      return tenantSetting;
    }
  }
  const globalSetting = localStorage.getItem('netfix_default_customer_view_template');
  if (globalSetting === 'classic' || globalSetting === 'modern') {
    return globalSetting;
  }
  // Default to the new Modern Pro redesign
  return 'modern';
};

export const setCustomerViewTemplate = (template: CustomerViewTemplate, tenantId?: string | null): void => {
  if (typeof window === 'undefined') return;
  if (tenantId) {
    localStorage.setItem(`netfix_customer_view_template_${tenantId}`, template);
  } else {
    localStorage.setItem('netfix_default_customer_view_template', template);
  }
  window.dispatchEvent(
    new CustomEvent('netfix:customer-view-template-changed', {
      detail: { template, tenantId },
    })
  );
};
