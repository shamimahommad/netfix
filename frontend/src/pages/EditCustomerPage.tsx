import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customersService } from '@/services/customers.service';
import { CustomerDetailResponse } from '@/types/customer.types';
import { serviceAreaService } from '@/services/service-area.service';
import { ServiceArea } from '@/types/service-area.types';

function ArrowLeftIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function XMarkIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customerData, setCustomerData] = useState<CustomerDetailResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [isAddAreaModalOpen, setIsAddAreaModalOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    nationalId: '',
    installationAddress: '',
    area: '',
    subArea: '',
    internalNotes: '',
    dob: '',
  });

  useEffect(() => {
    if (id) {
      loadCustomerDetail();
      loadAreas();
    }
  }, [id]);

  const loadAreas = async () => {
    try {
      const response = await serviceAreaService.listAreas();
      setAreas(response.data || []);
    } catch (err) {
      console.error('Failed to load areas:', err);
    }
  };

  const loadCustomerDetail = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await customersService.getCustomerDetail(id);
      setCustomerData(response.data);
      // Populate form with current data
      setEditFormData({
        fullName: response.data.customer.fullName || '',
        email: response.data.customer.email || '',
        phone: response.data.customer.phone || '',
        nationalId: response.data.customer.nationalId || '',
        installationAddress: response.data.customer.installationAddress || '',
        area: response.data.customer.area || '',
        subArea: response.data.customer.subArea || '',
        internalNotes: response.data.customer.internalNotes || '',
        dob: response.data.customer.dob || '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load customer details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddArea = async () => {
    if (!newAreaName.trim()) return;
    setIsCreatingArea(true);
    try {
      await serviceAreaService.createArea({ name: newAreaName.trim() });
      setNewAreaName('');
      setIsAddAreaModalOpen(false);
      await loadAreas();
    } catch (err: any) {
      alert(err.message || 'Failed to create area.');
    } finally {
      setIsCreatingArea(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    setError(null);

    try {
      // Prepare update payload
      const updatePayload: any = {
        fullName: editFormData.fullName,
        email: editFormData.email || undefined,
        phone: editFormData.phone,
        nationalId: editFormData.nationalId || undefined,
        installationAddress: editFormData.installationAddress || undefined,
        internalNotes: editFormData.internalNotes || undefined,
      };

      // Always include metadata if any metadata field exists in form
      // This ensures we can update/clear metadata fields properly
      const existingMetadata = customerData?.customer.metadata || {};
      updatePayload.metadata = {
        ...existingMetadata,
        ...(editFormData.area !== undefined && { area: editFormData.area || null }),
        ...(editFormData.subArea !== undefined && { subArea: editFormData.subArea || null }),
        ...(editFormData.dob !== undefined && { dob: editFormData.dob || null }),
      };

      await customersService.updateCustomer(id, updatePayload);
      // Navigate back to customer detail page
      navigate(`/dashboard/customers/view/${id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update customer information.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
        <div className="w-full">
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-48 bg-slate-300 dark:bg-slate-700 rounded-lg" />
            <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !customerData) {
    return (
      <div className="w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
        <div className="w-full space-y-3">
          <button
            onClick={() => navigate(`/dashboard/customers/view/${id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Customer
          </button>
          <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4 shadow-lg">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="w-full max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Customer Information
            </h1>
          </div>
          <button
            onClick={() => navigate(`/dashboard/customers/view/${id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4 shadow-lg">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-50 dark:from-slate-800 dark:via-blue-900/20 dark:to-indigo-900/20 backdrop-blur-lg rounded-lg border-2 border-blue-200 dark:border-blue-800 shadow-xl p-6">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Full Name *
              </label>
              <input
                type="text"
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
                required
                placeholder="Enter full name"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Phone *
                </label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
                  required
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  NID No
                </label>
                <input
                  type="text"
                  value={editFormData.nationalId}
                  onChange={(e) => setEditFormData({ ...editFormData, nationalId: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
                  placeholder="Enter NID number"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={editFormData.dob}
                  onChange={(e) => setEditFormData({ ...editFormData, dob: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Installation Address
              </label>
              <textarea
                value={editFormData.installationAddress}
                onChange={(e) => setEditFormData({ ...editFormData, installationAddress: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 transition-all shadow-sm hover:shadow-md resize-none"
                placeholder="Enter installation address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Area
                  </label>
                  <button
                    onClick={() => setIsAddAreaModalOpen(true)}
                    className="p-1.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-lg transition-all duration-300 hover:scale-110 shadow-md hover:shadow-lg flex-shrink-0"
                    title="Add New Area"
                    type="button"
                  >
                    <PlusIcon className="w-3 h-3" />
                  </button>
                </div>
                <select
                  value={editFormData.area}
                  onChange={(e) => setEditFormData({ ...editFormData, area: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
                >
                  <option value="">Select Area</option>
                  {areas.map((area) => (
                    <option key={area.serviceAreaId} value={area.name}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Sub Area
                </label>
                <input
                  type="text"
                  value={editFormData.subArea}
                  onChange={(e) => setEditFormData({ ...editFormData, subArea: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
                  placeholder="Enter sub area"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Internal Notes
              </label>
              <textarea
                value={editFormData.internalNotes}
                onChange={(e) => setEditFormData({ ...editFormData, internalNotes: e.target.value })}
                rows={4}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 transition-all shadow-sm hover:shadow-md resize-none"
                placeholder="Enter internal notes"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-5 border-t-2 border-blue-200 dark:border-blue-800 flex justify-end gap-3">
            <button
              onClick={() => navigate(`/dashboard/customers/view/${id}`)}
              className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-all duration-300 font-semibold shadow-sm hover:shadow-md"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !editFormData.fullName || !editFormData.phone}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Add Area Modal */}
      {isAddAreaModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-50 dark:from-slate-800 dark:via-blue-900/20 dark:to-indigo-900/20 backdrop-blur-lg rounded-lg shadow-2xl max-w-md w-full border-2 border-blue-200 dark:border-blue-800">
            <div className="p-4 border-b-2 border-blue-200 dark:border-blue-800 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Add Area
              </h3>
              <button
                onClick={() => {
                  setIsAddAreaModalOpen(false);
                  setNewAreaName('');
                }}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all duration-300 hover:scale-110"
              >
                <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Area Name:
                </label>
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newAreaName.trim()) {
                      handleAddArea();
                    }
                  }}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
                  placeholder="Enter area name"
                  autoFocus
                />
              </div>
              
              <div className="mb-4">
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  To edit or delete area,{' '}
                  <a 
                    href="/dashboard/service-area/areas" 
                    className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/dashboard/service-area/areas');
                    }}
                  >
                    click here
                  </a>
                </p>
              </div>
            </div>

            <div className="p-4 border-t-2 border-blue-200 dark:border-blue-800 flex justify-end gap-3 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/20">
              <button
                onClick={() => {
                  setIsAddAreaModalOpen(false);
                  setNewAreaName('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-all duration-300 font-semibold shadow-sm hover:shadow-md"
                disabled={isCreatingArea}
              >
                Close
              </button>
              <button
                onClick={handleAddArea}
                disabled={isCreatingArea || !newAreaName.trim()}
                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
              >
                {isCreatingArea ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Adding...
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-4 h-4" />
                    Add
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
