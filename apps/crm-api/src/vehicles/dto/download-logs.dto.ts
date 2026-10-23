export class DownloadLogsDto {
  from?: string;
  to?: string;
  format?: 'csv' | 'json';
  limit?: string;
}
