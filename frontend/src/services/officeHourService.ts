import api from "./api";

export interface OfficeHourData {
  _id: string;
  courses: Array<{ id: string; name: string; shortName: string }>;
  courseLines: Array<{ id: string; name: string }>;
  courseTopics: Array<{ id: string; name: string }>;
  startTime: string;
  endTime: string;
  status: string;
  centre: { id: string; name: string; shortName: string };
  teacher?: {
    id: string;
    username: string;
    code: string;
    fullName: string;
    imageUrl: string;
    email: string;
    phoneNumber: string;
  };
  class?: { id: string; name: string };
  classSiteId?: string;
  note?: string;
  managerNote?: string;
  type?: string;
  links?: Array<{ _id: string; title: string; link: string }>;
  studentCount?: number;
  custom?: any;
  createdBy?: { username: string };
  createdAt?: string;
  updatedAt?: string;
}

export const officeHourService = {
  getOfficeHours: async (
    teacherId: string,
    centreIds?: string[],
    roles?: string[],
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      centre?: string;
      status?: string;
      type?: string;
    },
  ): Promise<{ data: OfficeHourData[]; meta: any }> => {
    const response = await api.post("/office-hours", {
      teacherId,
      centreIds,
      roles,
      page: options?.page,
      limit: options?.limit,
      search: options?.search,
      centre: options?.centre,
      status: options?.status,
      type: options?.type,
    });
    return { data: response.data.data, meta: response.data.meta };
  },
  getOfficeHourById: async (
    id: string,
    teacherId: string,
    centreIds?: string[],
    roles?: string[],
  ): Promise<{ data: any }> => {
    const response = await api.post("/office-hours/detail", {
      id,
      teacherId,
      centreIds,
      roles,
    });
    return { data: response.data.data };
  },
};
