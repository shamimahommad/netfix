export interface ServiceArea {
  serviceAreaId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubArea {
  subAreaId: string;
  serviceAreaId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAreaPayload {
  name: string;
  description?: string;
}

export interface UpdateAreaPayload {
  name?: string;
  description?: string;
}

export interface CreateSubAreaPayload {
  name: string;
  description?: string;
  serviceAreaId: string;
}

export interface UpdateSubAreaPayload {
  name?: string;
  description?: string;
  serviceAreaId?: string;
}

