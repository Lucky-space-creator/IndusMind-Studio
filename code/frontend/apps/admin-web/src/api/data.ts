import { api, downloadFile, saveBlob, uploadFile } from "@hwc/shared-api";
import type {
  DataAnomaly,
  DataCleaned,
  DataDataset,
  DataRecord,
  PageResult,
  SimulateDatasetRequest,
} from "@hwc/shared-types";

export const pageDatasets = (params: {
  current?: number;
  size?: number;
  deviceId?: number;
  sourceType?: string;
  status?: string;
  keyword?: string;
}) => api.get<PageResult<DataDataset>>("/api/admin/data/datasets", params);

export const getDataset = (id: number) => api.get<DataDataset>(`/api/admin/data/datasets/${id}`);

export const importDataset = (file: File, deviceId: number, name?: string) =>
  uploadFile<DataDataset>("/api/admin/data/datasets/import", file, {
    deviceId: String(deviceId),
    ...(name ? { name } : {}),
  });

export const simulateDataset = (body: SimulateDatasetRequest) =>
  api.post<DataDataset>("/api/admin/data/datasets/simulate", body);

export const deleteDataset = (id: number) => api.delete<void>(`/api/admin/data/datasets/${id}`);

export const pageRecords = (
  id: number,
  params: { current?: number; size?: number; metricId?: number; from?: string; to?: string },
) => api.get<PageResult<DataRecord>>(`/api/admin/data/datasets/${id}/records`, params);

export const cleanDataset = (id: number) => api.post<void>(`/api/admin/data/datasets/${id}/clean`);

export const pageCleaned = (id: number, params?: { current?: number; size?: number }) =>
  api.get<PageResult<DataCleaned>>(`/api/admin/data/datasets/${id}/cleaned`, params);

export const cleanedStats = (id: number) =>
  api.get<Record<string, number>>(`/api/admin/data/datasets/${id}/cleaned/stats`);

export const extractAnomalies = (id: number) =>
  api.post<void>(`/api/admin/data/datasets/${id}/anomalies/extract`);

export const pageAnomalies = (id: number, params?: { current?: number; size?: number }) =>
  api.get<PageResult<DataAnomaly>>(`/api/admin/data/datasets/${id}/anomalies`, params);

export const exportAnomalies = async (id: number) => {
  const blob = await downloadFile(`/api/admin/data/anomalies/export`, { datasetId: id });
  saveBlob(blob, `anomalies-dataset-${id}.csv`);
};