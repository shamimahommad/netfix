import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersService } from '@/services/customers.service';
import { CreateCustomerPayload } from '@/types/customer.types';
import { useToastContext } from '@/contexts/ToastContext';
import { useTenantStore } from '@/stores/tenantStore';
import MapPickerModal from './MapPickerModal';

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateCustomerModal({ isOpen, onClose, onSuccess }: CreateCustomerModalProps) {
  const navigate = useNavigate();
  const toast = useToastContext();
  const { selectedTenant } = useTenantStore();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<CreateCustomerPayload>({
    fullName: '',
    phone: '',
    email: '',
    installationAddress: '',
    latitude: undefined,
    longitude: undefined,
  });
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[\d\s\-\+\(\)]+$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.installationAddress.trim()) {
      newErrors.installationAddress = 'Installation address is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const payload: CreateCustomerPayload = {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        installationAddress: formData.installationAddress.trim(),
      };

      // Only include email if provided
      if (formData.email?.trim()) {
        payload.email = formData.email.trim();
      }

      // Only include location if provided
      if (formData.latitude !== undefined && formData.longitude !== undefined) {
        payload.latitude = formData.latitude;
        payload.longitude = formData.longitude;
      }

      const response = await customersService.createCustomer(payload);

      if (response.success && response.data) {
        toast.success('Customer created successfully!');
        onClose();
        
        // Reset form
        setFormData({
          fullName: '',
          phone: '',
          email: '',
          installationAddress: '',
          latitude: undefined,
          longitude: undefined,
        });

        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess();
        }

        // Redirect to customer detail page
        navigate(`/dashboard/customers/view/${response.data.customerId}`);
      }
    } catch (err: any) {
      console.error('Error creating customer:', err);
      
      let errorMessage = 'Failed to create customer. Please try again.';
      
      if (err.response) {
        const response = err.response;
        const data = response.data;
        
        // Handle validation errors (array format)
        if (Array.isArray(data.message)) {
          errorMessage = data.message.join(', ');
        }
        // Handle single message
        else if (data.message) {
          errorMessage = data.message;
        }
        // Handle error field
        else if (data.error) {
          if (Array.isArray(data.error)) {
            errorMessage = data.error.join(', ');
          } else if (typeof data.error === 'string') {
            errorMessage = data.error;
          }
        }
        // Handle string response
        else if (typeof data === 'string') {
          errorMessage = data;
        }
        // Handle status text
        else if (response.statusText) {
          errorMessage = `${response.status} ${response.statusText}`;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof CreateCustomerPayload, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!isOpen) return null;

  // Validate tenant context
  if (!selectedTenant) {
    return (
      <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent mb-3">ISP Not Selected</h3>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-6">
              Please select an ISP from the topbar to create a customer.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all font-semibold shadow-sm hover:shadow active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Create New Customer
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                Add a new customer to <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedTenant.tenantName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Full Name */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800">
            <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="fullName"
              required
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                errors.fullName
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
              placeholder="John Doe"
              disabled={isLoading}
            />
            {errors.fullName && (
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{errors.fullName}</p>
            )}
          </div>

          {/* Phone */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-5 rounded-xl border border-emerald-100 dark:border-emerald-800">
            <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              required
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                errors.phone
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
              placeholder="+1234567890"
              disabled={isLoading}
            />
            {errors.phone && (
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{errors.phone}</p>
            )}
          </div>

          {/* Email */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-5 rounded-xl border border-purple-100 dark:border-purple-800">
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Email Address <span className="text-slate-500 dark:text-slate-400 text-xs font-normal">(Optional)</span>
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                errors.email
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
              placeholder="john@example.com"
              disabled={isLoading}
            />
            {errors.email && (
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{errors.email}</p>
            )}
          </div>

          {/* Installation Address */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-5 rounded-xl border border-amber-100 dark:border-amber-800">
            <label htmlFor="installationAddress" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Installation Address <span className="text-red-500">*</span>
            </label>
            <textarea
              id="installationAddress"
              required
              rows={3}
              value={formData.installationAddress}
              onChange={(e) => handleChange('installationAddress', e.target.value)}
              className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all resize-none ${
                errors.installationAddress
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
              placeholder="123 Main Street, City, State, ZIP"
              disabled={isLoading}
            />
            {errors.installationAddress && (
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{errors.installationAddress}</p>
            )}
          </div>

          {/* Customer Location Section - Only show if tenant has map enabled */}
          {selectedTenant?.limits?.mapEnabled && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-5 rounded-xl border border-green-100 dark:border-green-800">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Customer Location <span className="text-slate-500 dark:text-slate-400 text-xs font-normal">(Optional)</span>
              </label>
              
              {/* Map Preview */}
              {formData.latitude !== undefined && formData.longitude !== undefined && (
                <div className="mb-4 h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${formData.longitude - 0.01},${formData.latitude - 0.01},${formData.longitude + 0.01},${formData.latitude + 0.01}&layer=mapnik&marker=${formData.latitude},${formData.longitude}`}
                    className="w-full h-full"
                  />
                </div>
              )}

              {/* Coordinates Display */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    Latitude
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formData.latitude !== undefined ? formData.latitude.toFixed(8) : ''}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    placeholder="Not set"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    Longitude
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formData.longitude !== undefined ? formData.longitude.toFixed(8) : ''}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    placeholder="Not set"
                    disabled
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (navigator.geolocation) {
                      try {
                        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                          navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 0,
                          });
                        });
                        setFormData((prev) => ({
                          ...prev,
                          latitude: position.coords.latitude,
                          longitude: position.coords.longitude,
                        }));
                        toast.success('Location retrieved successfully!');
                      } catch (error) {
                        toast.error('Failed to get current location. Please try picking from map.');
                      }
                    } else {
                      toast.error('Geolocation is not supported by your browser.');
                    }
                  }}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Get Current Location
                </button>
                <button
                  type="button"
                  onClick={() => setIsMapModalOpen(true)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Pick from Map
                </button>
              </div>

              {/* Clear Location Button */}
              {(formData.latitude !== undefined || formData.longitude !== undefined) && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      latitude: undefined,
                      longitude: undefined,
                    }));
                  }}
                  disabled={isLoading}
                  className="mt-3 w-full px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear Location
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-3 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm hover:shadow-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm hover:shadow active:scale-95 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Customer'
              )}
            </button>
          </div>
        </form>

        {/* Map Picker Modal */}
        <MapPickerModal
          isOpen={isMapModalOpen}
          onClose={() => setIsMapModalOpen(false)}
          onSelect={(lat, lng) => {
            setFormData((prev) => ({
              ...prev,
              latitude: lat,
              longitude: lng,
            }));
          }}
          initialLat={formData.latitude}
          initialLng={formData.longitude}
        />
      </div>
    </div>
  );
}
